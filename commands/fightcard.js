const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fightcard')
    .setDescription('Display the current fight card with upcoming matches'),

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing fightcard command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})`);
    
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    await interaction.deferReply({ ephemeral: true });

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Fight Card!A3:D',
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        console.log(`[${timestamp}] No fight card data found for request by ${user.tag} (${user.id})`);
        return interaction.editReply({ 
          content: '📋 **Fight Card**\n\nNo upcoming matches found.'
        });
      }

      // Filter out empty rows and format the data
      const matches = rows
        .filter(row => row[0] && row[1] && row[2])
        .map(row => ({
          player1: row[0] || '',
          player2: row[1] || '',
          match: row[2] || '',
          division: row[3] || 'Unknown'
        }));

      if (matches.length === 0) {
        console.log(`[${timestamp}] No valid matches in fight card for request by ${user.tag} (${user.id})`);
        return interaction.editReply({ 
          content: '📋 **Fight Card**\n\nNo valid matches found.'
        });
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('DFC Fight Card')
        .setDescription('Upcoming duels and matchups')
        .setFooter({ text: 'DFC Fight Card' })
        .setTimestamp();

      // Create match list with Discord field value limit (1024 chars)
      const maxFieldLength = 1024;
      let currentField = '';
      let fieldCount = 1;
      
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const matchNumber = i + 1;
        const matchLine = `**${matchNumber}.** ${match.player1} vs ${match.player2} (${match.division})\n*${match.match}*\n\n`;
        
        if ((currentField + matchLine).length > maxFieldLength) {
          // Add current field to embed
          embed.addFields([{
            name: fieldCount === 1 ? 'Upcoming Matches' : `Upcoming Matches (continued)`,
            value: currentField.trim(),
            inline: false
          }]);
          
          // Start new field
          currentField = matchLine;
          fieldCount++;
        } else {
          currentField += matchLine;
        }
      }
      
      // Add the last field if there's content
      if (currentField.trim()) {
        embed.addFields([{
          name: fieldCount === 1 ? 'Upcoming Matches' : `Upcoming Matches (continued)`,
          value: currentField.trim(),
          inline: false
        }]);
      }

      // Add total match count
      embed.addFields([{
        name: 'Total Matches',
        value: `${matches.length}`,
        inline: true
      }]);

      await interaction.editReply({ embeds: [embed] });
      console.log(`[${timestamp}] Fight card with ${matches.length} matches sent successfully to ${user.tag} (${user.id})`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching fight card requested by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      
      let userErrorMessage = '⚠️ **Error**: There was a problem retrieving the fight card.';
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('network')) {
        userErrorMessage += '\n\nThere seems to be a network issue. Please try again later.';
      } else if (error.message?.includes('quota')) {
        userErrorMessage += '\n\nAPI quota limit reached. Please try again later.';
      } else if (error.message?.includes('permission') || error.message?.includes('forbidden') || error.code === 403) {
        userErrorMessage += '\n\nPermission denied when accessing fight card data. Please contact an administrator.';
      } else if (error.message?.includes('not found') || error.code === 404) {
        userErrorMessage += '\n\nThe fight card data could not be found. Please contact an administrator.';
      } else if (error.message?.includes('auth') || error.code === 401) {
        userErrorMessage += '\n\nAuthentication error. Please contact an administrator.';
      } else {
        const errorId = `ERR-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        userErrorMessage += `\n\nError ID: ${errorId} - Please report this to an administrator if the issue persists.`;
      }
      
      await interaction.editReply({ content: userErrorMessage });
    }
  },
};