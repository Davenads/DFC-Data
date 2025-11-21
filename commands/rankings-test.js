const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');
const duelDataCache = require('../utils/duelDataCache');
const { getMatchTypeEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings-test')
    .setDescription('View top 10 players per division based on wins (last 100 days)')
    .addStringOption(option =>
      option.setName('division')
        .setDescription('Select the division to view rankings for')
        .setRequired(true)
        .addChoices(
          { name: 'HLD (High Level Dueling)', value: 'HLD' },
          { name: 'LLD (Low Level Dueling)', value: 'LLD' },
          { name: 'Melee', value: 'MELEE' }
        )),

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    const selectedDivision = interaction.options.getString('division');

    console.log(`[${timestamp}] Executing rankings-test command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Division: ${selectedDivision}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      const DAYS = 100;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DAYS);

      console.log(`[${timestamp}] [rankings-test] Starting data fetch for division: ${selectedDivision}`);
      console.log(`[${timestamp}] [rankings-test] Cutoff date: ${cutoffDate.toISOString()}`);

      // Fetch duel data from cache
      const fetchDuelStart = Date.now();
      const duelRows = await duelDataCache.getCachedData();
      console.log(`[${timestamp}] [rankings-test] Fetched ${duelRows.length} duel data rows in ${Date.now() - fetchDuelStart}ms`);

      // Fetch roster data to get champion information (Column G)
      // Use same spreadsheet as rosterCache for consistency
      const fetchRosterStart = Date.now();
      const sheets = google.sheets('v4');
      const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

      const spreadsheetId = process.env.SPREADSHEET_ID; // Same as rosterCache.js

      console.log(`[${timestamp}] [rankings-test] Using spreadsheet ID: ${spreadsheetId.substring(0, 10)}...`);

      const rosterResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: spreadsheetId,
        range: 'Roster!A2:J500', // Same range as rosterCache (columns A-J)
      });

      const rosterRows = rosterResponse.data.values || [];
      console.log(`[${timestamp}] [rankings-test] Fetched ${rosterRows.length} roster rows in ${Date.now() - fetchRosterStart}ms`);

      // Build champion map: { division: arenaName }
      console.log(`[${timestamp}] [rankings-test] Parsing champion data from roster...`);
      const champions = {
        HLD: null,
        LLD: null,
        MELEE: null
      };

      let championCount = 0;
      rosterRows.forEach(row => {
        const arenaName = row[0]; // Column A: Arena Name
        const dataName = row[1];  // Column B: Data Name (for display)
        const currentChamp = row[6]; // Column G: Current Champ

        if (currentChamp && arenaName) {
          const division = currentChamp.toUpperCase();
          if (division === 'HLD' || division === 'LLD' || division === 'MELEE') {
            champions[division] = { arenaName, dataName: dataName || arenaName };
            championCount++;
            console.log(`[${timestamp}] [rankings-test] Found ${division} champion: ${dataName || arenaName}`);
          }
        }
      });

      console.log(`[${timestamp}] [rankings-test] Total champions found: ${championCount}`, champions);

      // Filter matches within last 100 days
      console.log(`[${timestamp}] [rankings-test] Filtering matches by date range...`);
      const filterStart = Date.now();
      const recentMatches = duelRows.filter(row => {
        if (row.length < 9) return false;
        const matchDate = new Date(row[0]);
        return !isNaN(matchDate.getTime()) && matchDate >= cutoffDate;
      });

      console.log(`[${timestamp}] [rankings-test] Filtered to ${recentMatches.length} matches in last ${DAYS} days (took ${Date.now() - filterStart}ms)`);

      // Calculate stats per division per player
      console.log(`[${timestamp}] [rankings-test] Calculating player stats per division...`);
      const calcStart = Date.now();
      const divisions = {
        HLD: {},
        LLD: {},
        MELEE: {}
      };

      let matchTypeCount = { HLD: 0, LLD: 0, MELEE: 0, unknown: 0 };

      // Debug: Log first match structure to find round data columns
      if (recentMatches.length > 0) {
        const sampleMatch = recentMatches[0];
        console.log(`[${timestamp}] [rankings-test] Sample match data (${sampleMatch.length} columns):`,
          sampleMatch.map((val, idx) => `[${idx}]=${val}`).join(', '));
      }

      recentMatches.forEach((match, matchIndex) => {
        const winner = match[1];     // Column B - Winner name
        const loser = match[4];      // Column E - Loser name
        const matchType = (match[8] || '').toUpperCase(); // Column I - Match type

        // Try to find round wins/losses data (check multiple possible indices)
        const roundWins = match[9] || match[7] || match[15] || match[16] || 0;  // Will test which index is correct
        const roundLosses = match[10] || match[8] || match[16] || match[17] || 0; // Will test which index is correct

        // Normalize match type (handle variations)
        let division = matchType;
        if (matchType === 'MELEE') division = 'MELEE';
        else if (matchType === 'HLD') division = 'HLD';
        else if (matchType === 'LLD') division = 'LLD';
        else {
          matchTypeCount.unknown++;
          return; // Skip unknown match types
        }

        matchTypeCount[division]++;

        if (!divisions[division]) return;

        // Track winner stats including rounds
        if (winner) {
          if (!divisions[division][winner]) {
            divisions[division][winner] = { wins: 0, losses: 0, roundsWon: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][winner].wins++;
          divisions[division][winner].duels++;
          divisions[division][winner].roundsWon += parseInt(roundWins) || 0;
          divisions[division][winner].roundsLost += parseInt(roundLosses) || 0;
        }

        // Track loser stats including rounds
        if (loser) {
          if (!divisions[division][loser]) {
            divisions[division][loser] = { wins: 0, losses: 0, roundsWon: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][loser].losses++;
          divisions[division][loser].duels++;
          // Loser gets inverse of winner's rounds
          divisions[division][loser].roundsWon += parseInt(roundLosses) || 0;
          divisions[division][loser].roundsLost += parseInt(roundWins) || 0;
        }

        // Debug first few matches
        if (matchIndex < 3) {
          console.log(`[${timestamp}] [rankings-test] Match ${matchIndex}: ${winner} vs ${loser}, rounds: ${roundWins}-${roundLosses}`);
        }
      });

      console.log(`[${timestamp}] [rankings-test] Stats calculation completed in ${Date.now() - calcStart}ms`);
      console.log(`[${timestamp}] [rankings-test] Match type distribution:`, matchTypeCount);
      console.log(`[${timestamp}] [rankings-test] Unique players per division: HLD=${Object.keys(divisions.HLD).length}, LLD=${Object.keys(divisions.LLD).length}, MELEE=${Object.keys(divisions.MELEE).length}`);

      // Build embed for selected division only
      console.log(`[${timestamp}] [rankings-test] Building embed for ${selectedDivision}...`);
      const players = divisions[selectedDivision];

      if (!players || Object.keys(players).length === 0) {
        console.log(`[${timestamp}] [rankings-test] No player data for ${selectedDivision}`);
        await interaction.editReply({
          content: `⚠️ No ranking data available for ${selectedDivision} in the last ${DAYS} days.`,
          ephemeral: true
        });
        return;
      }

      console.log(`[${timestamp}] [rankings-test] Found ${Object.keys(players).length} players in ${selectedDivision}`);

      // Calculate win%, ARL, and sort
      const sortStart = Date.now();
      const sortedPlayers = Object.entries(players)
        .map(([name, stats]) => {
          const totalMatches = stats.wins + stats.losses;
          const winRate = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;
          const duels = stats.duels || totalMatches;
          const arl = duels > 0 ? (stats.roundsLost / duels) : 0; // Average Rounds Lost per duel
          return {
            name,
            wins: stats.wins,
            losses: stats.losses,
            winRate,
            totalMatches,
            arl,
            roundsWon: stats.roundsWon || 0,
            roundsLost: stats.roundsLost || 0,
            duels
          };
        })
        .filter(p => p.totalMatches > 0) // Only players with matches
        .sort((a, b) => {
          // Primary sort: wins (descending)
          if (b.wins !== a.wins) return b.wins - a.wins;
          // Tiebreaker: win% (descending)
          return b.winRate - a.winRate;
        })
        .slice(0, 10); // Top 10

      console.log(`[${timestamp}] [rankings-test] Sorted and filtered to top ${sortedPlayers.length} players (took ${Date.now() - sortStart}ms)`);

      if (sortedPlayers.length === 0) {
        console.log(`[${timestamp}] [rankings-test] No players with matches in ${selectedDivision}`);
        await interaction.editReply({
          content: `⚠️ No ranking data available for ${selectedDivision} in the last ${DAYS} days.`,
          ephemeral: true
        });
        return;
      }

      // Log top 3 for debugging
      console.log(`[${timestamp}] [rankings-test] Top 3 in ${selectedDivision}:`,
        sortedPlayers.slice(0, 3).map((p, i) =>
          `${i + 1}. ${p.name} (${p.wins}W/${p.losses}L - ${p.winRate.toFixed(1)}% - ARL:${p.arl.toFixed(2)})`
        ).join(', ')
      );

      const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Gold color
        .setTitle(`${getMatchTypeEmoji(selectedDivision)} ${selectedDivision} Rankings (Last ${DAYS} Days)`)
        .setTimestamp()
        .setFooter({ text: 'DFC Rankings - Win-Based (Last 100 Days)' });

      // Build description with champion at the top (if exists)
      console.log(`[${timestamp}] [rankings-test] Building embed description...`);
      let description = '';

      const champion = champions[selectedDivision];
      if (champion) {
        console.log(`[${timestamp}] [rankings-test] ${selectedDivision} champion: ${champion.dataName || champion.arenaName}`);
        // Find champion's stats in the ranking
        const championStats = sortedPlayers.find(p =>
          p.name.toLowerCase() === champion.arenaName.toLowerCase()
        );

        if (championStats) {
          console.log(`[${timestamp}] [rankings-test] Champion has recent stats: ${championStats.wins}W/${championStats.losses}L, ARL: ${championStats.arl.toFixed(2)}`);
          description += `**👑 CHAMPION**\n`;
          description += `**${champion.dataName}** - ${championStats.wins}W/${championStats.losses}L (${championStats.winRate.toFixed(1)}%) - ARL ${championStats.arl.toFixed(2)}\n\n`;
          description += `**━━━━━━━━━━━━━━━━**\n\n`;
        } else {
          // Champion exists but has no recent matches in last 100 days
          console.log(`[${timestamp}] [rankings-test] Champion has no recent matches`);
          description += `**👑 CHAMPION**\n`;
          description += `**${champion.dataName}** - No recent matches\n\n`;
          description += `**━━━━━━━━━━━━━━━━**\n\n`;
        }
      } else {
        console.log(`[${timestamp}] [rankings-test] No champion set for ${selectedDivision}`);
      }

      // Add top 10 rankings (excluding champion if already shown)
      const championName = champion ? champion.arenaName.toLowerCase() : null;
      let rank = 1;
      let playersAdded = 0;

      sortedPlayers.forEach((player) => {
        // Skip champion in regular rankings
        if (championName && player.name.toLowerCase() === championName) {
          console.log(`[${timestamp}] [rankings-test] Skipping champion ${player.name} in regular rankings`);
          return;
        }

        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
        description += `${medal} **${player.name}** - ${player.wins}W/${player.losses}L (${player.winRate.toFixed(1)}%) - ARL ${player.arl.toFixed(2)}\n`;
        rank++;
        playersAdded++;

        // Limit to top 10 (excluding champion)
        if (rank > 10) return;
      });

      console.log(`[${timestamp}] [rankings-test] Added ${playersAdded} players to rankings`);

      // Check embed character limits (Discord limit: 4096 for description)
      const EMBED_DESC_LIMIT = 4096;
      if (description.length > EMBED_DESC_LIMIT) {
        console.warn(`[${timestamp}] [rankings-test] ⚠️ Description exceeds limit! Length: ${description.length}/${EMBED_DESC_LIMIT}`);
        description = description.substring(0, EMBED_DESC_LIMIT - 50) + '\n\n*[Truncated due to length]*';
      } else {
        console.log(`[${timestamp}] [rankings-test] Description character count: ${description.length}/${EMBED_DESC_LIMIT}`);
      }

      embed.setDescription(description || 'No data available for this division.');

      console.log(`[${timestamp}] [rankings-test] Sending embed to user...`);
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });

      console.log(`[${timestamp}] [rankings-test] ✅ Command completed successfully for ${user.tag} (${user.id}) - Division: ${selectedDivision}, Players shown: ${playersAdded}`);

    } catch (error) {
      console.error(`[${timestamp}] [rankings-test] ❌ Error executing rankings-test command:`, error);
      console.error(`[${timestamp}] [rankings-test] Error name: ${error.name}`);
      console.error(`[${timestamp}] [rankings-test] Error message: ${error.message}`);
      console.error(`[${timestamp}] [rankings-test] Stack trace:`, error.stack);

      const errorMessage = '⚠️ **Error**: Failed to fetch rankings data. Please try again later.';

      try {
        await interaction.editReply({
          content: errorMessage,
          ephemeral: true
        });
        console.log(`[${timestamp}] [rankings-test] Error message sent to user`);
      } catch (followUpError) {
        console.error(`[${timestamp}] [rankings-test] Failed to send error message:`, followUpError);
        console.error(`[${timestamp}] [rankings-test] Follow-up error stack:`, followUpError.stack);
      }
    }
  },
};
