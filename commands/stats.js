const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Get simplified stats for a player (W/L, winrate, and rank)')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('The player to get stats for')
        .setAutocomplete(true)
        .setRequired(true)),

  async autocomplete(interaction) {
    const timestamp = new Date().toISOString();
    const focusedValue = interaction.options.getFocused();
    const user = interaction.user;
    
    console.log(`[${timestamp}] Processing stats autocomplete:
    User: ${user.tag} (${user.id})
    Search Term: ${focusedValue}`);
    
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:A',
      });

      const players = response.data.values ? response.data.values.flat() : [];
      const uniquePlayers = [...new Set(players)]; // Remove duplicate names
      const searchTerm = interaction.options.getFocused().toLowerCase();

      const filteredPlayers = uniquePlayers.filter(player =>
        player.toLowerCase().includes(searchTerm)
      ).slice(0, 25); // Limit to 25 players to meet Discord's requirements

      const results = filteredPlayers.map(player => ({ name: player, value: player }));
      await interaction.respond(results);
      console.log(`[${timestamp}] Stats autocomplete returned ${results.length} results for user ${user.tag} (${user.id}) search: "${searchTerm}"`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching player names for autocomplete by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const playerName = interaction.options.getString('player');
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing stats command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Player: ${playerName}`);
    
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts

    try {
      // First, get the player's W/L and winrate data
      const eloResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:M',
      });

      const eloRows = eloResponse.data.values || [];
      const playerRows = eloRows.filter(row => row[0].toLowerCase() === playerName.toLowerCase());

      if (playerRows.length === 0) {
        console.log(`[${timestamp}] Player ${playerName} not found for stats requested by ${user.tag} (${user.id})`);
        return interaction.editReply({ content: `Player **${playerName}** not found.`, ephemeral: true });
      }

      // Sort player rows by timestamp in descending order to get the most recent data first
      playerRows.sort((a, b) => new Date(b[1]) - new Date(a[1]));

      // Now, check if player appears in the Official Rankings
      const rankingsResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Official Rankings!A1:B30', // Get enough rows for champion + top 20
      });

      const rankingsRows = rankingsResponse.data.values || [];
      
      // Check if player is the champion
      let isChampion = false;
      for (let i = 0; i < rankingsRows.length; i++) {
        if (rankingsRows[i][0] === 'Champion' && 
            rankingsRows[i][1] && 
            rankingsRows[i][1].toLowerCase() === playerName.toLowerCase()) {
          isChampion = true;
          break;
        }
      }

      // Check player's ranking (if any)
      let playerRank = null;
      for (let i = 0; i < rankingsRows.length; i++) {
        if (rankingsRows[i][1] && rankingsRows[i][1].toLowerCase() === playerName.toLowerCase() && 
            rankingsRows[i][0] && !isNaN(rankingsRows[i][0])) {
          playerRank = rankingsRows[i][0].toString();
          break;
        }
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📊 Stats for ${playerName}`)
        .setFooter({ text: 'DFC Stats' })
        .setTimestamp();

      // Add rank information if applicable
      if (isChampion) {
        embed.addFields({ name: '👑 Rank', value: 'Champion', inline: false });
      } else if (playerRank) {
        // Add emojis for top 3 ranks
        const rankEmojis = {
          '1': '🥇 1st Place',
          '2': '🥈 2nd Place',
          '3': '🥉 3rd Place'
        };
        
        const rankDisplay = rankEmojis[playerRank] || `#${playerRank}`;
        embed.addFields({ name: '🏆 Rank', value: rankDisplay, inline: false });
      }

      // Process each unique match type
      const processedMatchTypes = new Set();
      playerRows.forEach(playerData => {
        const [player, timestamp, matchType, sElo, elo, sEIndex, eIndex, sWins, sLoss, sWinRate, cWins, cLoss, cWinRate] = playerData;

        if (!processedMatchTypes.has(matchType)) {
          processedMatchTypes.add(matchType);

          // Only include W/L and winrate stats
          const stats = [];
          
          // Add W/L stats if available
          if (cWins || cLoss) {
            stats.push(`W/L: ${cWins || 0}/${cLoss || 0}`);
          }
          
          // Add winrate if available
          if (cWinRate) {
            stats.push(`Winrate: ${cWinRate}`);
          }

          // Only add field if we have stats to display
          if (stats.length > 0) {
            embed.addFields({
              name: matchType,
              value: stats.join('\n'),
              inline: true
            });
          }
        }
      });

      // Get recent matches for the player from Duel Data tab
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const duelDataResponse = await sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: 'Duel Data!A2:Q2103', // As per requirement, up to row 2103
        });
        
        const duelRows = duelDataResponse.data.values || [];
        
        // Find matches where the player was either winner or loser in the last 30 days
        const recentMatches = duelRows.filter(row => {
          // Check if row has sufficient data
          if (row.length < 5) return false;
          
          // Extract date from column A (Event Date)
          const matchDate = new Date(row[0]);
          if (isNaN(matchDate.getTime())) return false; // Invalid date
          
          // Check if match is within last 30 days
          if (matchDate < thirtyDaysAgo) return false;
          
          // Check if player is Winner (column B) or Loser (column E)
          const winner = row[1];
          const loser = row[4];
          return (winner && winner.toLowerCase() === playerName.toLowerCase()) || 
                 (loser && loser.toLowerCase() === playerName.toLowerCase());
        });
        
        // Sort by most recent first (date is in column A)
        recentMatches.sort((a, b) => new Date(b[0]) - new Date(a[0]));
        
        // Take only the most recent matches (max 5)
        const matchesToShow = recentMatches.slice(0, 5);
        
        if (matchesToShow.length > 0) {
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
          
          const matchDetails = matchesToShow.map(match => {
            const eventDate = new Date(match[0]);
            const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
            const winner = match[1];
            const winnerClass = match[2] || '';
            const winnerBuild = match[3] || '';
            const loser = match[4];
            const loserClass = match[5] || '';
            const loserBuild = match[6] || '';
            const matchType = match[8] || 'Unknown';
            
            const isWinner = winner.toLowerCase() === playerName.toLowerCase();
            const playerClass = isWinner ? winnerClass.toLowerCase() : loserClass.toLowerCase();
            const playerBuild = isWinner ? winnerBuild : loserBuild;
            const opponentClass = isWinner ? loserClass.toLowerCase() : winnerClass.toLowerCase();
            const opponentBuild = isWinner ? loserBuild : winnerBuild;
            const opponent = isWinner ? loser : winner;
            
            // Get emojis for classes
            const playerClassEmoji = classEmojis[playerClass] || '👤';
            const opponentClassEmoji = classEmojis[opponentClass] || '👤';
            
            return `${formattedDate} - ${isWinner ? '✅ Win' : '❌ Loss'} vs ${opponent}\n` +
                   `${playerClassEmoji} ${playerClass} ${playerBuild} vs ${opponentClassEmoji} ${opponentClass} ${opponentBuild}\n` +
                   `Type: ${matchType}`;
          }).join('\n\n');
          
          embed.addFields({ 
            name: '🔄 Recent Matches (Last 30 Days)', 
            value: matchDetails || 'No recent matches found.',
            inline: false 
          });
        }
      } catch (error) {
        console.error(`[${timestamp}] Error fetching recent matches for ${playerName}:`, error);
        // Don't fail the whole command if this part fails
      }
      
      // Add a note about more detailed stats
      embed.addFields({ 
        name: 'Need more details?', 
        value: 'Use `/stats-legacy` for detailed stats including ELO and Efficiency Index',
        inline: false 
      });

      await interaction.editReply({ embeds: [embed], ephemeral: true });
      console.log(`[${timestamp}] Stats for player ${playerName} sent successfully to ${user.tag} (${user.id}) - found ${processedMatchTypes.size} match types`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching stats for player ${playerName} requested by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving the player stats.', ephemeral: true });
    }
  },
};