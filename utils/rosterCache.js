const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:roster';
const CACHE_TIMESTAMP_KEY = 'dfc-data:roster-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds

class RosterCache {
    constructor() {
        this.isRefreshing = false;
    }

    /**
     * Get cached roster data or fetch from Google Sheets if not available
     * Returns array of roster entries with UUID as key for easy lookup
     */
    async getCachedRoster() {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available for roster, falling back to Google Sheets');
                return await this.fetchLiveRoster();
            }

            const cachedData = await client.get(CACHE_KEY);

            if (cachedData) {
                console.log('Retrieved roster from Redis cache');
                return JSON.parse(cachedData);
            } else {
                console.log('No cached roster found, attempting to refresh cache');
                try {
                    return await this.refreshCache();
                } catch (refreshError) {
                    console.error('Roster cache refresh failed, falling back to Google Sheets:', refreshError);
                    return await this.fetchLiveRoster();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed for roster, falling back to Google Sheets:', error);
            return await this.fetchLiveRoster();
        }
    }

    /**
     * Fetch roster data from Google Sheets and convert to lookup map
     */
    async fetchLiveRoster() {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Roster!A2:D500', // Columns: Arena Name, Data Name, Discord Name, UUID
            });

            const rows = response.data.values || [];
            console.log(`Fetched ${rows.length} roster entries from Google Sheets`);

            // Convert to lookup map by UUID for fast access
            const rosterMap = {};
            rows.forEach(row => {
                const uuid = row[3]; // Column D: UUID
                if (uuid) {
                    rosterMap[uuid] = {
                        arenaName: row[0] || '',    // Column A
                        dataName: row[1] || '',      // Column B
                        discordName: row[2] || '',   // Column C
                        uuid: uuid                    // Column D
                    };
                }
            });

            console.log(`Created roster map with ${Object.keys(rosterMap).length} entries`);
            return rosterMap;
        } catch (error) {
            console.error('Error fetching live roster from Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Refresh the roster cache
     */
    async refreshCache() {
        if (this.isRefreshing) {
            console.log('Roster cache refresh already in progress, waiting...');
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            try {
                return await this.getCachedRoster();
            } catch (error) {
                console.error('Error after waiting for roster refresh, falling back to live data:', error);
                return await this.fetchLiveRoster();
            }
        }

        this.isRefreshing = true;

        try {
            console.log('Refreshing Roster cache...');
            const rosterMap = await this.fetchLiveRoster();

            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();

                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rosterMap));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    console.log(`Roster cache refreshed with ${Object.keys(rosterMap).length} entries, TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for roster cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during roster refresh, but returning live data:', redisError);
            }

            return rosterMap;
        } catch (error) {
            console.error('Error refreshing roster cache:', error);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Look up a user by their Discord UUID
     * @param {string} uuid - Discord user ID
     * @returns {Object|null} - Roster entry or null if not found
     */
    async getUserByUUID(uuid) {
        if (!uuid) return null;

        try {
            const roster = await this.getCachedRoster();
            return roster[uuid] || null;
        } catch (error) {
            console.error(`Error looking up user ${uuid} in roster:`, error);
            return null;
        }
    }

    /**
     * Get cache timestamp
     */
    async getCacheTimestamp() {
        try {
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) return null;

            const timestamp = await client.get(CACHE_TIMESTAMP_KEY);
            return timestamp ? parseInt(timestamp) : null;
        } catch (error) {
            console.error('Error getting roster cache timestamp:', error);
            return null;
        }
    }

    /**
     * Check if cache is stale
     */
    async isCacheStale(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const timestamp = await this.getCacheTimestamp();
        if (!timestamp) return true;

        return Date.now() - timestamp > maxAgeMs;
    }
}

module.exports = new RosterCache();
