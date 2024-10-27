const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { AutocompleteInteraction } = require('discord.js');

const classBuildOptions = {
    druid: ['Wind', 'Shaman', 'Fire Druid', 'Summon', 'Fury', 'Other'],
    assassin: ['Ghost', 'Trapper', 'Spider', 'Blade', 'Kicker', 'Hybrid WOF', 'Hybrid LS', 'Hybrid WW', 'Other'],
    amazon: ['Tribrid', 'Telebow', 'Fort Tele Zon', 'CS Hybrid Bowa', 'CS Zon', 'Hybrid', 'Walkbow', 'Jab', 'Javazon', 'Other'],
    sorceress: ['Bow Sorc', 'Cold ES', 'Cold Vita', 'Fire ES', 'Lite ES', 'Lite Vita', 'Fire Vita', 'Other'],
    paladin: ['T/V', 'Murderdin', 'Mage', 'Auradin', 'V/T', 'Hammerdin', 'Vanquisher', 'V/C', 'Zealot', 'Ranger', 'Poondin', 'Liberator', 'Zeal/FoH', 'Charger', 'Other'],
    necromancer: ['Poison', 'Bone', 'Bone/Psn Hybrid', 'Psn Dagger', 'Other'],
    barbarian: ['Throw/WW Hybrid', 'BvC', 'BvB', 'BvA', 'Singer', 'Concentrate', 'Other']
};

const classEmojis = {
    Paladin: '⚔️',
    Necromancer: '💀',
    Assassin: '🗡️',
    Druid: '🐺',
    Amazon: '🏹',
    Sorceress: '🔮',
    Barbarian: '🛡️'
};

const matchTypeEmojis = {
    HLD: '🏆',
    LLD: '🥇',
    Melee: '⚔️'
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
        let chosenClass = interaction.options.getString('class');
        chosenClass = chosenClass.charAt(0).toUpperCase() + chosenClass.slice(1);
        const chosenBuild = interaction.options.getString('build');
        const matchType = interaction.options.getString('match_type');

        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply();
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
            const discordId = interaction.user.id;
            const rosterEntry = roster.find(row => row[3] === discordId);
            if (!rosterEntry) {
                return interaction.editReply('You must be registered in the roster before signing up for the weekly event. Use /register to get started.');
            }
            const rosterName = rosterEntry[0];

            // Fetch current data from Weekly Signups tab to determine if match type already exists for the user
            const weeklyRes = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Weekly Signups!A:F',
                majorDimension: 'ROWS'
            });

            const weeklySignups = weeklyRes.data.values || [];
            const existingSignup = weeklySignups.find(row => row[0] === rosterName && row[3] === matchType);

            if (existingSignup) {
                return interaction.editReply('You have already signed up for this match type. Please choose a different match type or update your existing signup.');
            }

            // Determine the first available empty row
            let firstEmptyRow;
            if (weeklySignups.length === 0 || weeklySignups[1] === undefined || weeklySignups[1].every(cell => cell === '')) {
                firstEmptyRow = 2; // Start at row 2 if the sheet is empty or only has headers
            } else {
                firstEmptyRow = weeklySignups.findIndex(row => !row || row.every(cell => cell === '')) + 2;
                if (firstEmptyRow === 1) { // If no empty row was found, append to the end
                    firstEmptyRow = weeklySignups.length + 2;
                }
            }

            // Get the current date for sDate
            const currentDate = new Date().toISOString().split('T')[0];

            // Update the new signup to the first available row in the Weekly Signups tab
            await sheets.spreadsheets.values.update({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: `Weekly Signups!A${firstEmptyRow}:F${firstEmptyRow}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[rosterName, chosenClass, chosenBuild, matchType, currentDate, 'Available']],
                },
            });

            // Create an embed to display the signup details
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📜 Weekly Event Signup')
                .addFields(
                    { name: 'Player', value: `**${rosterName}**`, inline: true },
                    { name: 'Class', value: `${classEmojis[chosenClass]} **${chosenClass}**`, inline: true },
                    { name: 'Build', value: `**${chosenBuild}**`, inline: true },
                    { name: 'Match Type', value: `${matchTypeEmojis[matchType]} **${matchType}**`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Successfully signed up for the weekly event!' });

            // Edit the deferred reply with the embed message
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error signing up for the weekly event:', error);
            await interaction.editReply('Failed to sign you up. Please try again later.');
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