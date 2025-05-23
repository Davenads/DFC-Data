const { SlashCommandBuilder } = require('@discordjs/builders');
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
            console.log(`[${timestamp}] Attempting to read changelog from: ${jsonPath}`);
            
            if (!fs.existsSync(jsonPath)) {
                throw new Error(`Changelog file not found at path: ${jsonPath}`);
            }

            const fileContent = fs.readFileSync(jsonPath, 'utf-8');
            console.log(`[${timestamp}] Successfully read changelog file, size: ${fileContent.length} bytes`);
            
            const { changes } = JSON.parse(fileContent);
            console.log(`[${timestamp}] Successfully parsed JSON, found ${changes.length} changes`);

            // Sort records by date (newest first)
            changes.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Create the message content
            let messageContent = '📜 **DFC Rule Change History**\n\n';
            
            changes.forEach(record => {
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

                messageContent += `${matchTypeEmoji} **${date}** (${record.matchType})\n${record.change}\n\n`;
            });

            console.log(`[${timestamp}] Created message content, length: ${messageContent.length} characters`);

            // Send the response as a DM
            const dmChannel = await user.createDM();
            console.log(`[${timestamp}] Created DM channel with user ${user.tag}`);
            
            await dmChannel.send(messageContent);
            console.log(`[${timestamp}] Successfully sent changelog to user ${user.tag}`);

            // Send ephemeral confirmation in the original channel
            await interaction.reply({ 
                content: 'I\'ve sent the changelog to your DMs!', 
                ephemeral: true 
            });

            console.log(`[${timestamp}] Changelog command completed successfully for ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error fetching changelog for ${user.tag} (${user.id}): ${error.message}`;
            console.error(errorMessage);
            console.error('Full error:', error);
            
            await interaction.reply({ 
                content: 'An error occurred while fetching the changelog. Please try again later.', 
                ephemeral: true 
            });
        }
    }
}; 