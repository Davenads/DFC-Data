const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:duel-data';
const CACHE_TIMESTAMP_KEY = 'dfc-data:duel-data-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds

class DuelDataCache {
    constructor() {
        this.isRefreshing = false;
    }

    async getCachedData() {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();
            
            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available, falling back to Google Sheets');
                return await this.fetchLiveData();
            }

            const cachedData = await client.get(CACHE_KEY);
            
            if (cachedData) {
                console.log('Retrieved data from Redis cache');
                return JSON.parse(cachedData);
            } else {
                console.log('No cached data found, attempting to refresh cache');
                // Try to refresh cache, but fallback to live data if that fails
                try {
                    return await this.refreshCache();
                } catch (refreshError) {
                    console.error('Cache refresh failed, falling back to Google Sheets:', refreshError);
                    return await this.fetchLiveData();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed, falling back to Google Sheets:', error);
            return await this.fetchLiveData();
        }
    }

    async fetchLiveData() {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Duel Data!A2:Q',
            });

            const data = response.data.values || [];
            console.log(`Fetched ${data.length} rows from Google Sheets`);
            return data;
        } catch (error) {
            console.error('Error fetching live data from Google Sheets:', error);
            throw error;
        }
    }

    async refreshCache() {
        if (this.isRefreshing) {
            console.log('Cache refresh already in progress, waiting...');
            // Wait for current refresh to complete
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // After waiting, try to get cached data, fallback to live if needed
            try {
                return await this.getCachedData();
            } catch (error) {
                console.error('Error after waiting for refresh, falling back to live data:', error);
                return await this.fetchLiveData();
            }
        }

        this.isRefreshing = true;
        
        try {
            console.log('Refreshing Duel Data cache...');
            const data = await this.fetchLiveData();
            
            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();
                
                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    console.log(`Cache refreshed with ${data.length} rows, TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during refresh, but returning live data:', redisError);
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing cache:', error);
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
            console.error('Error getting cache timestamp:', error);
            return null;
        }
    }

    async isCacheStale(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const timestamp = await this.getCacheTimestamp();
        if (!timestamp) return true;
        
        return Date.now() - timestamp > maxAgeMs;
    }
}

module.exports = new DuelDataCache();