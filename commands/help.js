const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { soundAlphaEmoji, deckardCainEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with DFC Bot commands'),

  async handleButton() {
    // No buttons in the new help command
    return false;
  },

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

    console.log(`[${timestamp}] Executing help command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})`);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Create main help embed
      const helpEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`${deckardCainEmoji} DFC Bot Command Help`)
        .setDescription('Here are the main commands available for the DFC Bot:')
        .addFields(
          {
            name: '🏆 /rankings [division]',
            value: 'View official DFC rankings. **Args:** `division` - HLD, LLD, or Melee (required)',
            inline: false
          },
          {
            name: '📊 /classrankings [days]',
            value: 'Class performance stats and matchup win rates. **Args:** `days` - number of days to analyze (optional, defaults to 30)',
            inline: false
          },
          {
            name: '📈 /dueltrends [days] [matchtype]',
            value: 'Analyze duel trends and statistics. **Args:** `days` - analysis period (optional, defaults to 30), `matchtype` - HLD/LLD/Melee (optional)',
            inline: false
          },
          {
            name: '📋 /stats [player] [days]',
            value: 'View player stats (W/L, winrate, rank). **Args:** `player` - player name (required, autocomplete available), `days` - time period (optional)',
            inline: false
          },
          {
            name: '🗓️ /signup',
            value: 'Sign up for upcoming tournaments (DFC Dueler role required). Opens interactive signup wizard.',
            inline: false
          },
          {
            name: '🆕 /recentsignups',
            value: 'View recent tournament signups with class and build details.',
            inline: false
          },
          {
            name: '📖 /rules [format]',
            value: 'View tournament rules. **Args:** `format` - HLD/LLD/Melee/Team (optional)',
            inline: false
          },
          {
            name: '📜 /changelog',
            value: 'View the history of DFC rule changes.',
            inline: false
          }
        )
        .addFields(
          {
            name: '\u200B', // Zero-width space for blank name
            value: `${soundAlphaEmoji} View [interactive leaderboards by Sound](https://lookerstudio.google.com/reporting/f0aef56a-571d-4216-9b70-ea44614f10eb/page/p_omb02u6xvd)`
          },
          {
            name: '🤖 Technical Issues or Bugs?',
            value: 'If you encounter any technical issues or bugs with the bot, please report them in <#1335332761237590167>.',
            inline: false
          }
        )
        .setFooter({ text: 'DFC Bot Help | Type /help for this menu' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [helpEmbed],
        ephemeral: true
      });

      console.log(`[${timestamp}] Help menu sent successfully to ${user.tag} (${user.id})`);
    } catch (error) {
      console.error(`[${timestamp}] Error displaying help menu for ${user.tag} (${user.id}):`, error);
      await interaction.editReply({
        content: 'There was an error while retrieving the help information.',
        ephemeral: true
      });
    }
  },
};