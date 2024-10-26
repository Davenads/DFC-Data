const { SlashCommandBuilder } = require('@discordjs/builders');
const { AutocompleteInteraction } = require('discord.js');

const classBuildOptions = {
    druid: ['Wind', 'Shaman', 'Fire Druid', 'Summon', 'Fury', 'Other Druid'],
    assassin: ['Ghost', 'Trapper', 'Spider', 'Blade', 'Kicker', 'Hybrid WOF', 'Hybrid LS', 'Hybrid WW', 'Other Assassin'],
    amazon: ['Tribrid', 'Telebow', 'Fort Tele Zon', 'CS Hybrid Bowa', 'CS Zon', 'Hybrid', 'Walkbow', 'Jab', 'Javazon', 'Other Amazon'],
    sorceress: ['Bow Sorc', 'Cold ES', 'Cold Vita', 'Fire ES', 'Lite ES', 'Lite Vita', 'Fire Vita', 'Other Sorceress'],
    paladin: ['T/V', 'Murderdin', 'Mage', 'Auradin', 'V/T', 'Hammerdin', 'Vanquisher', 'V/C', 'Zealot', 'Ranger', 'Poondin', 'Liberator', 'Zeal/FoH', 'Charger', 'Other Paladin'],
    necromancer: ['Poison', 'Bone', 'Bone/Psn Hybrid', 'Psn Dagger', 'Other Necromancer'],
    barbarian: ['Throw/WW Hybrid', 'BvC', 'BvB', 'BvA', 'Singer', 'Concentrate', 'Other Barbarian']
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Sign up for the weekly event')
        .addStringOption(option =>
            option.setName('class')
                .setDescription('Choose your class')
                .setRequired(true)
                .addChoices(
                    { name: 'Paladin', value: 'paladin' },
                    { name: 'Necromancer', value: 'necromancer' },
                    { name: 'Assassin', value: 'assassin' },
                    { name: 'Druid', value: 'druid' },
                    { name: 'Amazon', value: 'amazon' },
                    { name: 'Sorceress', value: 'sorceress' },
                    { name: 'Barbarian', value: 'barbarian' }
                )
        )
        .addStringOption(option =>
            option.setName('build')
                .setDescription('Specify your build')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('match_type')
                .setDescription('Specify the match type (HLD, LLD, Melee)')
                .setRequired(true)
                .addChoices(
                    { name: 'HLD', value: 'HLD' },
                    { name: 'LLD', value: 'LLD' },
                    { name: 'Melee', value: 'Melee' }
                )
        ),
    role: 'DFC Dueler',

    async execute(interaction, sheets, auth) {
        const discordName = interaction.user.username;
        const chosenClass = interaction.options.getString('class');
        const chosenBuild = interaction.options.getString('build');
        const matchType = interaction.options.getString('match_type');

        try {
            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Fetch data from the Roster tab to cross-check the user
            const res = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Roster!A:D',
            });

            const roster = res.data.values || [];

            // Verify that the user is registered in the Roster tab and get their name
            const rosterEntry = roster.find(row => row[2] === discordName);
            if (!rosterEntry) {
                return interaction.reply('You must be registered in the roster before signing up for the weekly event. Use /register to get started.');
            }
            const rosterName = rosterEntry[0];

            // Fetch current data from Weekly Signups tab to determine the first available row
            const weeklyRes = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Weekly Signups!A:F', // Fetch enough columns to locate empty rows
                majorDimension: 'ROWS'
            });

            const weeklySignups = weeklyRes.data.values || [];
            let firstAvailableRow = weeklySignups.length + 2; // Default to appending at the end

            // Find the first empty row based on the Name column (Column A)
            for (let i = 0; i < weeklySignups.length; i++) {
                if (!weeklySignups[i][0]) { // Check if Column A (Name) is empty
                    firstAvailableRow = i + 2;
                    break;
                }
            }

            // Get the current date for sDate
            const currentDate = new Date().toISOString().split('T')[0];

            // Append the new signup to the Weekly Signups tab
            await sheets.spreadsheets.values.update({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: `Weekly Signups!A${firstAvailableRow}:F${firstAvailableRow}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[rosterName, chosenClass, chosenBuild, matchType, currentDate, 'Available']],
                },
            });

            // Reply with success message
            await interaction.reply('You have successfully signed up for the weekly event!');
        } catch (error) {
            console.error('Error signing up for the weekly event:', error);
            await interaction.reply('Failed to sign you up. Please try again later.');
        }
    },

    async autocomplete(interaction) {
        if (interaction instanceof AutocompleteInteraction) {
            const chosenClass = interaction.options.getString('class');
            const focusedValue = interaction.options.getFocused();

            if (chosenClass && classBuildOptions[chosenClass]) {
                const filteredOptions = classBuildOptions[chosenClass].filter(option =>
                    option.toLowerCase().includes(focusedValue.toLowerCase())
                );
                await interaction.respond(
                    filteredOptions.slice(0, 25).map(option => ({ name: option, value: option }))
                );
            } else {
                await interaction.respond([]);
            }
        }
    }
};
