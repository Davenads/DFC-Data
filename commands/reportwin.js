const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportwin')
        .setDescription('Report the result of a match and update standings'),
    async execute(interaction, sheets, auth) {
        const matchResult = interaction.options.getString('result'); // Placeholder for match result input
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
        
        console.log(`[${timestamp}] Executing reportwin command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})
        Match Result: ${matchResult}`);

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
            console.log(`[${timestamp}] Reportwin command completed successfully for ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error reporting match result for ${user.tag} (${user.id})`;
            console.error(errorMessage, error);
            await interaction.reply({ content: 'Failed to report match result. Please try again later.', ephemeral: true });
        }
    }
};