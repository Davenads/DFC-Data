const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getClassEmoji } = require('../utils/emojis');
const signupsCache = require('../utils/signupsCache');
const rosterCache = require('../utils/rosterCache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('recentsignups')
        .setDescription('View recent tournament signups')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Filter signups by player (optional)')
                .setAutocomplete(true)
                .setRequired(false)),

    // Handle pagination buttons (return true to mark as handled by this command)
    async handleButton(interaction) {
        if (interaction.customId.startsWith('recentsignups_')) {
            // These buttons are handled by the message component collector
            // Return true to prevent the global handler from interfering
            return true;
        }
        return false;
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            // Fetch roster data from cache
            const roster = await rosterCache.getCachedRoster();

            // Get all registered players from roster
            const duelerPlayers = Object.entries(roster)
                .filter(([uuid, data]) => data.dataName) // Ensure dataName exists
                .map(([uuid, data]) => ({
                    arenaName: data.dataName,
                    discordName: data.discordName,
                    uuid: uuid
                }));

            const searchTerm = focusedValue.toLowerCase();

            // Filter by search term matching Arena Name or Discord name
            const filteredPlayers = duelerPlayers.filter(player =>
                player.arenaName.toLowerCase().includes(searchTerm) ||
                player.discordName.toLowerCase().includes(searchTerm)
            ).slice(0, 25); // Limit to 25 players to meet Discord's requirements

            const results = filteredPlayers.map(player => ({
                name: player.arenaName,
                value: player.arenaName
            }));

            // If no results found but search term exists, provide a manual entry option
            if (results.length === 0 && searchTerm.length > 0) {
                results.push({
                    name: `Type "${searchTerm}" manually (no matches found)`,
                    value: searchTerm
                });
            }

            await interaction.respond(results);
        } catch (error) {
            console.error('Error fetching roster for autocomplete:', error);

            // Provide fallback suggestions based on search term
            const searchTerm = focusedValue.toLowerCase();
            let fallbackResults = [];

            if (searchTerm.length > 0) {
                fallbackResults = [{
                    name: `Type "${searchTerm}" manually (autocomplete unavailable)`,
                    value: searchTerm
                }];
            }

            await interaction.respond(fallbackResults);
        }
    },

    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        // Get player filter if provided
        const playerName = interaction.options.getString('player');

        console.log(`[${timestamp}] Executing recentsignups command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})
        Player Filter: ${playerName || 'None'}`);

        try {
            await interaction.deferReply({ ephemeral: true });

            // If player filter is provided, look up their Discord username from roster
            let targetDiscordName = null;
            if (playerName) {
                const roster = await rosterCache.getCachedRoster();
                const rosterEntries = Object.values(roster);
                const playerInRoster = rosterEntries.find(entry =>
                    entry.arenaName && entry.arenaName.toLowerCase() === playerName.toLowerCase()
                );

                if (!playerInRoster) {
                    return interaction.editReply({
                        content: `⚠️ **Error**: Player **${playerName}** not found in roster.\n\nPlease make sure the player name is spelled correctly or select from the autocomplete suggestions.`,
                        ephemeral: true
                    });
                }

                targetDiscordName = playerInRoster.discordName;
                console.log(`[${timestamp}] Filtering signups for player: ${playerName} (Discord: ${targetDiscordName})`);
            }

            // Fetch signups from cache (falls back to Google Sheets if cache unavailable)
            const signups = await signupsCache.getCachedData();

            // Skip header row, filter out empty rows, optionally filter by player, sort by timestamp (newest first), and take top 20
            let recentSignups = signups
                .slice(1)
                .filter(row => row[0]); // Skip rows without timestamp

            // Apply player filter if specified
            if (targetDiscordName) {
                recentSignups = recentSignups.filter(row => {
                    const discordHandle = row[1]; // Column B - Discord Handle
                    return discordHandle && discordHandle.toLowerCase() === targetDiscordName.toLowerCase();
                });
            }

            // Sort by timestamp (newest first) and take top 20
            recentSignups = recentSignups
                .sort((a, b) => new Date(b[0]) - new Date(a[0])) // Newest first
                .slice(0, 50); // Take top 20

            if (recentSignups.length === 0) {
                const noSignupsMessage = playerName
                    ? `No recent signups found for **${playerName}**.`
                    : 'No recent signups found.';
                return interaction.editReply({ content: noSignupsMessage, ephemeral: true });
            }

            // Pagination setup
            const signupsPerPage = 5;
            const totalPages = Math.ceil(recentSignups.length / signupsPerPage);
            let currentPage = 1;

            // Create the embed for the current page
            const createEmbed = (page) => {
                const startIdx = (page - 1) * signupsPerPage;
                const endIdx = Math.min(startIdx + signupsPerPage, recentSignups.length);
                const currentSignups = recentSignups.slice(startIdx, endIdx);

                const embedTitle = playerName
                    ? `🏆 Recent Signups for ${playerName}`
                    : '🏆 Recent Tournament Signups';
                const embedDescription = playerName
                    ? `Showing ${recentSignups.length} most recent signup${recentSignups.length === 1 ? '' : 's'} for ${playerName}`
                    : `Showing the ${recentSignups.length} most recent signups`;

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(embedTitle)
                    .setDescription(embedDescription)
                    .setFooter({ text: `Page ${page}/${totalPages} · ${recentSignups.length} total signups` });
                
                // Add each signup as a field
                currentSignups.forEach(signup => {
                    // Parse the data from the row
                    const timestamp = new Date(signup[0]).toLocaleString('en-US', {
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    const discordHandle = signup[1] || 'Unknown';
                    const division = signup[2] || 'Unknown';
                    const characterClass = signup[3] || 'Unknown';
                    const buildType = signup[4] || 'Unknown';

                    // Determine emoji for class
                    let classEmoji = '⚔️'; // Default
                    if (characterClass.includes('Paladin')) classEmoji = getClassEmoji('Paladin');
                    else if (characterClass.includes('Necromancer')) classEmoji = getClassEmoji('Necromancer');
                    else if (characterClass.includes('Assassin')) classEmoji = getClassEmoji('Assassin');
                    else if (characterClass.includes('Druid')) classEmoji = getClassEmoji('Druid');
                    else if (characterClass.includes('Amazon')) classEmoji = getClassEmoji('Amazon');
                    else if (characterClass.includes('Sorceress')) classEmoji = getClassEmoji('Sorceress');
                    else if (characterClass.includes('Barbarian')) classEmoji = getClassEmoji('Barbarian');
                    
                    embed.addFields({
                        name: `${classEmoji} ${discordHandle}`,
                        value: `📅 ${timestamp}\n🏆 Division: **${division}**\n📋 Class: **${characterClass}**\n🔧 Build: **${buildType}**`,
                        inline: false
                    });
                });
                
                return embed;
            };
            
            // Create navigation buttons
            const createButtons = (page) => {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('recentsignups_previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId('recentsignups_next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages)
                    );
                return row;
            };
            
            // Send initial response
            const initialEmbed = createEmbed(currentPage);
            const initialButtons = createButtons(currentPage);
            
            const response = await interaction.editReply({
                embeds: [initialEmbed],
                components: totalPages > 1 ? [initialButtons] : []
            });
            
            // Handle pagination with button interactions
            if (totalPages > 1) {
                const collector = response.createMessageComponentCollector({ 
                    filter: i => i.user.id === interaction.user.id,
                    time: 60000 // Collect for 1 minute
                });
                
                collector.on('collect', async i => {
                    if (i.customId === 'recentsignups_previous') {
                        currentPage--;
                    } else if (i.customId === 'recentsignups_next') {
                        currentPage++;
                    }

                    await i.update({
                        embeds: [createEmbed(currentPage)],
                        components: [createButtons(currentPage)]
                    });
                });
                
                collector.on('end', async () => {
                    // Remove buttons when collector expires
                    await interaction.editReply({
                        embeds: [createEmbed(currentPage)],
                        components: []
                    }).catch(() => {});
                });
            }
            
            const filterInfo = playerName ? ` (filtered by player: ${playerName})` : '';
            console.log(`[${timestamp}] Recentsignups command completed successfully for ${user.tag} (${user.id})${filterInfo}`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error fetching recent signups for ${user.tag} (${user.id})`;
            console.error(errorMessage, error);
            await interaction.editReply({ content: 'An error occurred while fetching recent signups. Please try again later.', ephemeral: true });
        }
    }
};