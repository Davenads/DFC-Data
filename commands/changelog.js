const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('View the history of DFC rule changes'),

    async execute(interaction) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
        
        console.log(`[${timestamp}] Executing changelog command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);

        try {
            // Read and parse the JSON file
            const jsonPath = path.join(__dirname, '..', 'data', 'changelog.json');
            const fileContent = fs.readFileSync(jsonPath, 'utf-8');
            const { changes } = JSON.parse(fileContent);

            // Sort records by date (newest first)
            changes.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Pagination setup
            const itemsPerPage = 5;
            const totalPages = Math.ceil(changes.length / itemsPerPage);
            let currentPage = 1;

            // Create the embed for the current page
            const createEmbed = (page) => {
                const startIdx = (page - 1) * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, changes.length);
                const currentRecords = changes.slice(startIdx, endIdx);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('📜 DFC Rule Change History')
                    .setDescription('A chronological list of rule changes in DFC tournaments')
                    .setFooter({ text: `Page ${page}/${totalPages} · ${changes.length} total changes` });

                currentRecords.forEach(record => {
                    const date = new Date(record.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    // Determine emoji based on match type
                    let matchTypeEmoji = '⚔️'; // Default
                    if (record.matchType === 'HLD') matchTypeEmoji = '🏆';
                    else if (record.matchType === 'Melee') matchTypeEmoji = '⚔️';
                    else if (record.matchType === 'All') matchTypeEmoji = '🌐';

                    embed.addFields({
                        name: `${matchTypeEmoji} ${date} (${record.matchType})`,
                        value: record.change,
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
                            .setCustomId('previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages)
                    );
                return row;
            };

            // Send initial response
            const initialEmbed = createEmbed(currentPage);
            const initialButtons = createButtons(currentPage);
            
            const response = await interaction.reply({
                embeds: [initialEmbed],
                components: totalPages > 1 ? [initialButtons] : [],
                ephemeral: true
            });

            // Handle pagination with button interactions
            if (totalPages > 1) {
                const collector = response.createMessageComponentCollector({ 
                    time: 300000 // 5 minute timeout
                });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ 
                            content: 'Only the command user can use these buttons.', 
                            ephemeral: true 
                        });
                    }

                    if (i.customId === 'previous') {
                        currentPage--;
                    } else if (i.customId === 'next') {
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

            console.log(`[${timestamp}] Changelog command completed successfully for ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error fetching changelog for ${user.tag} (${user.id})`;
            console.error(errorMessage, error);
            await interaction.reply({ 
                content: 'An error occurred while fetching the changelog. Please try again later.', 
                ephemeral: true 
            });
        }
    }
}; 