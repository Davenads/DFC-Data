const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:rankings';
const CACHE_TIMESTAMP_KEY = 'dfc-data:rankings-timestamp';
const CACHE_TTL = 86400; // 1 day in seconds (rankings change less frequently)

class RankingsCache {
    constructor() {
        this.isRefreshing = false;
    }

    async getCachedRankings() {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();
            
            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available for rankings, falling back to Google Sheets');
                return await this.fetchLiveRankings();
            }

            const cachedData = await client.get(CACHE_KEY);
            
            if (cachedData) {
                console.log('Retrieved rankings from Redis cache');
                return JSON.parse(cachedData);
            } else {
                console.log('No cached rankings found, attempting to refresh cache');
                // Try to refresh cache, but fallback to live data if that fails
                try {
                    return await this.refreshRankingsCache();
                } catch (refreshError) {
                    console.error('Rankings cache refresh failed, falling back to Google Sheets:', refreshError);
                    return await this.fetchLiveRankings();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed for rankings, falling back to Google Sheets:', error);
            return await this.fetchLiveRankings();
        }
    }

    async fetchLiveRankings() {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Official Rankings!A1:B30', // Get enough rows for champion + top 20
            });

            const rankings = response.data.values || [];
            console.log(`Fetched ${rankings.length} ranking rows from Google Sheets`);
            return rankings;
        } catch (error) {
            console.error('Error fetching live rankings from Google Sheets:', error);
            throw error;
        }
    }

    async refreshRankingsCache() {
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
                return await this.fetchLiveRankings();
            }
        }

        this.isRefreshing = true;
        
        try {
            console.log('Refreshing rankings cache...');
            const rankings = await this.fetchLiveRankings();
            
            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();
                
                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rankings));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    console.log(`Rankings cache refreshed with ${rankings.length} rows, TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for rankings cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during rankings refresh, but returning live data:', redisError);
            }
            
            return rankings;
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