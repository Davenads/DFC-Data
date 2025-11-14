const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const rosterCache = require('../utils/rosterCache');
const redis = require('../utils/redisClient');
const { google } = require('googleapis');
const googleAuth = require('../utils/googleAuth');

// Items per page to stay well within Discord's limits
const ITEMS_PER_PAGE = 10;

/**
 * Build embed for a specific page of mismatches
 * @param {Array} mismatches - All mismatches
 * @param {number} totalRosterEntries - Total roster entries
 * @param {number} page - Current page (0-indexed)
 * @param {string} userId - User ID for button identification
 * @returns {Object} - Discord message object with embed and components
 */
function buildNameSyncEmbed(mismatches, totalRosterEntries, page, userId) {
    const totalPages = mismatches.length > 0 ? Math.ceil(mismatches.length / ITEMS_PER_PAGE) : 1;
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));

    const embed = new EmbedBuilder()
        .setColor(mismatches.length > 0 ? 0xFF6B6B : 0x51CF66)
        .setTitle('Discord Username Sync Check')
        .setDescription(`Cross-referencing **Roster** sheet (Column C: Discord Name) against live Discord usernames.\n\n🟧 Roster Cache | 🟢 Live Discord\n\nTotal roster entries: **${totalRosterEntries}**`)
        .setTimestamp();

    if (mismatches.length > 0) {
        // Get items for current page
        const startIdx = currentPage * ITEMS_PER_PAGE;
        const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, mismatches.length);
        const pageMismatches = mismatches.slice(startIdx, endIdx);

        const mismatchText = pageMismatches
            .map(entry => `**${entry.arenaName}**\n🟧 \`${entry.cachedName}\` → 🟢 \`${entry.currentName}\``)
            .join('\n\n');

        embed.addFields({
            name: `⚠️ Active Mismatches (${mismatches.length} total)`,
            value: mismatchText
        });

        // Add page indicator if multiple pages
        if (totalPages > 1) {
            embed.setFooter({
                text: `Page ${currentPage + 1} of ${totalPages} • ${mismatches.length} mismatch${mismatches.length !== 1 ? 'es' : ''} found`
            });
        } else {
            embed.setFooter({
                text: `${mismatches.length} mismatch${mismatches.length !== 1 ? 'es' : ''} found`
            });
        }
    } else {
        embed.addFields({
            name: '✅ No Mismatches Found',
            value: 'All active users have synchronized Discord names!'
        });
        embed.setFooter({ text: '0 mismatches found' });
    }

    // Add buttons
    const components = [];

    // Pagination buttons (if multiple pages)
    if (mismatches.length > 0 && totalPages > 1) {
        const paginationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`namesync_page_${userId}_${currentPage - 1}`)
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`namesync_page_${userId}_${currentPage + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );
        components.push(paginationRow);
    }

    // Update Test Sheet button (if there are mismatches)
    if (mismatches.length > 0) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`namesync_update_${userId}`)
                    .setLabel('📝 Update Test Sheet')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(actionRow);
    }

    return { embeds: [embed], components };
}

/**
 * Update 'Roster Test' sheet Column C with live Discord names for mismatched players
 * @param {Object} interaction - Discord interaction
 * @param {Array} mismatches - Array of mismatch objects
 */
async function handleUpdateTestSheet(interaction, mismatches) {
    try {
        const auth = await googleAuth.authorize();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.TEST_MODE === 'true' ? process.env.TEST_SSOT_ID : process.env.PROD_SSOT_ID;

        // Fetch existing 'Roster Test' data
        console.log(`[NAMESYNC] Fetching Roster Test sheet data...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Roster Test!A:D',
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            return interaction.editReply({
                content: '❌ Roster Test sheet is empty.',
                embeds: [],
                components: []
            });
        }

        // Create a map of UUID -> current Discord name for quick lookup
        const mismatchMap = new Map();
        mismatches.forEach(m => {
            mismatchMap.set(m.uuid, m.currentName);
        });

        // Update Column C (index 2) for matching UUIDs
        let updatedCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const uuid = row[3]; // Column D (UUID)

            if (uuid && mismatchMap.has(uuid)) {
                row[2] = mismatchMap.get(uuid); // Update Column C (Discord Name)
                updatedCount++;
            }
        }

        if (updatedCount === 0) {
            return interaction.editReply({
                content: '❌ No matching entries found in Roster Test sheet.',
                embeds: [],
                components: []
            });
        }

        // Write updated data back to sheet
        console.log(`[NAMESYNC] Updating ${updatedCount} entries in Roster Test sheet...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Roster Test!A:D',
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        console.log(`[NAMESYNC] Successfully updated ${updatedCount} entries in Roster Test sheet`);

        // Send success message
        const successEmbed = new EmbedBuilder()
            .setColor(0x51CF66)
            .setTitle('✅ Roster Test Sheet Updated')
            .setDescription(`Updated **${updatedCount}** Discord name${updatedCount !== 1 ? 's' : ''} in the **Roster Test** sheet (Column C).\n\nPlease review the changes and manually copy Column C to the production **Roster** sheet when ready.`)
            .setTimestamp();

        await interaction.editReply({
            embeds: [successEmbed],
            components: []
        });

    } catch (error) {
        console.error(`[NAMESYNC] ERROR in handleUpdateTestSheet:`, error);
        await interaction.editReply({
            content: '❌ Failed to update Roster Test sheet. Please check logs and try again.',
            embeds: [],
            components: []
        });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('namesync')
        .setDescription('Check for Discord username mismatches in the roster'),

    async execute(interaction) {
        const startTime = Date.now();
        const invokedBy = `${interaction.user.username} (${interaction.user.id})`;
        console.log(`[NAMESYNC] Command invoked by ${invokedBy} at ${new Date().toISOString()}`);

        try {
            // Check for Moderator role
            console.log(`[NAMESYNC] Checking Moderator role for ${invokedBy}`);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const moderatorRole = interaction.guild.roles.cache.find(role => role.name === 'Moderator');

            if (!moderatorRole || !member.roles.cache.has(moderatorRole.id)) {
                console.log(`[NAMESYNC] Permission denied for ${invokedBy} - missing Moderator role`);
                return interaction.reply({
                    content: '❌ You must have the Moderator role to use this command.',
                    ephemeral: true
                });
            }

            console.log(`[NAMESYNC] Deferring reply for ${invokedBy}`);
            await interaction.deferReply({ ephemeral: true });

            // Get cached roster
            console.log(`[NAMESYNC] Retrieving roster from cache...`);
            const cacheStart = Date.now();
            const roster = await rosterCache.getCachedRoster();
            console.log(`[NAMESYNC] Roster retrieved in ${Date.now() - cacheStart}ms`);

            if (!roster || Object.keys(roster).length === 0) {
                console.log(`[NAMESYNC] ERROR: Roster cache is empty`);
                return interaction.editReply({
                    content: '❌ Roster cache is empty. Try running `/refreshcache` first.'
                });
            }

            console.log(`[NAMESYNC] Processing ${Object.keys(roster).length} roster entries...`);

            const activeMismatches = [];
            let checkedCount = 0;
            let notInServerCount = 0;

            // Fetch all guild members at once to avoid timeout issues
            console.log(`[NAMESYNC] Fetching all guild members...`);
            let allMembers;
            try {
                allMembers = await interaction.guild.members.fetch({ force: false });
                console.log(`[NAMESYNC] Fetched ${allMembers.size} guild members`);
            } catch (fetchError) {
                console.error(`[NAMESYNC] ERROR: Failed to fetch guild members:`, fetchError);
                return interaction.editReply({
                    content: '❌ Failed to fetch guild members. The server may be too large or Discord is experiencing issues. Please try again later.'
                });
            }

            // Update user with progress
            await interaction.editReply({
                content: `🔄 Checking ${Object.keys(roster).length} roster entries against ${allMembers.size} guild members...`
            });

            // Iterate through roster entries and check against fetched members
            for (const [uuid, rosterEntry] of Object.entries(roster)) {
                // Skip entries without UUID (shouldn't happen, but defensive)
                if (!uuid || uuid === 'undefined') continue;

                // Skip entries without cached Discord name
                if (!rosterEntry.discordName) continue;

                // Look up member in the already-fetched collection
                const guildMember = allMembers.get(uuid);

                if (guildMember) {
                    checkedCount++;
                    // User is in server - compare current username with cached name from roster
                    const currentUsername = guildMember.user.username;
                    const cachedUsername = rosterEntry.discordName;

                    if (currentUsername !== cachedUsername) {
                        activeMismatches.push({
                            arenaName: rosterEntry.arenaName,
                            cachedName: cachedUsername,
                            currentName: currentUsername,
                            uuid: uuid
                        });
                    }
                } else {
                    // User not in server anymore
                    notInServerCount++;
                }
            }

            console.log(`[NAMESYNC] Checked ${checkedCount} active members, ${notInServerCount} not in server, found ${activeMismatches.length} mismatches`);

            console.log(`[NAMESYNC] Found ${activeMismatches.length} mismatches out of ${Object.keys(roster).length} entries`);

            // Store mismatches in Redis with 15min TTL (Discord interaction expiry)
            const cacheKey = `namesync:${interaction.user.id}`;
            const cacheData = {
                mismatches: activeMismatches,
                totalRosterEntries: Object.keys(roster).length,
                timestamp: Date.now()
            };

            try {
                await redis.connect();
                const client = redis.getClient();
                if (client && redis.isReady()) {
                    await client.setEx(cacheKey, 900, JSON.stringify(cacheData)); // 900s = 15min
                    console.log(`[NAMESYNC] Stored ${activeMismatches.length} mismatches in Redis with key: ${cacheKey}`);
                } else {
                    console.log(`[NAMESYNC] Redis not available, skipping cache storage`);
                }
            } catch (redisError) {
                console.error(`[NAMESYNC] ERROR: Failed to store in Redis:`, redisError);
                // Continue anyway - pagination will just recalculate if needed
            }

            // Build and send embed with pagination
            console.log(`[NAMESYNC] Building embed...`);
            const response = buildNameSyncEmbed(activeMismatches, Object.keys(roster).length, 0, interaction.user.id);

            console.log(`[NAMESYNC] Sending embed reply...`);
            await interaction.editReply(response);

            const totalTime = Date.now() - startTime;
            console.log(`[NAMESYNC] Command completed successfully in ${totalTime}ms for ${invokedBy}`);

        } catch (error) {
            console.error(`[NAMESYNC] ERROR: Command failed for ${invokedBy}:`, error);
            console.error(`[NAMESYNC] Error stack:`, error.stack);

            try {
                // Check if we've already replied/deferred
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: '❌ An error occurred while checking name synchronization. Please try again later.'
                    });
                } else {
                    await interaction.reply({
                        content: '❌ An error occurred while checking name synchronization. Please try again later.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error(`[NAMESYNC] ERROR: Failed to send error message:`, replyError);
            }
        }
    },

    async handleButton(interaction) {
        const customId = interaction.customId;

        // Parse customId (format: namesync_page_userId_pageNum OR namesync_update_userId)
        if (!customId.startsWith('namesync_')) return;

        const parts = customId.split('_');
        const action = parts[1]; // 'page' or 'update'
        const userId = parts[2];

        // Verify user owns this interaction
        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ You can only interact with your own namesync results.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferUpdate();

            // Fetch cached data from Redis
            const cacheKey = `namesync:${userId}`;
            let cacheData;

            try {
                await redis.connect();
                const client = redis.getClient();

                if (!client || !redis.isReady()) {
                    return interaction.editReply({
                        content: '❌ Redis not available. Please run `/namesync` again.',
                        embeds: [],
                        components: []
                    });
                }

                const cachedJson = await client.get(cacheKey);
                if (!cachedJson) {
                    return interaction.editReply({
                        content: '❌ Session expired. Please run `/namesync` again.',
                        embeds: [],
                        components: []
                    });
                }
                cacheData = JSON.parse(cachedJson);
            } catch (redisError) {
                console.error(`[NAMESYNC] ERROR: Failed to read from Redis:`, redisError);
                return interaction.editReply({
                    content: '❌ Failed to retrieve session data. Please run `/namesync` again.',
                    embeds: [],
                    components: []
                });
            }

            if (action === 'page') {
                // Handle pagination
                const page = parseInt(parts[3]);
                if (isNaN(page)) return;

                console.log(`[NAMESYNC] Pagination: page ${page} by ${interaction.user.username}`);

                const response = buildNameSyncEmbed(cacheData.mismatches, cacheData.totalRosterEntries, page, userId);
                await interaction.editReply(response);

            } else if (action === 'update') {
                // Handle updating Roster Test sheet
                console.log(`[NAMESYNC] Update Test Sheet clicked by ${interaction.user.username}`);
                await handleUpdateTestSheet(interaction, cacheData.mismatches);
            }

        } catch (error) {
            console.error(`[NAMESYNC] ERROR in handleButton:`, error);
            try {
                await interaction.editReply({
                    content: '❌ An error occurred. Please try again.',
                    embeds: [],
                    components: []
                });
            } catch (replyError) {
                console.error(`[NAMESYNC] ERROR: Failed to send button error message:`, replyError);
            }
        }
    }
};
