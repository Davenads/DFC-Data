const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('Get the official DFC rankings'),

  async generateRankingsEmbed() {
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

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

    // Create button for recent matches
    const button = new ButtonBuilder()
      .setCustomId('rankings_recent_matches')
      .setLabel('View Recent Top Player Matches')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️');

    const row = new ActionRowBuilder()
      .addComponents(button);

    return { embeds: [embed], components: [row] };
  },

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing rankings command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})`);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts
    }

    try {
      const rankingsData = await this.generateRankingsEmbed();
      await interaction.editReply({ ...rankingsData, ephemeral: true });
      console.log(`[${timestamp}] Rankings command completed successfully for ${user.tag} (${user.id})`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching rankings for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving the rankings.', ephemeral: true });
    }
  },

  async handleButton(interaction) {
    console.log(`Rankings handleButton called with customId: ${interaction.customId}`);
    
    if (interaction.customId === 'rankings_back') {
      // Handle back button - show original rankings
      await interaction.deferUpdate();
      try {
        const rankingsData = await this.generateRankingsEmbed();
        await interaction.editReply(rankingsData);
        console.log(`[${interaction.user.tag}] Returned to rankings view`);
      } catch (error) {
        console.error('Error returning to rankings:', error);
        await interaction.editReply({ content: 'There was an error returning to rankings.', components: [] });
      }
      return;
    }
    
    if (interaction.customId !== 'rankings_recent_matches') return;

    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Handling recent matches button:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})`);

    await interaction.deferUpdate();

    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      // Get top players from Official Rankings (champion + top 20)
      const rankingsResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Official Rankings!A1:B30',
      });

      const rankingsRows = rankingsResponse.data.values || [];
      const topPlayers = new Set();

      // Add champion
      for (let i = 0; i < rankingsRows.length; i++) {
        if (rankingsRows[i][0] === 'Champion' && rankingsRows[i][1]) {
          topPlayers.add(rankingsRows[i][1].toLowerCase());
          break;
        }
      }

      // Add top 20 ranked players
      let startRow = 4;
      for (let i = 0; i < rankingsRows.length; i++) {
        if (rankingsRows[i][0] === '1' || rankingsRows[i][0] === 1) {
          startRow = i;
          break;
        }
      }

      for (let i = startRow; i < rankingsRows.length && topPlayers.size < 21; i++) {
        if (rankingsRows[i] && rankingsRows[i][0] && rankingsRows[i][1]) {
          const rank = rankingsRows[i][0].toString();
          const name = rankingsRows[i][1];
          
          if (rank && name && !isNaN(rank) && parseInt(rank) <= 20) {
            topPlayers.add(name.toLowerCase());
          }
        }
      }

      // Get recent matches from Duel Data involving top players
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const duelDataResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Duel Data!A2:Q2103',
      });

      const duelRows = duelDataResponse.data.values || [];

      // Filter matches involving top players in the last 7 days
      const recentTopPlayerMatches = duelRows.filter(row => {
        if (row.length < 5) return false;
        
        const matchDate = new Date(row[0]);
        if (isNaN(matchDate.getTime()) || matchDate < thirtyDaysAgo) return false;
        
        const winner = row[1] ? row[1].toLowerCase() : '';
        const loser = row[4] ? row[4].toLowerCase() : '';
        
        return topPlayers.has(winner) || topPlayers.has(loser);
      });

      // Sort by most recent first
      recentTopPlayerMatches.sort((a, b) => new Date(b[0]) - new Date(a[0]));

      // Take only the most recent 10 matches
      const matchesToShow = recentTopPlayerMatches.slice(0, 10);

      // Create the embed for recent matches
      const embed = new EmbedBuilder()
        .setColor(0xFF6B35) // Orange color to differentiate from main rankings
        .setTitle('⚔️ Recent Top Player Matches')
        .setDescription('Recent matches involving players from the Official Rankings (last 7 days)')
        .setTimestamp()
        .setFooter({ text: 'DFC Recent Matches' });

      if (matchesToShow.length === 0) {
        embed.addFields({ 
          name: 'No Recent Matches', 
          value: 'No recent matches found involving top players in the last 7 days.',
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
          
          const winnerClassEmoji = classEmojis[winnerClass.toLowerCase()] || '👤';
          const loserClassEmoji = classEmojis[loserClass.toLowerCase()] || '👤';
          
          return `**${formattedDate}** - ${winner} def. ${loser}\n` +
                 `${winnerClassEmoji} ${winnerClass} ${winnerBuild} vs ${loserClassEmoji} ${loserClass} ${loserBuild}\n` +
                 `Type: ${matchType}`;
        }).join('\n\n');
        
        embed.addFields({ 
          name: 'Recent Matches', 
          value: matchDetails,
          inline: false 
        });
      }

      // Create back button
      const backButton = new ButtonBuilder()
        .setCustomId('rankings_back')
        .setLabel('Back to Rankings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔙');

      const row = new ActionRowBuilder()
        .addComponents(backButton);

      await interaction.editReply({ embeds: [embed], components: [row] });
      console.log(`[${timestamp}] Recent matches view completed successfully for ${user.tag} (${user.id})`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching recent matches for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving recent matches.', components: [] });
    }
  },
};