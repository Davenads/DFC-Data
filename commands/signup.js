const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Sign up for the weekly DFC event'),
    role: 'DFC Dueler',

    async execute(interaction) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
        
        console.log(`[${timestamp}] Executing signup command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);
        
        try {
            // Create an embed with the Google Form link
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📜 Weekly DFC Event Signup')
                .setDescription('Please fill out the Google Form below to sign up for the weekly DFC event:')
                .addFields(
                    { name: 'Registration Form', value: ':fire: [Click here to register](https://voxelfox.co.uk/gforms?f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/&u=2092238618&i=) :fire:' }
                )
                .setImage('https://i.imgur.com/GQssDxO.png')
                .setTimestamp()
                .setFooter({ text: 'DFC Weekly Event' });

            // Send the embed as an ephemeral reply (only visible to the command user)
            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`[${timestamp}] Signup form sent successfully to ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error sending signup form to ${user.tag} (${user.id}):`;
            console.error(errorMessage, error);
            await interaction.reply({ content: 'Failed to send the signup form. Please try again later.', ephemeral: true });
        }
    }
};