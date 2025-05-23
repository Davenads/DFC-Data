const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recentduels')
    .setDescription('Get recent duels from the last X days (up to 30 days)')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to look back (1-30)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30)),

  async execute(interaction) {
    const days = interaction.options.getInteger('days');
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing recentduels command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Days: ${days}`);

    await interaction.deferReply({ ephemeral: true });

    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get duel data from the specified range
      const duelDataResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Duel Data!A2:Q2103',
      });

      const duelRows = duelDataResponse.data.values || [];

      // Filter matches within the specified time period
      const recentMatches = duelRows.filter(row => {
        if (row.length < 5) return false;
        
        const matchDate = new Date(row[0]); // Event Date column
        if (isNaN(matchDate.getTime())) return false;
        
        return matchDate >= cutoffDate;
      });

      // Sort by most recent first
      recentMatches.sort((a, b) => new Date(b[0]) - new Date(a[0]));

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green color
        .setTitle(`⚔️ Recent Duels - Last ${days} Day${days === 1 ? '' : 's'}`)
        .setDescription(`Found ${recentMatches.length} duel${recentMatches.length === 1 ? '' : 's'} in the last ${days} day${days === 1 ? '' : 's'}`)
        .setTimestamp()
        .setFooter({ text: 'DFC Recent Duels' });

      if (recentMatches.length === 0) {
        embed.addFields({ 
          name: 'No Recent Duels', 
          value: `No duels found in the last ${days} day${days === 1 ? '' : 's'}.`,
          inline: false 
        });
      } else {
        // Class emojis
        const classEmojis = {
          'amazon': '🏹',
          'assassin': '🥷',
          'barbarian': '⚔️',
          'druid': '🐺',
          'necromancer': '💀',
          'paladin': '🛡️',
          'sorceress': '🔮'
        };

        // Limit to 20 matches to avoid embed size limits
        const matchesToShow = recentMatches.slice(0, 20);
        
        const matchDetails = matchesToShow.map(match => {
          const eventDate = new Date(match[0]); // Event Date
          const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
          const winner = match[1] || 'Unknown'; // Winner
          const winnerClass = match[2] || ''; // W Class
          const winnerBuild = match[3] || ''; // W Build
          const loser = match[4] || 'Unknown'; // Loser
          const loserClass = match[5] || ''; // L Class
          const loserBuild = match[6] || ''; // L Build
          const roundLosses = match[7] || ''; // Round Losses
          const matchType = match[8] || 'Unknown'; // Match Type
          const game = match[9] || ''; // Game
          const mirror = match[10] || ''; // Mirror
          const title = match[11] || ''; // Title
          const notes = match[12] || ''; // Notes
          
          const winnerClassEmoji = classEmojis[winnerClass.toLowerCase()] || '👤';
          const loserClassEmoji = classEmojis[loserClass.toLowerCase()] || '👤';
          
          let matchString = `**${formattedDate}** - ${winner} def. ${loser}`;
          
          // Add class and build information if available
          if (winnerClass || loserClass) {
            matchString += `\n${winnerClassEmoji} ${winnerClass} ${winnerBuild} vs ${loserClassEmoji} ${loserClass} ${loserBuild}`;
          }
          
          // Add match type if available
          if (matchType && matchType !== 'Unknown') {
            matchString += `\nType: ${matchType}`;
          }
          
          // Add round losses if available
          if (roundLosses) {
            matchString += ` | Round Losses: ${roundLosses}`;
          }
          
          // Add title if available
          if (title) {
            matchString += `\nTitle: ${title}`;
          }
          
          return matchString;
        }).join('\n\n');
        
        embed.addFields({ 
          name: `Recent Matches${matchesToShow.length < recentMatches.length ? ` (Showing ${matchesToShow.length} of ${recentMatches.length})` : ''}`, 
          value: matchDetails,
          inline: false 
        });
        
        // Add note if we truncated results
        if (matchesToShow.length < recentMatches.length) {
          embed.addFields({ 
            name: 'Note', 
            value: `Only showing the most recent ${matchesToShow.length} matches. Use a smaller number of days to see fewer, more recent results.`,
            inline: false 
          });
        }
      }

      await interaction.editReply({ embeds: [embed], ephemeral: true });
      console.log(`[${timestamp}] Recent duels command completed successfully for ${user.tag} (${user.id}) - found ${recentMatches.length} matches in ${days} days`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching recent duels for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving recent duels.', ephemeral: true });
    }
  },
};