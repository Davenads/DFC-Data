const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const rosterCache = require('../utils/rosterCache');

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
            await interaction.deferReply();

            // Fetch all guild members into cache
            console.log(`[NAMESYNC] Fetching guild members...`);
            const fetchStart = Date.now();
            await interaction.guild.members.fetch();
            console.log(`[NAMESYNC] Guild members fetched in ${Date.now() - fetchStart}ms`);

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

            // Iterate through roster entries
            for (const [uuid, rosterEntry] of Object.entries(roster)) {
                // Skip entries without UUID (shouldn't happen, but defensive)
                if (!uuid || uuid === 'undefined') continue;

                // Skip entries without cached Discord name
                if (!rosterEntry.discordName) continue;

                // Try to find member in guild
                const guildMember = interaction.guild.members.cache.get(uuid);

                // Only check users currently in the server
                if (guildMember) {
                    // User is in server - compare names
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

            console.log(`[NAMESYNC] Found ${activeMismatches.length} mismatches out of ${Object.keys(roster).length} entries`);

            // Build embed
            console.log(`[NAMESYNC] Building embed...`);
            const totalRosterEntries = Object.keys(roster).length;
            const embed = new EmbedBuilder()
                .setColor(activeMismatches.length > 0 ? 0xFF6B6B : 0x51CF66)
                .setTitle('Discord Username Sync Check')
                .setDescription(`Cross-referencing **Roster** sheet (Column C: Discord Name) against live Discord usernames.\n\nTotal roster entries: **${totalRosterEntries}**`)
                .setTimestamp();

            // Add active mismatches section
            if (activeMismatches.length > 0) {
                // Limit display to prevent exceeding 6000 char embed limit
                const MAX_DISPLAY = 15;
                const displayMismatches = activeMismatches.slice(0, MAX_DISPLAY);
                const hasMore = activeMismatches.length > MAX_DISPLAY;

                const mismatchText = displayMismatches
                    .map(entry => `**${entry.arenaName}**\nCached: \`${entry.cachedName}\` → Current: \`${entry.currentName}\``)
                    .join('\n\n');

                // Check if we need to split into multiple fields
                if (mismatchText.length > 1024) {
                    const chunks = [];
                    let currentChunk = '';

                    for (const entry of displayMismatches) {
                        const line = `**${entry.arenaName}**\nCached: \`${entry.cachedName}\` → Current: \`${entry.currentName}\`\n\n`;

                        if ((currentChunk + line).length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = line;
                        } else {
                            currentChunk += line;
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    // Add first chunk as main field
                    embed.addFields({
                        name: `⚠️ Active Mismatches (${activeMismatches.length})`,
                        value: chunks[0]
                    });

                    // Add additional chunks as continuation fields
                    for (let i = 1; i < chunks.length; i++) {
                        embed.addFields({
                            name: `⚠️ Active Mismatches (continued)`,
                            value: chunks[i]
                        });
                    }
                } else {
                    embed.addFields({
                        name: `⚠️ Active Mismatches (${activeMismatches.length})`,
                        value: mismatchText
                    });
                }

                // Add truncation notice if needed
                if (hasMore) {
                    embed.addFields({
                        name: '📋 Note',
                        value: `Showing first ${MAX_DISPLAY} of ${activeMismatches.length} mismatches to stay within Discord's character limits.`
                    });
                }
            } else {
                embed.addFields({
                    name: '✅ No Mismatches Found',
                    value: 'All active users have synchronized Discord names!'
                });
            }

            // Add summary footer
            embed.setFooter({
                text: `${activeMismatches.length} mismatch${activeMismatches.length !== 1 ? 'es' : ''} found • Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
            });

            console.log(`[NAMESYNC] Sending embed reply...`);
            await interaction.editReply({ embeds: [embed] });

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
    }
};
