const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const rosterCache = require('../utils/rosterCache');

// Items per page to stay well within Discord's limits
const ITEMS_PER_PAGE = 10;

/**
 * Build embed for a specific page of mismatches
 * @param {Array} mismatches - All mismatches
 * @param {number} totalRosterEntries - Total roster entries
 * @param {number} page - Current page (0-indexed)
 * @returns {Object} - Discord message object with embed and components
 */
function buildNameSyncEmbed(mismatches, totalRosterEntries, page) {
    const totalPages = mismatches.length > 0 ? Math.ceil(mismatches.length / ITEMS_PER_PAGE) : 1;
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));

    const embed = new EmbedBuilder()
        .setColor(mismatches.length > 0 ? 0xFF6B6B : 0x51CF66)
        .setTitle('Discord Username Sync Check')
        .setDescription(`Cross-referencing **Roster** sheet (Column C: Discord Name) against live Discord usernames.\n\nTotal roster entries: **${totalRosterEntries}**`)
        .setTimestamp();

    if (mismatches.length > 0) {
        // Get items for current page
        const startIdx = currentPage * ITEMS_PER_PAGE;
        const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, mismatches.length);
        const pageMismatches = mismatches.slice(startIdx, endIdx);

        const mismatchText = pageMismatches
            .map(entry => `**${entry.arenaName}**\nCached: \`${entry.cachedName}\` → Current: \`${entry.currentName}\``)
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

    // Add pagination buttons if needed
    const components = [];
    if (mismatches.length > 0 && totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`namesync_page_${currentPage - 1}`)
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`namesync_page_${currentPage + 1}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );
        components.push(row);
    }

    return { embeds: [embed], components };
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

            // Build and send embed with pagination
            console.log(`[NAMESYNC] Building embed...`);
            const response = buildNameSyncEmbed(activeMismatches, Object.keys(roster).length, 0);

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

        // Parse page number from customId (format: namesync_page_N)
        if (!customId.startsWith('namesync_page_')) return;

        const page = parseInt(customId.split('_')[2]);
        if (isNaN(page)) return;

        console.log(`[NAMESYNC] Button clicked: page ${page} by ${interaction.user.username}`);

        try {
            await interaction.deferUpdate();

            // Re-fetch roster and recalculate mismatches
            const roster = await rosterCache.getCachedRoster();
            if (!roster || Object.keys(roster).length === 0) {
                return interaction.editReply({
                    content: '❌ Roster cache is empty. Try running `/refreshcache` first.',
                    embeds: [],
                    components: []
                });
            }

            // Fetch all guild members
            const allMembers = await interaction.guild.members.fetch({ force: false });

            // Recalculate mismatches
            const activeMismatches = [];
            for (const [uuid, rosterEntry] of Object.entries(roster)) {
                if (!uuid || uuid === 'undefined') continue;
                if (!rosterEntry.discordName) continue;

                const guildMember = allMembers.get(uuid);
                if (guildMember) {
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
                }
            }

            // Build embed for requested page
            const response = buildNameSyncEmbed(activeMismatches, Object.keys(roster).length, page);
            await interaction.editReply(response);

        } catch (error) {
            console.error(`[NAMESYNC] ERROR in handleButton:`, error);
            try {
                await interaction.editReply({
                    content: '❌ An error occurred while navigating pages.',
                    embeds: [],
                    components: []
                });
            } catch (replyError) {
                console.error(`[NAMESYNC] ERROR: Failed to send button error message:`, replyError);
            }
        }
    }
};
