const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');
const duelDataCache = require('../utils/duelDataCache');
const rankingsCache = require('../utils/rankingsCache');
const { getClassEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('Get the official DFC rankings')
    .addStringOption(option =>
      option.setName('division')
        .setDescription('The division to view rankings for')
        .setRequired(true)
        .addChoices(
          { name: 'HLD', value: 'HLD' },
          { name: 'LLD', value: 'LLD' },
          { name: 'Melee', value: 'Melee' }
        )),

  async generateRankingsEmbed(division) {
    // Fetch rankings from cache
    const divisionData = await rankingsCache.getCachedRankings(division);

    if (!divisionData) {
      throw new Error(`No rankings data found for division: ${division}`);
    }

    const { champion, rankedPlayers } = divisionData;

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Gold color
      .setTitle(`🏆 Official DFC Rankings - ${division}`)
      .setDescription(`The current official ${division} rankings based on tournament performance.`)
      .setTimestamp()
      .setFooter({ text: `DFC Official Rankings - ${division}` });

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
      .setCustomId(`rankings_recent_matches_${division}`)
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
    const division = interaction.options.getString('division');

    console.log(`[${timestamp}] Executing rankings command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Division: ${division}`);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts
    }

    try {
      const rankingsData = await this.generateRankingsEmbed(division);
      await interaction.editReply({ ...rankingsData, ephemeral: true });
      console.log(`[${timestamp}] Rankings command completed successfully for ${user.tag} (${user.id}) - Division: ${division}`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching rankings for ${user.tag} (${user.id}) - Division: ${division}`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving the rankings.', ephemeral: true });
    }
  },

  async handleButton(interaction) {
    console.log(`Rankings handleButton called with customId: ${interaction.customId}`);

    // Extract division from customId
    const customIdParts = interaction.customId.split('_');
    const division = customIdParts[customIdParts.length - 1]; // Last part is the division

    if (interaction.customId.startsWith('rankings_back_')) {
      // Handle back button - show original rankings
      await interaction.deferUpdate();
      try {
        const rankingsData = await this.generateRankingsEmbed(division);
        await interaction.editReply(rankingsData);
        console.log(`[${interaction.user.tag}] Returned to rankings view - Division: ${division}`);
      } catch (error) {
        console.error('Error returning to rankings:', error);
        await interaction.editReply({ content: 'There was an error returning to rankings.', components: [] });
      }
      return;
    }

    if (!interaction.customId.startsWith('rankings_recent_matches_')) return;

    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

    console.log(`[${timestamp}] Handling recent matches button:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Division: ${division}`);

    await interaction.deferUpdate();

    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      // Get top players from rankings cache
      const divisionData = await rankingsCache.getCachedRankings(division);

      if (!divisionData) {
        throw new Error(`No rankings data found for division: ${division}`);
      }

      const { champion, rankedPlayers } = divisionData;
      const topPlayers = new Set();

      // Add champion
      if (champion) {
        topPlayers.add(champion.toLowerCase());
      }

      // Add top 20 ranked players
      rankedPlayers.forEach(player => {
        if (player.name) {
          topPlayers.add(player.name.toLowerCase());
        }
      });

      // Get recent matches from Duel Data involving top players
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const duelRows = await duelDataCache.getCachedData();

      // Filter matches involving top players in the last 7 days for this division
      const recentTopPlayerMatches = duelRows.filter(row => {
        if (row.length < 9) return false;

        const matchDate = new Date(row[0]);
        if (isNaN(matchDate.getTime()) || matchDate < thirtyDaysAgo) return false;

        const matchType = row[8] || ''; // Match Type column
        if (matchType !== division) return false; // Filter by division

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
        .setTitle(`⚔️ Recent Top Player Matches - ${division}`)
        .setDescription(`Recent ${division} matches involving players from the Official Rankings (last 30 days)`)
        .setTimestamp()
        .setFooter({ text: `DFC Recent Matches - ${division}` });

      if (matchesToShow.length === 0) {
        embed.addFields({ 
          name: 'No Recent Matches', 
          value: 'No recent matches found involving top players in the last 7 days.',
          inline: false 
        });
      } else {
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

          const winnerClassEmoji = getClassEmoji(winnerClass);
          const loserClassEmoji = getClassEmoji(loserClass);
          
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
        .setCustomId(`rankings_back_${division}`)
        .setLabel('Back to Rankings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔙');

      const row = new ActionRowBuilder()
        .addComponents(backButton);

      await interaction.editReply({ embeds: [embed], components: [row] });
      console.log(`[${timestamp}] Recent matches view completed successfully for ${user.tag} (${user.id}) - Division: ${division}`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching recent matches for ${user.tag} (${user.id}) - Division: ${division}`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving recent matches.', components: [] });
    }
  },
};