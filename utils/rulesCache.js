const path = require('path');
const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const rulesParser = require('./rulesParser');
const redisClient = require('./redisClient');

const CACHE_KEY = 'dfc-data:rules-document';
const CACHE_TIMESTAMP_KEY = 'dfc-data:rules-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds

// Google Docs document ID for official DFC rules
const RULES_DOC_ID = process.env.RULES_DOC_ID || '1YwECuHx-N-24rsC4wUWYonhnWxKmdzKRpAtcPeHJpXE';

// Fallback to local file if all Google Docs attempts fail
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
            // Try Google Docs document first
            console.log(`Fetching rules from Google Doc (${RULES_DOC_ID})...`);
            try {
                const markdownText = await this.fetchFromGoogleDocs(RULES_DOC_ID);
                const rulesData = await rulesParser.parseMarkdown(markdownText);

                console.log('Rules parsed successfully from Google Doc');
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
            } catch (googleDocsError) {
                console.error('Google Doc fetch failed:', googleDocsError.message);

                // Try fallback to local markdown file (for local development)
                try {
                    console.log(`Attempting fallback to local file: ${RULES_FILE_PATH}...`);
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
                } catch (fileError) {
                    console.error('Local file fallback also failed:', fileError.message);
                    console.error('Rules cache unavailable - Google Docs API must be configured correctly');
                    throw new Error('Rules unavailable: Google Docs API failed and no local file. Ensure service account has access to document and Google Docs API is enabled.');
                }
            }
        } catch (error) {
            console.error('Error fetching and parsing rules:', error);
            throw error;
        }
    }

    /**
     * Fetch document content from Google Docs API and convert to markdown
     * @param {string} documentId - Google Docs document ID to fetch
     */
    async fetchFromGoogleDocs(documentId) {
        const docs = google.docs('v1');
        const auth = createGoogleAuth();

        try {
            const response = await docs.documents.get({
                auth,
                documentId: documentId
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

        // Track list nesting levels for proper numbering
        const listCounters = new Map();

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

                // Handle list numbering from bullet metadata
                let listPrefix = '';
                if (paragraph.bullet) {
                    const listId = paragraph.bullet.listId;
                    const nestingLevel = paragraph.bullet.nestingLevel || 0;
                    const listKey = `${listId}_${nestingLevel}`;

                    // Initialize or increment counter for this list level
                    if (!listCounters.has(listKey)) {
                        listCounters.set(listKey, 1);
                    } else {
                        listCounters.set(listKey, listCounters.get(listKey) + 1);
                    }

                    const counter = listCounters.get(listKey);
                    listPrefix = `${counter}. `;
                } else {
                    // Reset all counters when we exit lists
                    listCounters.clear();
                }

                // Preserve indentation from Google Docs paragraph style
                const paragraphStyle = paragraph.paragraphStyle || {};
                const indentStart = paragraphStyle.indentStart ? paragraphStyle.indentStart.magnitude : 0;

                // Convert indentation (Google Docs uses points, ~18pt = 1 indent level = 3 spaces)
                const indentLevel = Math.round(indentStart / 18);
                const indentation = '   '.repeat(Math.max(0, indentLevel));

                // Add the line with preserved indentation and list numbering
                lines.push(indentation + listPrefix + lineText.trimEnd());
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
