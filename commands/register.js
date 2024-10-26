const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register for the DFC event roster'),
    async execute(interaction, sheets, auth) {
        const discordName = interaction.user.username;

        try {
            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Fetch existing roster data to verify if the user is already registered
            const res = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Roster!A:D',
            });

            const roster = res.data.values || [];
            const isRegistered = roster.some(row => row[2] === discordName);

            if (isRegistered) {
                return interaction.reply('You are already registered.');
            }

            // Append new user to the roster
            await sheets.spreadsheets.values.append({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Roster!A:D',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[null, null, discordName, interaction.user.id]],
                },
            });

            await interaction.reply('You have been registered successfully!');
        } catch (error) {
            console.error('Error registering user:', error);
            await interaction.reply('Failed to register. Please try again later.');
        }
    }
};