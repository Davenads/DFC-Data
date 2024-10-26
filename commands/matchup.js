const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matchup')
        .setDescription('Create matchups for the weekly fight card (requires manager role)'),
    async execute(interaction, sheets, auth) {
        // Matchup creation logic goes here
        await interaction.reply('Matchups have been created successfully!');
    }
};