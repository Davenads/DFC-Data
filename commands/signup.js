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
        const discordId = interaction.user.id;

        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply();

            // Use the auth object directly as it's already a JWT client
            // Fetch current data from Signups tab to determine if user already signed up for this match type
            const signupsRes = await sheets.spreadsheets.values.get({
                auth: auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'DFC Bot Signups!A:G',
                majorDimension: 'ROWS'
            });

            const signups = signupsRes.data.values || [];

            // Check if the user is already signed up for the specified match type
            const existingSignup = signups.find(row => row[5] === discordId && row[2] === matchType);
            if (existingSignup) {
                return interaction.editReply('You have already signed up for this match type. Please choose a different match type or update your existing signup.');
            }

            // Determine the first available empty row based on column B (Discord Handle)
            let firstEmptyRow = signups.length + 1;
            for (let i = 1; i < signups.length; i++) {
                if (!signups[i] || !signups[i][1]) { // Check if column B (Discord Handle) is empty
                    firstEmptyRow = i + 1;
                    break;
                }
            }

            // Get the current timestamp
            const timestamp = new Date().toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');

            // Update the new signup to the first available row in the DFC Bot Signups tab
            await sheets.spreadsheets.values.update({
                auth: auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: `DFC Bot Signups!A${firstEmptyRow}:G${firstEmptyRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[timestamp, discordName, matchType, chosenClass, chosenBuild, discordId, '']]
                },
            });

            // Create an embed to display the signup details
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📜 Weekly Event Signup')
                .addFields(
                    { name: 'Player', value: `**${discordName}**`, inline: true },
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