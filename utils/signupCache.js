const redisClient = require('./redisClient');

const SIGNUP_PREFIX = 'signup_';
const SIGNUP_TTL = 600; // 10 minutes in seconds

/**
 * Get signup session data for a user
 * @param {string} userId - Discord user ID
 * @returns {Object|null} Signup session data or null if not found
 */
async function getSignupData(userId) {
    try {
        await redisClient.connect();
        const client = redisClient.getClient();

        if (!client || !redisClient.isReady()) {
            console.log('Redis client not available for signup session');
            return null;
        }

        const key = `${SIGNUP_PREFIX}${userId}`;
        const data = await client.get(key);

        if (data) {
            console.log(`Retrieved signup session for user ${userId}`);
            return JSON.parse(data);
        }

        return null;
    } catch (error) {
        console.error('Error retrieving signup data:', error);
        return null;
    }
}

/**
 * Set signup session data for a user
 * @param {string} userId - Discord user ID
 * @param {Object} data - Signup session data
 * @returns {boolean} Success status
 */
async function setSignupData(userId, data) {
    try {
        await redisClient.connect();
        const client = redisClient.getClient();

        if (!client || !redisClient.isReady()) {
            console.error('Redis client not available for signup session storage');
            return false;
        }

        const key = `${SIGNUP_PREFIX}${userId}`;
        await client.setEx(key, SIGNUP_TTL, JSON.stringify(data));
        console.log(`Stored signup session for user ${userId}, TTL: ${SIGNUP_TTL}s`);
        return true;
    } catch (error) {
        console.error('Error storing signup data:', error);
        return false;
    }
}

/**
 * Clear signup session data for a user
 * @param {string} userId - Discord user ID
 * @returns {boolean} Success status
 */
async function clearSignupData(userId) {
    try {
        await redisClient.connect();
        const client = redisClient.getClient();

        if (!client || !redisClient.isReady()) {
            console.log('Redis client not available for clearing signup session');
            return false;
        }

        const key = `${SIGNUP_PREFIX}${userId}`;
        await client.del(key);
        console.log(`Cleared signup session for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error clearing signup data:', error);
        return false;
    }
}

module.exports = {
    getSignupData,
    setSignupData,
    clearSignupData
};
