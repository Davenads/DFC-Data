const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('Get the official DFC rankings'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts

    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      // Fetch rankings data from the Official Rankings tab
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Official Rankings!A1:B30', // Get enough rows for champion + top 20
      });

      const rows = response.data.values || [];
      
      // Find the champion (special entry above the numbered rankings)
      let champion = null;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === 'Champion' && rows[i][1]) {
          champion = rows[i][1];
          break;
        }
      }

      // Process the top 20 ranked players (starting from row 4)
      const rankedPlayers = [];
      let startRow = 4; // Starting from row 4 where numbered rankings begin
      
      // Find where the numbered rankings actually start
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === '1' || rows[i][0] === 1) {
          startRow = i;
          break;
        }
      }

      // Collect up to 20 ranked players
      for (let i = startRow; i < rows.length && rankedPlayers.length < 20; i++) {
        if (rows[i] && rows[i][0] && rows[i][1]) {
          const rank = rows[i][0].toString();
          const name = rows[i][1];
          
          // Only add if we have valid data
          if (rank && name) {
            rankedPlayers.push({ rank, name });
          }
        }
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Gold color
        .setTitle('🏆 Official DFC Rankings')
        .setDescription('The current official DFC rankings based on tournament performance.')
        .setTimestamp()
        .setFooter({ text: 'DFC Official Rankings' });

      // Add champion field if found
      if (champion) {
        embed.addFields({ name: '👑 Champion', value: champion, inline: false });
      }

      // Add emojis for top 3 ranks
      const rankEmojis = {
        '1': '🥇',
        '2': '🥈',
        '3': '🥉'
      };

      // Add top 20 players to the embed
      if (rankedPlayers.length > 0) {
        let ranksText = '';
        
        rankedPlayers.forEach(player => {
          const rankDisplay = rankEmojis[player.rank] || `#${player.rank}`;
          ranksText += `${rankDisplay} **${player.name}**\n`;
        });
        
        embed.addFields({ name: 'Top Rankings', value: ranksText, inline: false });
      } else {
        embed.addFields({ name: 'Rankings', value: 'No ranked players found', inline: false });
      }

      // Send the embed
      await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error fetching rankings:', error);
      await interaction.editReply({ content: 'There was an error while retrieving the rankings.', ephemeral: true });
    }
  },
};