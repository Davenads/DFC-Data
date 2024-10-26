// commands/signup.js
const { SlashCommandBuilder } = require('@discordjs/builders');

// Unique build options per class
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
                .addChoices(...Object.entries(classBuildOptions).flatMap(([className, builds]) =>
                    builds.map(build => ({ name: build, value: `${className}:${build}` }))
                ))
        ),
    role: 'DFC Dueler', // Required role to execute this command

    async execute(interaction, sheets, auth) {
        const discordName = interaction.user.username;
        const chosenClass = interaction.options.getString('class');
        const chosenBuild = interaction.options.getString('build');

        // Extract actual build name from chosen build
        const [, buildName] = chosenBuild.split(':');

        try {
            // Authenticate with Google Sheets
            const authClient = await auth.getClient();

            // Fetch data from the Roster tab to cross-check the user
            const res = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Roster!A:D',
            });

            const roster = res.data.values || [];

            // Verify that the user is registered in the Roster tab
            const isRegistered = roster.some(row => row[2] === discordName);
            if (!isRegistered) {
                return interaction.reply('You must be registered in the roster before signing up for the weekly event. Use /register to get started.');
            }

            // Append the new signup to the Weekly Signups tab
            await sheets.spreadsheets.values.append({
                auth: authClient,
                spreadsheetId: process.env.SHEET_ID,
                range: 'Weekly Signups!A:D',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[discordName, chosenClass, buildName, 'Pending']],
                },
            });

            // Reply with success message
            await interaction.reply('You have successfully signed up for the weekly event!');
        } catch (error) {
            console.error('Error signing up for the weekly event:', error);
            await interaction.reply('Failed to sign you up. Please try again later.');
        }
    }
};
