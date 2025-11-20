const path = require('path');
const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const rulesParser = require('./rulesParser');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:rules-document';
const CACHE_TIMESTAMP_KEY = 'dfc-data:rules-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds

// Google Docs document ID
const RULES_DOC_ID = process.env.TEST_MODE === 'true'
    ? (process.env.TEST_RULES_DOC_ID || '1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE')
    : (process.env.PROD_RULES_DOC_ID || '1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE');

// Fallback to local file if Google Docs fails
const RULES_FILE_PATH = path.join(__dirname, '../docs/Official-DFC-Rules.md');

class RulesCache {
    constructor() {
        this.isRefreshing = false;
    }

    /**
     * Get cached rules data or fetch from markdown file if not available
     * Returns structured rules object
     */
    async getCachedData() {
        try {
            // Try to connect to Redis
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) {
                console.log('Redis client not available for rules, falling back to file parse');
                return await this.fetchLiveData();
            }

            const cachedData = await client.get(CACHE_KEY);

            if (cachedData) {
                console.log('Retrieved rules from Redis cache');
                return JSON.parse(cachedData);
            } else {
                console.log('No cached rules found, attempting to refresh cache');
                try {
                    return await this.refreshCache();
                } catch (refreshError) {
                    console.error('Rules cache refresh failed, falling back to file parse:', refreshError);
                    return await this.fetchLiveData();
                }
            }
        } catch (error) {
            console.error('Redis connection/operation failed for rules, falling back to file parse:', error);
            return await this.fetchLiveData();
        }
    }

    /**
     * Fetch rules data from Google Docs and parse
     */
    async fetchLiveData() {
        try {
            console.log(`Fetching rules from Google Docs (${RULES_DOC_ID})...`);

            // Try Google Docs API first
            try {
                const markdownText = await this.fetchFromGoogleDocs();
                const rulesData = await rulesParser.parseMarkdown(markdownText);

                console.log('Rules parsed successfully from Google Docs');
                console.log(`  - HLD classes: ${Object.keys(rulesData.hld.classes).length}`);
                console.log(`  - LLD classes: ${Object.keys(rulesData.lld.classes).length}`);
                console.log(`  - Images: ${Object.keys(rulesData.images).length}`);

                // Add metadata
                rulesData.metadata = {
                    lastFetched: new Date().toISOString(),
                    source: 'google-docs',
                    documentId: RULES_DOC_ID,
                    parseMethod: 'google-docs-api'
                };

                return rulesData;
            } catch (googleError) {
                console.error('Google Docs fetch failed, falling back to local file:', googleError);

                // Fallback to local markdown file
                console.log(`Parsing rules from local file: ${RULES_FILE_PATH}...`);
                const rulesData = await rulesParser.parseMarkdownFile(RULES_FILE_PATH);

                console.log('Rules parsed successfully from local file');
                console.log(`  - HLD classes: ${Object.keys(rulesData.hld.classes).length}`);
                console.log(`  - LLD classes: ${Object.keys(rulesData.lld.classes).length}`);
                console.log(`  - Images: ${Object.keys(rulesData.images).length}`);

                // Add metadata
                rulesData.metadata = {
                    lastFetched: new Date().toISOString(),
                    source: 'local-file',
                    filePath: RULES_FILE_PATH,
                    parseMethod: 'local-file-fallback'
                };

                return rulesData;
            }
        } catch (error) {
            console.error('Error fetching and parsing rules:', error);
            throw error;
        }
    }

    /**
     * Fetch document content from Google Docs API and convert to markdown
     */
    async fetchFromGoogleDocs() {
        const docs = google.docs('v1');
        const auth = createGoogleAuth();

        try {
            const response = await docs.documents.get({
                auth,
                documentId: RULES_DOC_ID
            });

            const document = response.data;
            console.log(`Fetched Google Doc: ${document.title}`);

            // Convert Google Docs JSON to markdown-like text
            const markdownText = this.convertGoogleDocsToMarkdown(document);
            return markdownText;
        } catch (error) {
            console.error('Error fetching from Google Docs API:', error);
            throw error;
        }
    }

    /**
     * Convert Google Docs JSON structure to markdown text
     */
    convertGoogleDocsToMarkdown(document) {
        const lines = [];

        if (!document.body || !document.body.content) {
            throw new Error('Invalid Google Docs document structure');
        }

        for (const element of document.body.content) {
            if (element.paragraph) {
                const paragraph = element.paragraph;
                let lineText = '';

                if (paragraph.elements) {
                    for (const textElement of paragraph.elements) {
                        if (textElement.textRun && textElement.textRun.content) {
                            const content = textElement.textRun.content;
                            const style = textElement.textRun.textStyle || {};

                            // Apply markdown formatting based on text style
                            let formattedContent = content;

                            if (style.bold && style.italic) {
                                formattedContent = `***${content.trim()}***`;
                            } else if (style.bold) {
                                formattedContent = `**${content.trim()}**`;
                            } else if (style.italic) {
                                formattedContent = `*${content.trim()}*`;
                            }

                            lineText += formattedContent;
                        }
                    }
                }

                // Add the line (preserving blank lines)
                lines.push(lineText.trimEnd());
            }
        }

        return lines.join('\n');
    }

    /**
     * Refresh the rules cache
     */
    async refreshCache() {
        if (this.isRefreshing) {
            console.log('Rules cache refresh already in progress, waiting...');
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            try {
                return await this.getCachedData();
            } catch (error) {
                console.error('Error after waiting for rules refresh, falling back to live data:', error);
                return await this.fetchLiveData();
            }
        }

        this.isRefreshing = true;

        try {
            console.log('Refreshing Rules cache...');
            const rulesData = await this.fetchLiveData();

            // Try to store in Redis, but don't fail if Redis is unavailable
            try {
                await redisClient.connect();
                const client = redisClient.getClient();

                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rulesData));
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                    console.log(`Rules cache refreshed, TTL: ${CACHE_TTL}s`);
                } else {
                    console.log('Redis not available for rules cache storage, but returning live data');
                }
            } catch (redisError) {
                console.error('Redis storage failed during rules refresh, but returning live data:', redisError);
            }

            return rulesData;
        } catch (error) {
            console.error('Error refreshing rules cache:', error);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Get rules for a specific class and format
     * @param {string} className - Character class name
     * @param {string} format - Duel format (HLD, LLD, Melee, Team)
     * @returns {Object|null} - Rules content or null if not found
     */
    async getRulesFor(className, format) {
        try {
            const rules = await this.getCachedData();

            if (!className && !format) {
                return rules; // Return all rules
            }

            if (format === 'HLD' && className) {
                return rules.hld.classes[className] || null;
            }

            if (format === 'LLD' && className) {
                return rules.lld.classes[className] || null;
            }

            if (format === 'HLD') {
                return rules.hld;
            }

            if (format === 'LLD') {
                return rules.lld;
            }

            if (format === 'Melee') {
                return rules.melee;
            }

            if (format === 'Team') {
                return rules.team;
            }

            // If only class is specified, return both HLD and LLD for that class
            if (className) {
                return {
                    hld: rules.hld.classes[className] || null,
                    lld: rules.lld.classes[className] || null
                };
            }

            return null;
        } catch (error) {
            console.error(`Error getting rules for ${className} ${format}:`, error);
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
            console.error('Error getting rules cache timestamp:', error);
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

module.exports = new RulesCache();
