const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:rankings';
const CACHE_TIMESTAMP_KEY = 'dfc-data:rankings-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds (same as duel data cache)
const DIVISIONS = ['HLD', 'LLD', 'Melee'];

class RankingsCache {
    constructor() {
        this.isRefreshing = false;
    }

    async getCachedRankings(division = null) {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available for rankings, falling back to Google Sheets');
                return division ? await this.fetchLiveRankingsForDivision(division) : await this.fetchAllLiveRankings();
            }

            const cachedData = await client.get(CACHE_KEY);

            if (cachedData) {
                console.log('Retrieved rankings from Redis cache');
                const allRankings = JSON.parse(cachedData);
                return division ? allRankings[division] : allRankings;
            } else {
                console.log('No cached rankings found, attempting to refresh cache');
                // Try to refresh cache, but fallback to live data if that fails
                try {
                    const allRankings = await this.refreshCache();
                    return division ? allRankings[division] : allRankings;
                } catch (refreshError) {
                    console.error('Rankings cache refresh failed, falling back to Google Sheets:', refreshError);
                    return division ? await this.fetchLiveRankingsForDivision(division) : await this.fetchAllLiveRankings();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed for rankings, falling back to Google Sheets:', error);
            return division ? await this.fetchLiveRankingsForDivision(division) : await this.fetchAllLiveRankings();
        }
    }

    async fetchLiveRankingsForDivision(division) {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            // Write the division to cell B3 in the 'Official Rankings - Bot' tab
            await sheets.spreadsheets.values.update({
                auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: "'Official Rankings - Bot'!B3",
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[division]]
                }
            });

            // Small delay to allow formulas to recalculate
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch rankings data from the Official Rankings - Bot tab
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: "'Official Rankings - Bot'!A1:B30", // Get enough rows for champion + top 20
            });

            const rows = response.data.values || [];

            // Parse the data to extract champion and ranked players
            let champion = null;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === 'Champion' && rows[i][1]) {
                    champion = rows[i][1];
                    break;
                }
            }

            // Process the top 20 ranked players
            const rankedPlayers = [];
            let startRow = 4; // Starting from row 4 where numbered rankings begin

            // Find where the numbered rankings actually start
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === '1' || rows[i][0] === 1) {
                    startRow = i;
                    break;
                }
            }

            // Collect up to 20 ranked players
            for (let i = startRow; i < rows.length && rankedPlayers.length < 20; i++) {
                if (rows[i] && rows[i][0] && rows[i][1]) {
                    const rank = rows[i][0].toString();
                    const name = rows[i][1];

                    // Only add if we have valid data
                    if (rank && name) {
                        rankedPlayers.push({ rank, name });
                    }
                }
            }

            console.log(`Fetched ${division} rankings: Champion=${champion}, Ranked Players=${rankedPlayers.length}`);
            return { champion, rankedPlayers };
        } catch (error) {
            console.error(`Error fetching live ${division} rankings from Google Sheets:`, error);
            throw error;
        }
    }

    async fetchAllLiveRankings() {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            const allRankings = {};

            // Fetch rankings for each division sequentially
            for (const division of DIVISIONS) {
                console.log(`Fetching rankings for ${division}...`);
                allRankings[division] = await this.fetchLiveRankingsForDivision(division);
            }

            console.log(`Fetched all rankings for ${DIVISIONS.length} divisions`);
            return allRankings;
        } catch (error) {
            console.error('Error fetching all live rankings from Google Sheets:', error);
            throw error;
        }
    }

    async refreshCache() {
        if (this.isRefreshing) {
            console.log('Rankings cache refresh already in progress, waiting...');
            // Wait for current refresh to complete
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // After waiting, try to get cached data, fallback to live if needed
            try {
                return await this.getCachedRankings();
            } catch (error) {
                console.error('Error after waiting for rankings refresh, falling back to live data:', error);
                return await this.fetchAllLiveRankings();
            }
        }

        this.isRefreshing = true;

        try {
            console.log('Refreshing rankings cache for all divisions...');
            const allRankings = await this.fetchAllLiveRankings();

            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();

                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(allRankings));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    const divisionSummary = DIVISIONS.map(div =>
                        `${div}: ${allRankings[div]?.rankedPlayers?.length || 0} players`
                    ).join(', ');
                    console.log(`Rankings cache refreshed for all divisions (${divisionSummary}), TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for rankings cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during rankings refresh, but returning live data:', redisError);
            }

            return allRankings;
        } catch (error) {
            console.error('Error refreshing rankings cache:', error);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    async getCacheTimestamp() {
        try {
            await redisClient.connect();
            const client = redisClient.getClient();
            
            if (!client || !redisClient.isReady()) return null;
            
            const timestamp = await client.get(CACHE_TIMESTAMP_KEY);
            return timestamp ? parseInt(timestamp) : null;
        } catch (error) {
            console.error('Error getting rankings cache timestamp:', error);
            return null;
        }
    }

    async isCacheStale(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const timestamp = await this.getCacheTimestamp();
        if (!timestamp) return true;
        
        return Date.now() - timestamp > maxAgeMs;
    }
}

module.exports = new RankingsCache();