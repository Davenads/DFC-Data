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

        let messageContent = '📜 **DFC Rule Change History**\n\n';
        changes.forEach(record => {
            const date = new Date(record.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            let matchTypeEmoji = '⚔️';
            if (record.matchType === 'HLD') matchTypeEmoji = '🏆';
            else if (record.matchType === 'Melee') matchTypeEmoji = '⚔️';
            else if (record.matchType === 'All') matchTypeEmoji = '🌐';
            messageContent += `${matchTypeEmoji} **${date}** (${record.matchType})\n${record.change}\n\n`;
        });

        if (isSlash) {
            // Slash command: ephemeral channel response
            await interaction.reply({
                content: messageContent,
                ephemeral: true
            });
        } else {
            // Prefix command: DM, react, and delete after 10s
            try {
                const dmChannel = await user.createDM();
                await dmChannel.send(messageContent);
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