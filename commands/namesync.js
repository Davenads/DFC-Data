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

        await interaction.deferReply({ ephemeral: true });

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
            const leftUsers = [];

            // Iterate through roster entries
            for (const [uuid, rosterEntry] of Object.entries(roster)) {
                // Skip entries without UUID (shouldn't happen, but defensive)
                if (!uuid || uuid === 'undefined') continue;

                // Skip entries without cached Discord name
                if (!rosterEntry.discordName) continue;

                // Try to find member in guild
                const guildMember = interaction.guild.members.cache.get(uuid);

                if (!guildMember) {
                    // User has left the server
                    leftUsers.push({
                        arenaName: rosterEntry.arenaName,
                        cachedName: rosterEntry.discordName,
                        uuid: uuid
                    });
                } else {
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
            const embed = new EmbedBuilder()
                .setColor(activeMismatches.length > 0 ? 0xFF6B6B : 0x51CF66)
                .setTitle('Discord Username Sync Check')
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
                    name: '✅ Active Mismatches',
                    value: 'All active users have synchronized Discord names!'
                });
            }

            // Add left users section
            if (leftUsers.length > 0) {
                const leftText = leftUsers
                    .map(entry => `**${entry.arenaName}**\nLast known: \`${entry.cachedName}\``)
                    .join('\n');

                // Check if we need to truncate
                if (leftText.length > 1024) {
                    const truncatedText = leftText.substring(0, 1000) + `\n... and ${leftUsers.length - leftText.substring(0, 1000).split('\n').filter(line => line.includes('**')).length} more`;
                    embed.addFields({
                        name: `👋 Left Server (${leftUsers.length})`,
                        value: truncatedText
                    });
                } else {
                    embed.addFields({
                        name: `👋 Left Server (${leftUsers.length})`,
                        value: leftText
                    });
                }
            }

            // Add summary footer
            const totalChecked = Object.keys(roster).length;
            embed.setFooter({
                text: `Checked ${totalChecked} roster entries | ${activeMismatches.length} mismatches | ${leftUsers.length} left server`
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
