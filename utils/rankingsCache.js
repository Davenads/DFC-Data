const { google } = require('googleapis');
const { createGoogleAuth } = require('./googleAuth');
const redisClient = require('./redisClient');
const duelDataCache = require('./duelDataCache');

const CACHE_KEY_PREFIX = 'dfc-data:rankings:';
const CACHE_TIMESTAMP_KEY = 'dfc-data:rankings-timestamp';
const CACHE_TTL = 604800; // 1 week in seconds
const DAYS = 100; // Rankings based on last 100 days

class RankingsCache {
    constructor() {
        this.isRefreshing = false;
    }

    /**
     * Get cached rankings for a specific division
     * Falls back to computation if cache miss
     */
    async getRankings(division) {
        if (!['HLD', 'LLD', 'MELEE'].includes(division)) {
            throw new Error(`Invalid division: ${division}`);
        }

        try {
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) {
                console.log(`[rankingsCache] Redis not available for ${division}, computing live rankings`);
                return await this.computeRankings(division);
            }

            const cacheKey = `${CACHE_KEY_PREFIX}${division}`;
            const cachedData = await client.get(cacheKey);

            if (cachedData) {
                console.log(`[rankingsCache] Cache HIT for ${division}`);
                return JSON.parse(cachedData);
            } else {
                console.log(`[rankingsCache] Cache MISS for ${division}, computing...`);
                return await this.computeAndCache(division);
            }
        } catch (error) {
            console.error(`[rankingsCache] Error getting rankings for ${division}, falling back to computation:`, error);
            return await this.computeRankings(division);
        }
    }

    /**
     * Get champion information for all divisions
     * Returns: { HLD: {arenaName, dataName}, LLD: {...}, MELEE: {...} }
     */
    async getChampions() {
        try {
            const sheets = google.sheets('v4');
            const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
            const spreadsheetId = process.env.SPREADSHEET_ID;

            const rosterResponse = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId: spreadsheetId,
                range: 'Roster!A2:J500',
            });

            const rosterRows = rosterResponse.data.values || [];
            const champions = {
                HLD: null,
                LLD: null,
                MELEE: null
            };

            rosterRows.forEach(row => {
                const arenaName = row[0]; // Column A
                const dataName = row[1];  // Column B
                const currentChamp = row[6]; // Column G

                if (currentChamp && arenaName) {
                    const division = currentChamp.toUpperCase();
                    if (division === 'HLD' || division === 'LLD' || division === 'MELEE') {
                        champions[division] = { arenaName, dataName: dataName || arenaName };
                    }
                }
            });

            return champions;
        } catch (error) {
            console.error('[rankingsCache] Error fetching champions:', error);
            return { HLD: null, LLD: null, MELEE: null };
        }
    }

    /**
     * Compute rankings for a specific division
     * Does NOT cache the results
     */
    async computeRankings(division, duelData = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [rankingsCache] Computing rankings for ${division}...`);

        // Fetch duel data if not provided
        if (!duelData) {
            duelData = await duelDataCache.getCachedData();
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DAYS);

        // Filter matches within last 100 days
        const recentMatches = duelData.filter(row => {
            if (row.length < 9) return false;
            const matchDate = new Date(row[0]);
            return !isNaN(matchDate.getTime()) && matchDate >= cutoffDate;
        });

        console.log(`[${timestamp}] [rankingsCache] Filtered to ${recentMatches.length} matches in last ${DAYS} days`);

        // Calculate stats for the specific division
        const players = {};

        recentMatches.forEach((match) => {
            const winner = match[1];     // Column B
            const loser = match[4];      // Column E
            const matchType = (match[8] || '').toUpperCase(); // Column I
            const winnerRoundsLost = parseInt(match[7]) || 0; // Column H

            // Only process matches for this division
            if (matchType !== division) return;

            const loserRoundsLost = 3; // Standard Bo5 format

            // Track winner stats
            if (winner) {
                if (!players[winner]) {
                    players[winner] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
                }
                players[winner].wins++;
                players[winner].duels++;
                players[winner].roundsLost += winnerRoundsLost;
            }

            // Track loser stats
            if (loser) {
                if (!players[loser]) {
                    players[loser] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
                }
                players[loser].losses++;
                players[loser].duels++;
                players[loser].roundsLost += loserRoundsLost;
            }
        });

        // Calculate win%, ARL, and sort
        const sortedPlayers = Object.entries(players)
            .map(([name, stats]) => {
                const totalMatches = stats.wins + stats.losses;
                const winRate = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;
                const duels = stats.duels || totalMatches;
                const arl = duels > 0 ? (stats.roundsLost / duels) : 0;
                return {
                    name,
                    wins: stats.wins,
                    losses: stats.losses,
                    winRate,
                    totalMatches,
                    arl,
                    roundsLost: stats.roundsLost || 0,
                    duels
                };
            })
            .filter(p => p.totalMatches > 0)
            .sort((a, b) => {
                // Primary sort: wins (descending)
                if (b.wins !== a.wins) return b.wins - a.wins;
                // Tiebreaker 1: win% (descending)
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                // Tiebreaker 2: ARL (ascending - lower is better)
                return a.arl - b.arl;
            });

        console.log(`[${timestamp}] [rankingsCache] Computed ${sortedPlayers.length} ranked players for ${division}`);

        // Get top 30
        const top30 = sortedPlayers.slice(0, 30);

        // Fetch champion info
        const champions = await this.getChampions();
        const champion = champions[division];

        return {
            division,
            players: top30,
            champion,
            totalPlayers: sortedPlayers.length,
            computedAt: Date.now(),
            daysWindow: DAYS
        };
    }

    /**
     * Compute rankings and store in cache
     */
    async computeAndCache(division, duelData = null) {
        const rankings = await this.computeRankings(division, duelData);

        // Try to cache the results
        try {
            await redisClient.connect();
            const client = redisClient.getClient();

            if (client && redisClient.isReady()) {
                const cacheKey = `${CACHE_KEY_PREFIX}${division}`;
                await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(rankings));
                console.log(`[rankingsCache] Cached rankings for ${division} (${rankings.players.length} players)`);
            } else {
                console.log(`[rankingsCache] Redis not available, returning computed rankings without caching`);
            }
        } catch (error) {
            console.error(`[rankingsCache] Error caching rankings for ${division}:`, error);
            // Continue anyway, return the computed rankings
        }

        return rankings;
    }

    /**
     * Refresh all divisions (HLD, LLD, MELEE)
     * Called during scheduled cache refreshes
     */
    async refreshAllDivisions() {
        if (this.isRefreshing) {
            console.log('[rankingsCache] Refresh already in progress, skipping...');
            return;
        }

        this.isRefreshing = true;
        const timestamp = new Date().toISOString();

        try {
            console.log(`[${timestamp}] [rankingsCache] Starting refresh of all divisions...`);

            // Fetch duel data once for efficiency
            const duelData = await duelDataCache.getCachedData();
            console.log(`[${timestamp}] [rankingsCache] Fetched ${duelData.length} duel data rows`);

            // Compute all 3 divisions in parallel
            const [hldRankings, lldRankings, meleeRankings] = await Promise.all([
                this.computeAndCache('HLD', duelData),
                this.computeAndCache('LLD', duelData),
                this.computeAndCache('MELEE', duelData)
            ]);

            // Update timestamp
            try {
                await redisClient.connect();
                const client = redisClient.getClient();

                if (client && redisClient.isReady()) {
                    await client.setEx(CACHE_TIMESTAMP_KEY, CACHE_TTL, Date.now().toString());
                }
            } catch (error) {
                console.error('[rankingsCache] Error updating timestamp:', error);
            }

            console.log(`[${timestamp}] [rankingsCache] ✅ All divisions refreshed successfully`);
            console.log(`[${timestamp}] [rankingsCache] - HLD: ${hldRankings.players.length} players`);
            console.log(`[${timestamp}] [rankingsCache] - LLD: ${lldRankings.players.length} players`);
            console.log(`[${timestamp}] [rankingsCache] - MELEE: ${meleeRankings.players.length} players`);

            return {
                HLD: hldRankings,
                LLD: lldRankings,
                MELEE: meleeRankings
            };
        } catch (error) {
            console.error(`[${timestamp}] [rankingsCache] ❌ Error refreshing divisions:`, error);
            throw error;
        } finally {
            this.isRefreshing = false;
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
            console.error('[rankingsCache] Error getting cache timestamp:', error);
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

    /**
     * Clear all rankings cache
     */
    async clearCache() {
        try {
            await redisClient.connect();
            const client = redisClient.getClient();

            if (!client || !redisClient.isReady()) {
                console.log('[rankingsCache] Redis not available, cannot clear cache');
                return;
            }

            await Promise.all([
                client.del(`${CACHE_KEY_PREFIX}HLD`),
                client.del(`${CACHE_KEY_PREFIX}LLD`),
                client.del(`${CACHE_KEY_PREFIX}MELEE`),
                client.del(CACHE_TIMESTAMP_KEY)
            ]);

            console.log('[rankingsCache] ✅ Cache cleared for all divisions');
        } catch (error) {
            console.error('[rankingsCache] Error clearing cache:', error);
        }
    }
}

module.exports = new RankingsCache();
