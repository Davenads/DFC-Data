const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('View the official DFC rankings leaderboard'),

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

    console.log(`[${timestamp}] Executing rankings command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})`);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFFD700) // Gold color
          .setTitle('🏆 Official DFC Rankings')
          .setDescription('View the official DFC leaderboard with rankings for all divisions (HLD, LLD, Melee).')
          .addFields(
            {
              name: '📊 Interactive Leaderboard',
              value: '[Click here to view the full rankings dashboard](https://lookerstudio.google.com/reporting/f0aef56a-571d-4216-9b70-ea44614f10eb/page/p_omb02u6xvd)',
              inline: false
            },
            {
              name: 'ℹ️ Features',
              value: '• Rankings for HLD, LLD, and Melee divisions\n• Win/Loss stats and win rate percentages\n• Calibrated to the past 100 days\n• Filter by player, mirror type, and more',
              inline: false
            }
          )
          .setTimestamp()
          .setFooter({ text: 'DFC Official Rankings - Powered by Looker Studio' })
      ],
      ephemeral: true
    });

    console.log(`[${timestamp}] Rankings command completed successfully for ${user.tag} (${user.id})`);
  },
};
