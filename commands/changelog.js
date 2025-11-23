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
        const isSlash = !!interaction.commandName; // true for slash, false for prefix

        // Read changelog data
        const jsonPath = path.join(__dirname, '..', 'data', 'changelog.json');
        if (!fs.existsSync(jsonPath)) {
            return interaction.reply({
                content: 'Changelog data not found.',
                ephemeral: isSlash
            });
        }
        const { changes } = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        changes.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Split changelog into multiple messages to avoid 2000 char limit
        const messages = [];
        let currentMessage = '📜 **DFC Rule Change History**\n\n';
        const maxLength = 1900; // Leave some buffer

        changes.forEach(record => {
            const date = new Date(record.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            let matchTypeEmoji = '⚔️';
            if (record.matchType === 'HLD') matchTypeEmoji = '🏆';
            else if (record.matchType === 'Melee') matchTypeEmoji = '⚔️';
            else if (record.matchType === 'All') matchTypeEmoji = '🌐';

            const entryText = `${matchTypeEmoji} **${date}**\n${record.change}\n\n`;
            
            // Check if adding this entry would exceed the limit
            if (currentMessage.length + entryText.length > maxLength) {
                messages.push(currentMessage);
                currentMessage = entryText;
            } else {
                currentMessage += entryText;
            }
        });
        
        // Add the final message
        if (currentMessage.trim()) {
            messages.push(currentMessage);
        }

        if (isSlash) {
            // Slash command: send first message as reply, rest as follow-ups
            await interaction.reply({
                content: messages[0] || 'No changelog entries found.',
                ephemeral: true
            });
            
            for (let i = 1; i < messages.length; i++) {
                await interaction.followUp({
                    content: messages[i],
                    ephemeral: true
                });
            }
        } else {
            // Prefix command: DM all messages, react, and delete after 10s
            try {
                const dmChannel = await user.createDM();
                
                // Send all messages to DM
                for (const message of messages) {
                    await dmChannel.send(message);
                }
                
                // React to the original message
                if (interaction.channel && interaction.channel.messages && interaction.id) {
                    // Try to fetch and react to the original message
                    const msg = await interaction.channel.messages.fetch(interaction.id).catch(() => null);
                    if (msg) {
                        await msg.react('✅').catch(() => {});
                        setTimeout(() => msg.delete().catch(() => {}), 10000);
                    }
                }
            } catch (e) {
                await interaction.reply({
                    content: 'Could not DM you the changelog. Please check your DM settings.',
                });
            }
        }
    }
}; 