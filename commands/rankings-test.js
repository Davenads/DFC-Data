const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');
const duelDataCache = require('../utils/duelDataCache');
const { getMatchTypeEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings-test')
    .setDescription('View top 30 players per division based on wins (last 100 days)')
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

        // Column H (index 7) = Round Losses from winner's perspective
        // In Bo5 (first to 3), winner loses match[7] rounds, loser always loses 3 rounds
        const winnerRoundsLost = parseInt(match[7]) || 0;
        const loserRoundsLost = 3; // Standard Bo5 format (first to 3)

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
            divisions[division][winner] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][winner].wins++;
          divisions[division][winner].duels++;
          divisions[division][winner].roundsLost += winnerRoundsLost;
        }

        // Track loser stats including rounds
        if (loser) {
          if (!divisions[division][loser]) {
            divisions[division][loser] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][loser].losses++;
          divisions[division][loser].duels++;
          divisions[division][loser].roundsLost += loserRoundsLost;
        }

        // Debug first few matches
        if (matchIndex < 3) {
          console.log(`[${timestamp}] [rankings-test] Match ${matchIndex}: ${winner} (lost ${winnerRoundsLost} rounds) vs ${loser} (lost ${loserRoundsLost} rounds)`);
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
        }); // Get all players, will slice to top 10 later

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

      const PLAYERS_PER_PAGE = 15;
      const top30 = sortedPlayers.slice(0, 30);
      const totalPages = Math.ceil(top30.length / PLAYERS_PER_PAGE);

      const champion = champions[selectedDivision];
      const championName = champion ? champion.arenaName.toLowerCase() : null;

      if (champion) {
        console.log(`[${timestamp}] [rankings-test] ${selectedDivision} champion: ${champion.dataName || champion.arenaName}`);
      }

      // Helper function to build embed for a specific page
      const buildEmbed = (page) => {
        const start = (page - 1) * PLAYERS_PER_PAGE;
        const end = start + PLAYERS_PER_PAGE;
        const pagePlayers = top30.slice(start, end);

        console.log(`[${timestamp}] [rankings-test] Building embed for page ${page}/${totalPages}...`);
        let description = '';

        pagePlayers.forEach((player, index) => {
          const rank = start + index + 1; // Actual rank position (not page-relative)
          const isChampion = championName && player.name.toLowerCase() === championName;

          // Add medal/rank indicator based on ladder position
          let indicator;
          if (rank === 1) {
            indicator = '🥇';
          } else if (rank === 2) {
            indicator = '🥈';
          } else if (rank === 3) {
            indicator = '🥉';
          } else {
            indicator = `**${rank}.**`;
          }

          // Build base line
          let line = `${indicator} **${player.name}** - ${player.wins}W/${player.losses}L (${player.winRate.toFixed(1)}%) - ARL ${player.arl.toFixed(2)}`;

          // Append champion indicator at the end if applicable
          if (isChampion) {
            line += ' - 👑';
            console.log(`[${timestamp}] [rankings-test] Champion ${player.name} at rank ${rank} with ARL: ${player.arl.toFixed(2)}`);
          }

          description += `${line}\n`;
        });

        // Check embed character limits (Discord limit: 4096 for description)
        const EMBED_DESC_LIMIT = 4096;
        if (description.length > EMBED_DESC_LIMIT) {
          console.warn(`[${timestamp}] [rankings-test] ⚠️ Description exceeds limit! Length: ${description.length}/${EMBED_DESC_LIMIT}`);
          description = description.substring(0, EMBED_DESC_LIMIT - 50) + '\n\n*[Truncated due to length]*';
        }

        console.log(`[${timestamp}] [rankings-test] Page ${page} description length: ${description.length}/${EMBED_DESC_LIMIT}`);

        const embed = new EmbedBuilder()
          .setColor(0xFFD700) // Gold color
          .setTitle(`${getMatchTypeEmoji(selectedDivision)} ${selectedDivision} Rankings (Last ${DAYS} Days) - Page ${page}/${totalPages}`)
          .setDescription(description || 'No data available for this page.')
          .setTimestamp()
          .setFooter({ text: 'DFC Rankings - Win-Based (Last 100 Days)' });

        return embed;
      };

      // Build navigation buttons
      const buildButtons = (page) => {
        const row = new ActionRowBuilder();

        const prevButton = new ButtonBuilder()
          .setCustomId(`rankings_test_prev_${selectedDivision}_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rankings_test_next_${selectedDivision}_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages);

        const pageInfo = new ButtonBuilder()
          .setCustomId(`rankings_test_pageinfo_${page}`)
          .setLabel(`Page ${page}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        row.addComponents(prevButton, pageInfo, nextButton);
        return row;
      };

      // Send initial embed with page 1
      const currentPage = 1;
      const embed = buildEmbed(currentPage);
      const buttons = totalPages > 1 ? buildButtons(currentPage) : null;

      console.log(`[${timestamp}] [rankings-test] Sending embed to user (Page 1/${totalPages})...`);
      await interaction.editReply({
        embeds: [embed],
        components: buttons ? [buttons] : [],
        ephemeral: true
      });

      console.log(`[${timestamp}] [rankings-test] ✅ Command completed successfully for ${user.tag} (${user.id}) - Division: ${selectedDivision}, Total players: ${top30.length}, Pages: ${totalPages}`);

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

  async handleButton(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;

    // Parse customId: rankings_test_[action]_[division]_[currentPage]
    const parts = interaction.customId.split('_');
    const action = parts[2]; // 'prev', 'next', or 'pageinfo'
    const selectedDivision = parts[3]; // 'HLD', 'LLD', or 'MELEE'
    const currentPage = parseInt(parts[4]);

    console.log(`[${timestamp}] [rankings-test] Button clicked:`, {
      action,
      division: selectedDivision,
      currentPage,
      user: user.tag
    });

    // Ignore pageinfo button clicks (it's disabled)
    if (action === 'pageinfo') {
      return;
    }

    await interaction.deferUpdate();

    try {
      const DAYS = 100;
      const PLAYERS_PER_PAGE = 15;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DAYS);

      // Fetch duel data from cache
      const duelRows = await duelDataCache.getCachedData();

      // Fetch roster data for champion information
      const sheets = google.sheets('v4');
      const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
      const spreadsheetId = process.env.SPREADSHEET_ID;

      const rosterResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: spreadsheetId,
        range: 'Roster!A2:J500',
      });

      const rosterRows = rosterResponse.data.values || [];

      // Build champion map
      const champions = {
        HLD: null,
        LLD: null,
        MELEE: null
      };

      rosterRows.forEach(row => {
        const arenaName = row[0];
        const dataName = row[1];
        const currentChamp = row[6];

        if (currentChamp && arenaName) {
          const division = currentChamp.toUpperCase();
          if (division === 'HLD' || division === 'LLD' || division === 'MELEE') {
            champions[division] = { arenaName, dataName: dataName || arenaName };
          }
        }
      });

      // Filter matches within last 100 days
      const recentMatches = duelRows.filter(row => {
        if (row.length < 9) return false;
        const matchDate = new Date(row[0]);
        return !isNaN(matchDate.getTime()) && matchDate >= cutoffDate;
      });

      // Calculate stats per division per player
      const divisions = {
        HLD: {},
        LLD: {},
        MELEE: {}
      };

      recentMatches.forEach((match) => {
        const winner = match[1];
        const loser = match[4];
        const matchType = (match[8] || '').toUpperCase();
        const winnerRoundsLost = parseInt(match[7]) || 0;
        const loserRoundsLost = 3;

        let division = matchType;
        if (!['HLD', 'LLD', 'MELEE'].includes(division)) return;

        if (!divisions[division]) return;

        // Track winner stats
        if (winner) {
          if (!divisions[division][winner]) {
            divisions[division][winner] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][winner].wins++;
          divisions[division][winner].duels++;
          divisions[division][winner].roundsLost += winnerRoundsLost;
        }

        // Track loser stats
        if (loser) {
          if (!divisions[division][loser]) {
            divisions[division][loser] = { wins: 0, losses: 0, roundsLost: 0, duels: 0 };
          }
          divisions[division][loser].losses++;
          divisions[division][loser].duels++;
          divisions[division][loser].roundsLost += loserRoundsLost;
        }
      });

      // Build rankings for selected division
      const players = divisions[selectedDivision];

      if (!players || Object.keys(players).length === 0) {
        await interaction.editReply({
          content: `⚠️ No ranking data available for ${selectedDivision} in the last ${DAYS} days.`,
          components: []
        });
        return;
      }

      // Calculate and sort players
      const sortedPlayers = Object.entries(players)
        .map(([name, stats]) => {
          const totalMatches = stats.wins + stats.losses;
          const winRate = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;
          const duels = stats.duels || totalMatches;
          const arl = duels > 0 ? (stats.roundsLost / duels) : 0;
          return {
            name,
            wins: stats.wins,
            losses: stats.losses,
            winRate,
            totalMatches,
            arl,
            roundsLost: stats.roundsLost || 0,
            duels
          };
        })
        .filter(p => p.totalMatches > 0)
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.winRate - a.winRate;
        });

      const top30 = sortedPlayers.slice(0, 30);
      const totalPages = Math.ceil(top30.length / PLAYERS_PER_PAGE);

      // Calculate new page based on action
      let newPage = currentPage;
      if (action === 'prev') {
        newPage = Math.max(1, currentPage - 1);
      } else if (action === 'next') {
        newPage = Math.min(totalPages, currentPage + 1);
      }

      console.log(`[${timestamp}] [rankings-test] Navigating from page ${currentPage} to ${newPage}`);

      const champion = champions[selectedDivision];
      const championName = champion ? champion.arenaName.toLowerCase() : null;

      // Build embed for new page
      const buildEmbed = (page) => {
        const start = (page - 1) * PLAYERS_PER_PAGE;
        const end = start + PLAYERS_PER_PAGE;
        const pagePlayers = top30.slice(start, end);

        let description = '';

        pagePlayers.forEach((player, index) => {
          const rank = start + index + 1;
          const isChampion = championName && player.name.toLowerCase() === championName;

          let indicator;
          if (rank === 1) {
            indicator = '🥇';
          } else if (rank === 2) {
            indicator = '🥈';
          } else if (rank === 3) {
            indicator = '🥉';
          } else {
            indicator = `**${rank}.**`;
          }

          let line = `${indicator} **${player.name}** - ${player.wins}W/${player.losses}L (${player.winRate.toFixed(1)}%) - ARL ${player.arl.toFixed(2)}`;

          if (isChampion) {
            line += ' - 👑';
          }

          description += `${line}\n`;
        });

        // Check embed character limits (Discord limit: 4096 for description)
        const EMBED_DESC_LIMIT = 4096;
        if (description.length > EMBED_DESC_LIMIT) {
          console.warn(`[${timestamp}] [rankings-test] ⚠️ Page ${page} description exceeds limit! Length: ${description.length}/${EMBED_DESC_LIMIT}`);
          description = description.substring(0, EMBED_DESC_LIMIT - 50) + '\n\n*[Truncated due to length]*';
        }

        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle(`${getMatchTypeEmoji(selectedDivision)} ${selectedDivision} Rankings (Last ${DAYS} Days) - Page ${page}/${totalPages}`)
          .setDescription(description || 'No data available for this page.')
          .setTimestamp()
          .setFooter({ text: 'DFC Rankings - Win-Based (Last 100 Days)' });

        return embed;
      };

      // Build buttons for new page
      const buildButtons = (page) => {
        const row = new ActionRowBuilder();

        const prevButton = new ButtonBuilder()
          .setCustomId(`rankings_test_prev_${selectedDivision}_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rankings_test_next_${selectedDivision}_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages);

        const pageInfo = new ButtonBuilder()
          .setCustomId(`rankings_test_pageinfo_${page}`)
          .setLabel(`Page ${page}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        row.addComponents(prevButton, pageInfo, nextButton);
        return row;
      };

      const embed = buildEmbed(newPage);
      const buttons = totalPages > 1 ? buildButtons(newPage) : null;

      await interaction.editReply({
        embeds: [embed],
        components: buttons ? [buttons] : []
      });

      console.log(`[${timestamp}] [rankings-test] ✅ Page navigation successful - User: ${user.tag}, Division: ${selectedDivision}, Page: ${newPage}/${totalPages}`);

    } catch (error) {
      console.error(`[${timestamp}] [rankings-test] ❌ Error in button handler:`, error);

      try {
        await interaction.editReply({
          content: '⚠️ **Error**: Failed to navigate pages. Please try the command again.',
          components: []
        });
      } catch (followUpError) {
        console.error(`[${timestamp}] [rankings-test] Failed to send error message:`, followUpError);
      }
    }
  },
};
