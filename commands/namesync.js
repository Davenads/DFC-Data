const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const rosterCache = require('../utils/rosterCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('namesync')
        .setDescription('Check for Discord username mismatches in the roster'),

    async execute(interaction) {
        // Check for Moderator role
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const moderatorRole = interaction.guild.roles.cache.find(role => role.name === 'Moderator');

        if (!moderatorRole || !member.roles.cache.has(moderatorRole.id)) {
            return interaction.reply({
                content: '❌ You must have the Moderator role to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Fetch all guild members into cache
            await interaction.guild.members.fetch();

            // Get cached roster
            const roster = await rosterCache.getCachedRoster();

            if (!roster || Object.keys(roster).length === 0) {
                return interaction.editReply({
                    content: '❌ Roster cache is empty. Try running `/refreshcache` first.',
                    ephemeral: true
                });
            }

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

            // Build embed
            const totalRosterEntries = Object.keys(roster).length;
            const embed = new EmbedBuilder()
                .setColor(activeMismatches.length > 0 ? 0xFF6B6B : 0x51CF66)
                .setTitle('Discord Username Sync Check')
                .setDescription(`Cross-referencing **Roster** sheet (Column C: Discord Name) against live Discord usernames.\n\nTotal roster entries: **${totalRosterEntries}**`)
                .setTimestamp();

            // Add active mismatches section
            if (activeMismatches.length > 0) {
                const mismatchText = activeMismatches
                    .map(entry => `**${entry.arenaName}**\nCached: \`${entry.cachedName}\` → Current: \`${entry.currentName}\``)
                    .join('\n\n');

                // Check if we need to truncate
                if (mismatchText.length > 1024) {
                    // Split into multiple fields
                    const chunks = [];
                    let currentChunk = '';

                    for (const entry of activeMismatches) {
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
            } else {
                embed.addFields({
                    name: '✅ No Mismatches Found',
                    value: 'All active users have synchronized Discord names!'
                });
            }

            // Add summary footer
            embed.setFooter({
                text: `${activeMismatches.length} mismatch${activeMismatches.length !== 1 ? 'es' : ''} found`
            });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in namesync command:', error);
            return interaction.editReply({
                content: '❌ An error occurred while checking name synchronization. Please try again later.',
                ephemeral: true
            });
        }
    }
};
