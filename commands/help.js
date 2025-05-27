const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with DFC Bot commands'),

  async handleButton(interaction) {
    if (!['show_deprecated', 'back_to_help'].includes(interaction.customId)) {
      return false; // Not our button
    }

    const timestamp = new Date().toISOString();
    const user = interaction.user;
    
    try {
      if (interaction.customId === 'show_deprecated') {
        // Create embed for deprecated commands
        const deprecatedEmbed = new EmbedBuilder()
          .setColor(0xAA5555)
          .setTitle('⚠️ Deprecated Commands')
          .setDescription('These commands are being phased out and are not endorsed by the DFC:')
          .addFields(
            { 
              name: '/rankings-legacy', 
              value: 'Old rankings system based on ELO metrics. Use `/rankings` for official DFC rankings instead.', 
              inline: false 
            },
            { 
              name: '/stats-legacy', 
              value: 'Legacy player statistics including detailed ELO and Efficiency Index. Use `/stats` for current official stats.', 
              inline: false 
            },
            { 
              name: '/elo', 
              value: 'View player ELO ratings. These metrics are not endorsed by the DFC. Use `/stats` or `/rankings` for official metrics.', 
              inline: false 
            }
          )
          .addFields({
            name: '📋 Recommendation',
            value: 'Please use `/rankings` to get the official DFC rankings, which are based on tournament performance rather than ELO metrics.',
            inline: false
          })
          .setFooter({ text: 'DFC Bot Help | Deprecated Commands' })
          .setTimestamp();
        
        // Create back button
        const backRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('back_to_help')
              .setLabel('Back to Main Help')
              .setStyle(ButtonStyle.Primary)
          );
        
        await interaction.update({
          embeds: [deprecatedEmbed],
          components: [backRow]
        });
        
        console.log(`[${timestamp}] Deprecated commands help shown to ${user.tag} (${user.id})`);
        
      } else if (interaction.customId === 'back_to_help') {
        // Create main help embed
        const helpEmbed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('📚 DFC Bot Command Help')
          .setDescription('Here are the main commands available for the DFC Bot:')
          .addFields(
            { 
              name: '🏆 !rankings', 
              value: 'View the official DFC rankings based on tournament performance.', 
              inline: false 
            },
            { 
              name: '📝 !register', 
              value: 'Register as a player in the DFC database with your Discord account.', 
              inline: false 
            },
            { 
              name: '🗓️ !signup', 
              value: 'Sign up for upcoming tournaments and events.', 
              inline: false 
            },
            { 
              name: '🆕 !recentsignups', 
              value: 'View recent tournament signups.', 
              inline: false 
            },
            { 
              name: '📊 !stats', 
              value: 'View player statistics including W/L record, winrate, rank, and recent matches.', 
              inline: false 
            },
            { 
              name: '⚔️ !recentduels', 
              value: 'View recent duels from the last X days (up to 30 days). Usage: `!recentduels [days]`', 
              inline: false 
            },
            { 
              name: '🥊 !fightcard', 
              value: 'Shows upcoming matches in order with divisions.', 
              inline: false 
            },
            { 
              name: '🔄 !refreshcache', 
              value: 'Manual cache refresh (Moderator only).', 
              inline: false 
            }
          )
          .addFields(
            {
              name: '🤖 Technical Issues or Bugs?',
              value: 'If you encounter any technical issues or bugs with the bot, please report them in <#1335332761237590167>.',
              inline: false
            },
            {
              name: '⚠️ Important Note for DFC Duelers',
              value: 'You can also use these commands with the `!` prefix (e.g., `!stats`, `!rankings`) for quicker access in DFC channels. Mods can use `/` instead',
              inline: false
            }
          )
          .setFooter({ text: 'DFC Bot Help | Type /help for this menu' })
          .setTimestamp();
        
        // Create button for deprecated commands
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('show_deprecated')
              .setLabel('Show Deprecated Commands')
              .setStyle(ButtonStyle.Secondary)
          );
        
        await interaction.update({
          embeds: [helpEmbed],
          components: [row]
        });
        
        console.log(`[${timestamp}] Returned to main help menu for ${user.tag} (${user.id})`);
      }
      
      return true; // We handled this button
    } catch (error) {
      console.error(`[${timestamp}] Error handling help button interaction for ${user.tag} (${user.id}):`, error);
      return false;
    }
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
        .setTitle('📚 DFC Bot Command Help')
        .setDescription('Here are the main commands available for the DFC Bot:')
        .addFields(
          { 
            name: '🏆 !rankings', 
            value: 'View the official DFC rankings based on tournament performance.', 
            inline: false 
          },
          { 
            name: '📝 !register', 
            value: 'Register as a player in the DFC database with your Discord account.', 
            inline: false 
          },
          { 
            name: '🗓️ !signup', 
            value: 'Sign up for upcoming tournaments and events.', 
            inline: false 
          },
          { 
            name: '🆕 !recentsignups', 
            value: 'View recent tournament signups.', 
            inline: false 
          },
          { 
            name: '📊 !stats', 
            value: 'View player statistics including W/L record, winrate, rank, and recent matches.', 
            inline: false 
          },
          { 
            name: '⚔️ !recentduels', 
            value: 'View recent duels from the last X days (up to 30 days). Usage: `!recentduels [days]`', 
            inline: false 
          },
          { 
            name: '🥊 !fightcard', 
            value: 'Shows upcoming matches in order with divisions.', 
            inline: false 
          },
          { 
            name: '🔄 !refreshcache', 
            value: 'Manual cache refresh (Moderator only).', 
            inline: false 
          }
        )
        .addFields(
          {
            name: '🤖 Technical Issues or Bugs?',
            value: 'If you encounter any technical issues or bugs with the bot, please report them in <#1335332761237590167>.',
            inline: false
          },
          {
            name: '⚠️ Important Note for DFC Duelers',
            value: 'You can also use these commands with the `!` prefix (e.g., `!stats`, `!rankings`) for quicker access in DFC channels. Mods can use `/` instead',
            inline: false
          }
        )
        .setFooter({ text: 'DFC Bot Help | Type /help for this menu' })
        .setTimestamp();
      
      // Create button for deprecated commands
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('show_deprecated')
            .setLabel('Show Deprecated Commands')
            .setStyle(ButtonStyle.Secondary)
        );
      
      await interaction.editReply({
        embeds: [helpEmbed],
        components: [row],
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