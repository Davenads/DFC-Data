const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register for the DFC event roster'),
    async execute(interaction, sheets, auth) {
        const discordName = interaction.user.username;

        // Registration logic goes here
        await interaction.reply(`${discordName}, you have been registered successfully!`);
    }
};