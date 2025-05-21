const NodeCache = require('node-cache');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

// Create a cache instance
const cache = new NodeCache({ stdTTL: 300 }); // Cache expires in 300 seconds (5 minutes)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register for the DFC event roster')
        .addStringOption(option =>
            option.setName('dueler_name')
                .setDescription('The name of the dueler to register')
                .setRequired(true)),
    async execute(interaction, sheets, auth) {
        const discordName = interaction.user.username;
        const duelerName = interaction.options.getString('dueler_name');
        const userId = interaction.user.id;

        try {
            // Check cached data to verify if the user is already registered
            if (process.env.FORCE_CACHE_REFRESH === 'true') {
                cache.del('uuids'); // Delete the cache to force a refresh if FORCE_CACHE_REFRESH is set
            }
            let cachedUuids = cache.get('uuids');
            if (!cachedUuids) {
                // Use the auth object directly as it's already a JWT client
                const updatedRes = await sheets.spreadsheets.values.get({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: 'Roster!D:D',
                });
                cachedUuids = updatedRes.data.values.flat();
                cache.set('uuids', cachedUuids);
            }
            if (cachedUuids.includes(userId)) {
                return interaction.reply('You are already registered. Your UUID is already present in our data.');
            }

            // Use the auth object directly as it's already a JWT client
            
            // Fetch existing roster data to verify if the user is already registered
            const res = await sheets.spreadsheets.values.get({
                auth: auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Roster!A:D',
            });

            const roster = res.data.values || [];
            const isRegistered = roster.some(row => row[3] === userId);

            if (isRegistered) {
                return interaction.reply('You are already registered. Your UUID is already present in our data.');
            }

            // Find the first available row
            const nextRow = roster.length + 1;

            try {
                // Append new user to the roster with the required columns
                await sheets.spreadsheets.values.update({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: `Roster!A${nextRow}:D${nextRow}`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [[duelerName, duelerName, discordName, userId]],
                    },
                });
            } catch (error) {
                console.error('Error appending new user to Google Sheets:', error);
                return interaction.reply('Failed to register. Please try again later.');
            }

            try {
                // Re-cache UUID data for /signup command
                const updatedRes = await sheets.spreadsheets.values.get({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: 'Roster!D:D',
                });
                const uuids = updatedRes.data.values.flat();
                cache.set('uuids', uuids);
            } catch (error) {
                console.error('Error updating cache with new UUID data:', error);
                // Continue, as this is a non-critical failure
            }

            // Create an embed to confirm successful registration
            const embed = new EmbedBuilder()
                .setTitle('🎉 DFC Registration Successful 🎉')
                .setColor('#FF4500') // DFC branded color
                .setDescription("✅ You have been successfully added into the DFC roster! 🏆 You can now use signup to join the weekly events.")
                .addFields(
                    { name: '🏟️ Arena Name', value: duelerName, inline: true },
                    { name: '👤 Discord Name', value: discordName, inline: true }
                )
                .setFooter({ text: 'Good luck in the arena! ⚔️' });

            await interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Unexpected error during registration process:', error);
            await interaction.reply('Failed to register. Please try again later.');
        }
    }
};
