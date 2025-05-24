const { createClient } = require('redis');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) return this.client;

        try {
            this.client = createClient({
                url: process.env.REDISCLOUD_URL
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Connected to Redis Cloud');
                this.isConnected = true;
            });

            this.client.on('disconnect', () => {
                console.log('Disconnected from Redis Cloud');
                this.isConnected = false;
            });

            await this.client.connect();
            return this.client;
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
        }
    }

    getClient() {
        return this.client;
    }

    isReady() {
        return this.isConnected && this.client;
    }
}

module.exports = new RedisClient();