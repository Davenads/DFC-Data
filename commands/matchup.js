const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matchup')
        .setDescription('Create matchups for the weekly fight card (requires manager role)'),
    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
        
        console.log(`[${timestamp}] Executing matchup command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);
        
        try {
            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Fetch existing matchups and create new ones
            // (Placeholder logic - replace with actual matchup creation logic)
            await sheets.spreadsheets.values.append({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Weekly Matchups!A:D',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['Matchup Placeholder', 'Pending']],
                },
            });

            await interaction.reply({ content: 'Matchups have been created successfully!', ephemeral: true });
            console.log(`[${timestamp}] Matchups created successfully by ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error creating matchups requested by ${user.tag} (${user.id})`;
            console.error(errorMessage, error);
            await interaction.reply({ content: 'Failed to create matchups. Please try again later.', ephemeral: true });
        }
    }
};
