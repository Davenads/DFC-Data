const NodeCache = require('node-cache');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

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
                // Authenticate with Google Sheets
                const authClient = await auth.getClient();
                const updatedRes = await sheets.spreadsheets.values.get({
                    auth: authClient,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: 'Roster!D:D',
                });
                cachedUuids = updatedRes.data.values.flat();
                cache.set('uuids', cachedUuids);
            }
            if (cachedUuids.includes(userId)) {
                return interaction.reply('You are already registered. Your UUID is already present in our data.');
            }

            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Fetch existing roster data to verify if the user is already registered
            const res = await sheets.spreadsheets.values.get({
                auth: authClient,
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

            // Append new user to the roster with the required columns
            await sheets.spreadsheets.values.update({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: `Roster!A${nextRow}:D${nextRow}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[duelerName, duelerName, discordName, userId]],
                },
            });

            // Re-cache UUID data for /signup command
            const updatedRes = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Roster!D:D',
            });
            const uuids = updatedRes.data.values.flat();
            cache.set('uuids', uuids);

            // Create an embed to confirm successful registration
            const embed = new MessageEmbed()
                .setTitle('🎉 Registration Successful 🎉')
                .setColor('#00FF00')
                .setDescription('✅ You have been successfully added into the data! 🏆')
                .addFields(
                    { name: '🏟️ Arena Name', value: duelerName, inline: true },
                    { name: '👤 Discord Name', value: discordName, inline: true }
                )
                .setFooter('Good luck in the arena! ⚔️');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error registering user:', error);
            await interaction.reply('Failed to register. Please try again later.');
        }
    }
};
