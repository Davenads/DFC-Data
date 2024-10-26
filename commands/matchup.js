const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matchup')
        .setDescription('Create matchups for the weekly fight card (requires manager role)'),
    async execute(interaction, sheets, auth) {
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

            await interaction.reply('Matchups have been created successfully!');
        } catch (error) {
            console.error('Error creating matchups:', error);
            await interaction.reply('Failed to create matchups. Please try again later.');
        }
    }
};
