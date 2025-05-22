const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportwin')
        .setDescription('Report the result of a match and update standings'),
    async execute(interaction, sheets, auth) {
        const matchResult = interaction.options.getString('result'); // Placeholder for match result input

        try {
            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Update match results in Google Sheets
            // (Placeholder logic - replace with actual result reporting logic)
            await sheets.spreadsheets.values.append({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Match Results!A:D',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['Reported Match', matchResult, 'Completed']],
                },
            });

            await interaction.reply({ content: 'The match result has been reported successfully!', ephemeral: true });
        } catch (error) {
            console.error('Error reporting match result:', error);
            await interaction.reply({ content: 'Failed to report match result. Please try again later.', ephemeral: true });
        }
    }
};