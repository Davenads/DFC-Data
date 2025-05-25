const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:player-list';
const CACHE_TIMESTAMP_KEY = 'dfc-data:player-list-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds

class PlayerListCache {
    constructor() {
        this.isRefreshing = false;
    }

    async getCachedPlayerList() {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();
            
            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available for player list, falling back to Google Sheets');
                return await this.fetchLivePlayerList();
            }

            const cachedData = await client.get(CACHE_KEY);
            
            if (cachedData) {
                console.log('Retrieved player list from Redis cache');
                return JSON.parse(cachedData);
            } else {
                console.log('No cached player list found, attempting to refresh cache');
                // Try to refresh cache, but fallback to live data if that fails
                try {
                    return await this.refreshPlayerListCache();
                } catch (refreshError) {
                    console.error('Player list cache refresh failed, falling back to Google Sheets:', refreshError);
                    return await this.fetchLivePlayerList();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed for player list, falling back to Google Sheets:', error);
            return await this.fetchLivePlayerList();
        }
    }

    async fetchLivePlayerList() {
        const sheets = google.sheets('v4');
        const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

        try {
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
                range: 'Current ELO!A2:A',
            });

            const players = response.data.values ? response.data.values.flat() : [];
            const uniquePlayers = [...new Set(players)]; // Remove duplicate names
            console.log(`Fetched ${uniquePlayers.length} unique players from Google Sheets`);
            return uniquePlayers;
        } catch (error) {
            console.error('Error fetching live player list from Google Sheets:', error);
            throw error;
        }
    }

    async refreshPlayerListCache() {
        if (this.isRefreshing) {
            console.log('Player list cache refresh already in progress, waiting...');
            // Wait for current refresh to complete
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // After waiting, try to get cached data, fallback to live if needed
            try {
                return await this.getCachedPlayerList();
            } catch (error) {
                console.error('Error after waiting for player list refresh, falling back to live data:', error);
                return await this.fetchLivePlayerList();
            }
        }

        this.isRefreshing = true;
        
        try {
            console.log('Refreshing player list cache...');
            const playerList = await this.fetchLivePlayerList();
            
            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();
                
                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(playerList));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    console.log(`Player list cache refreshed with ${playerList.length} players, TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for player list cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during player list refresh, but returning live data:', redisError);
            }
            
            return playerList;
        } catch (error) {
            console.error('Error refreshing player list cache:', error);
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
            console.error('Error getting player list cache timestamp:', error);
            return null;
        }
    }

    async isCacheStale(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const timestamp = await this.getCacheTimestamp();
        if (!timestamp) return true;
        
        return Date.now() - timestamp > maxAgeMs;
    }
}

module.exports = new PlayerListCache();