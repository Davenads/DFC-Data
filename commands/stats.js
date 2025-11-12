const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');
const duelDataCache = require('../utils/duelDataCache');
const rosterCache = require('../utils/rosterCache');
const rankingsCache = require('../utils/rankingsCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Get simplified stats for a player (W/L, winrate, and rank)')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('The player to get stats for')
        .setAutocomplete(true)
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to analyze (defaults to all-time data, use large number for all-time)')
        .setRequired(false)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const focusedValue = interaction.options.getFocused();
    const user = interaction.user;

    console.log(`[${timestamp}] [AUTOCOMPLETE] Started for user: ${user.tag} (${user.id}), search: "${focusedValue}"`);

    try {
      // Get the guild and find the DFC Dueler role
      const guild = interaction.guild;
      if (!guild) {
        console.log(`[${timestamp}] [AUTOCOMPLETE] No guild found, returning empty results`);
        await interaction.respond([]);
        return;
      }

      const dfcDuelerRole = guild.roles.cache.find(role => role.name === 'DFC Dueler');
      if (!dfcDuelerRole) {
        console.error(`[${timestamp}] [AUTOCOMPLETE] DFC Dueler role not found`);
        await interaction.respond([]);
        return;
      }

      // Fetch all members with the DFC Dueler role and roster data in parallel
      const fetchStart = Date.now();
      const [, roster] = await Promise.all([
        guild.members.fetch(),
        rosterCache.getCachedRoster()
      ]);
      console.log(`[${timestamp}] [AUTOCOMPLETE] Guild members and roster fetched in ${Date.now() - fetchStart}ms`);

      // Get members with DFC Dueler role who are registered in the roster
      const duelerPlayers = [];
      guild.members.cache.forEach(member => {
        if (member.roles.cache.has(dfcDuelerRole.id)) {
          const rosterEntry = roster[member.id];
          if (rosterEntry && rosterEntry.arenaName) {
            duelerPlayers.push({
              arenaName: rosterEntry.arenaName,
              discordName: member.displayName,
              uuid: member.id
            });
          }
        }
      });

      console.log(`[${timestamp}] [AUTOCOMPLETE] Found ${duelerPlayers.length} DFC Duelers registered in roster`);

      const searchTerm = focusedValue.toLowerCase();

      // Don't show results for empty search - prevents overwhelming autocomplete
      if (searchTerm.length === 0) {
        await interaction.respond([]);
        return;
      }

      // Filter by search term matching Arena Name or Discord name
      const filteredPlayers = duelerPlayers.filter(player =>
        player.arenaName.toLowerCase().includes(searchTerm) ||
        player.discordName.toLowerCase().includes(searchTerm)
      ).slice(0, 25); // Limit to 25 players to meet Discord's requirements

      const results = filteredPlayers.map(player => ({
        name: player.arenaName,
        value: player.arenaName
      }));

      await interaction.respond(results);
      const totalTime = Date.now() - startTime;
      console.log(`[${timestamp}] [AUTOCOMPLETE] Completed in ${totalTime}ms - returned ${results.length} results for "${searchTerm}"`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching DFC Duelers for autocomplete by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);

      // Provide fallback suggestions based on search term
      const searchTerm = focusedValue.toLowerCase();
      let fallbackResults = [];

      if (searchTerm.length > 0) {
        // Provide a fallback suggestion that allows manual entry
        fallbackResults = [{
          name: `Type "${searchTerm}" manually (autocomplete unavailable)`,
          value: searchTerm
        }];
      }

      await interaction.respond(fallbackResults);
      const totalTime = Date.now() - startTime;
      console.log(`[${timestamp}] [AUTOCOMPLETE] Error fallback completed in ${totalTime}ms`);
    }
  },

  async execute(interaction, sheets, auth, prefixArgs = []) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const user = interaction.user || interaction.author;
    
    // Handle both slash commands and prefix commands
    let playerName, inputDays;
    
    // Better detection: check if prefixArgs were passed (indicates prefix command)
    // or if interaction has the isCommand method (real slash command)
    const isSlashCommand = prefixArgs.length === 0 && 
      interaction.isCommand && typeof interaction.isCommand === 'function';
    const commandType = isSlashCommand ? 'SLASH' : 'TEXT';
    
    console.log(`[${timestamp}] [${commandType}] Stats command started - User: ${user.tag} (${user.id})`);
    
    const paramStart = Date.now();
    console.log(`[${timestamp}] [${commandType}] Parsing parameters...`);
    
    if (isSlashCommand) {
      // Real slash command
      playerName = interaction.options.getString('player');
      inputDays = interaction.options.getInteger('days');
    } else {
      // Prefix command (!stats)
      const args = prefixArgs;

      // Parse arguments: !stats [player] [days]
      if (args.length > 0) {
        playerName = args[0];

        // Check if playerName is a user mention (e.g., <@123456789012345678> or <@!123456789012345678>)
        const userMentionMatch = playerName.match(/^<@!?(\d+)>$/);
        if (userMentionMatch) {
          const userId = userMentionMatch[1];
          console.log(`[${timestamp}] [${commandType}] User mention detected: ${userId}`);

          // Look up the user in the roster cache
          try {
            const rosterEntry = await rosterCache.getUserByUUID(userId);
            if (rosterEntry && rosterEntry.arenaName) {
              playerName = rosterEntry.arenaName;
              console.log(`[${timestamp}] [${commandType}] Found Arena Name from roster: ${playerName}`);
            } else {
              console.log(`[${timestamp}] [${commandType}] User ${userId} not found in roster`);
              return interaction.reply({
                content: `⚠️ **Error**: The mentioned user isn't currently in the roster data.\n\nPlease make sure they have registered using the /register command.`,
                ephemeral: true
              });
            }
          } catch (error) {
            console.error(`[${timestamp}] [${commandType}] Error looking up user in roster:`, error);
            return interaction.reply({
              content: `⚠️ **Error**: Failed to look up user in roster. Please try again later.`,
              ephemeral: true
            });
          }
        }

        // Second argument would be days if it's a number
        if (args.length > 1 && !isNaN(parseInt(args[1]))) {
          inputDays = parseInt(args[1]);
        }
      }
    }

    console.log(`[${timestamp}] [${commandType}] Parameters parsed in ${Date.now() - paramStart}ms - Player: ${playerName}, Days: ${inputDays}`);
    
    const days = inputDays || 100; // Default to 100 days if no input provided
    const usedDaysParam = true; // Always show days notation since we always filter by days
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] [${commandType}] Stats command requested by ${user.tag} (${user.id}) for player: ${playerName}, days: ${days}`);
    
    // Check if player name is provided (mainly for the !stats version)
    if (!playerName) {
      console.log(`[${timestamp}] Missing player name for stats command from ${user.tag} (${user.id})`);
      
      const commandType = interaction.commandName ? 'slash command' : 'prefix command';
      let usageMessage = '';
      
      if (commandType === 'slash command') {
        usageMessage = 'Please use the autocomplete feature to select a player name.';
      } else {
        usageMessage = 'Please provide a player name. Example: `!stats PlayerName`';
      }
      
      return interaction.reply({ 
        content: `⚠️ **Error**: Missing player name.\n\n${usageMessage}`, 
        ephemeral: true 
      });
    }
    
    console.log(`[${timestamp}] Executing stats command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Player: ${playerName}
    Days: ${days} ${usedDaysParam ? '(specified)' : '(default)'}`);
    
    // Use sheets and auth from parameters if provided, otherwise create them
    const sheetsInstance = sheets || google.sheets('v4');
    const authInstance = auth || createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    // Skip deferReply for text commands to reduce overhead
    if (isSlashCommand) {
      const deferStart = Date.now();
      console.log(`[${timestamp}] [${commandType}] Deferring reply...`);
      await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts
      console.log(`[${timestamp}] [${commandType}] Reply deferred in ${Date.now() - deferStart}ms`);
    }

    try {
      // Validate player exists in roster
      const rosterStart = Date.now();
      console.log(`[${timestamp}] [${commandType}] Validating player against roster...`);

      const roster = await rosterCache.getCachedRoster();
      const rosterEntries = Object.values(roster);
      const playerInRoster = rosterEntries.find(entry =>
        entry.arenaName && entry.arenaName.toLowerCase() === playerName.toLowerCase()
      );

      if (!playerInRoster) {
        console.log(`[${timestamp}] [${commandType}] Player ${playerName} not found in roster`);

        const errorMessage = `⚠️ **Error**: Player **${playerName}** isn't currently in the roster data.\n\n` +
          `Please make sure:\n` +
          `• The player name is spelled correctly\n` +
          `• The player has registered using the /register command\n` +
          `• You selected from the autocomplete suggestions (slash command only)`;

        if (isSlashCommand) {
          return interaction.editReply({ content: errorMessage, ephemeral: true });
        } else {
          return interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }

      console.log(`[${timestamp}] [${commandType}] Player validated in roster in ${Date.now() - rosterStart}ms`);

      // Get rankings and duel data (no ELO data needed for simplified stats)
      const dataStart = Date.now();
      console.log(`[${timestamp}] [${commandType}] Fetching rankings and duel data...`);

      const [rankingsRows, duelRows] = await Promise.all([
        rankingsCache.getCachedRankings(),
        duelDataCache.getCachedData()
      ]);

      console.log(`[${timestamp}] [${commandType}] Data fetched in ${Date.now() - dataStart}ms`);

      // Check if player exists in duel data
      const playerMatches = duelRows.filter(row => {
        if (row.length < 5) return false;
        const winner = row[1]; // Column B - Winner name
        const loser = row[4];  // Column E - Loser name
        return winner?.toLowerCase() === playerName.toLowerCase() || 
               loser?.toLowerCase() === playerName.toLowerCase();
      });

      if (playerMatches.length === 0) {
        console.log(`[${timestamp}] Player ${playerName} not found for stats requested by ${user.tag} (${user.id})`);
        
        // Find similar player names for suggestions from duel data
        const allPlayerNames = [];
        duelRows.forEach(row => {
          if (row.length >= 5) {
            if (row[1]) allPlayerNames.push(row[1]); // Winner (Column B)
            if (row[4]) allPlayerNames.push(row[4]); // Loser (Column E)
          }
        });
        const uniquePlayerNames = [...new Set(allPlayerNames)];
        
        // Calculate similarity score (basic implementation using character matching)
        const getSimilarityScore = (name1, name2) => {
          name1 = name1.toLowerCase();
          name2 = name2.toLowerCase();
          
          // Simple matching - what percentage of characters match?
          let score = 0;
          const minLength = Math.min(name1.length, name2.length);
          
          // First check if one name contains the other
          if (name1.includes(name2) || name2.includes(name1)) {
            score += 0.5; // Boost score for partial matches
          }
          
          // Check if name starts with the search term
          if (name2.startsWith(name1)) {
            score += 0.3;
          }
          
          // Count matching characters
          for (let i = 0; i < minLength; i++) {
            if (name1[i] === name2[i]) score += 0.2;
          }
          
          return score;
        };
        
        // Find players with similar names
        const similarPlayers = uniquePlayerNames
          .map(name => ({
            name,
            score: getSimilarityScore(playerName, name)
          }))
          .filter(player => player.score > 0.3) // Only reasonably similar names
          .sort((a, b) => b.score - a.score)
          .slice(0, 3); // Get top 3 matches
        
        let notFoundMessage = `Player **${playerName}** not found.`;
        
        // Add suggestions if any similar players were found
        if (similarPlayers.length > 0) {
          notFoundMessage += `\n\nDid you mean one of these players?`;
          similarPlayers.forEach(player => {
            notFoundMessage += `\n• ${player.name}`;
          });
          notFoundMessage += `\n\nTry using the command again with the correct player name.`;
        } else {
          notFoundMessage += `\n\nPlease check the spelling or use the autocomplete feature when using the slash command.`;
        }
        
        if (isSlashCommand) {
          return interaction.editReply({ content: notFoundMessage, ephemeral: true });
        } else {
          return interaction.reply({ content: notFoundMessage, ephemeral: true });
        }
      }

      // Player exists in duel data, continue with stats calculation

      // Rankings data already fetched concurrently above
      console.log(`[${timestamp}] [${commandType}] Processing rankings data (${rankingsRows.length} rows)...`);
      
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
        .setTitle(`📊 Stats for ${playerName} (Last ${days} Days)`)
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

      // Stats will be calculated after date filtering
      let matchTypeStats = {};
      let processedMatchTypes = new Set();

      // Filter matches by date range for additional analysis
      let recentMatches = [];
      let filteredMatches = []; // For days-based filtering
      
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Calculate cutoff date based on days parameter (default 100 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        console.log(`[${timestamp}] [${commandType}] Filtering ${playerMatches.length} matches by date range`);
        
        // Use already-fetched playerMatches and filter by date
        console.log(`[${timestamp}] Found ${playerMatches.length} total matches for player ${playerName}`);
        
        // Filter matches based on days parameter (default 100 days)
        filteredMatches = playerMatches.filter(row => {
          const matchDate = new Date(row[0]);
          return !isNaN(matchDate.getTime()) && matchDate >= cutoffDate;
        });
        console.log(`[${timestamp}] Found ${filteredMatches.length} matches in last ${days} days for player ${playerName}`);
        
        // Calculate W/L stats from filtered matches
        console.log(`[${timestamp}] [${commandType}] Calculating W/L stats from ${filteredMatches.length} filtered matches`);
        
        let totalWins = 0;
        let totalLosses = 0;
        
        filteredMatches.forEach(match => {
          if (match.length < 5) return;
          
          const eventDate = match[0]; // Column A
          const winner = match[1];     // Column B - Winner name
          const matchType = match[8] || 'Unknown'; // Column I - Match type
          const loser = match[4];      // Column E - Loser name
          
          if (!matchTypeStats[matchType]) {
            matchTypeStats[matchType] = { wins: 0, losses: 0 };
          }
          
          if (winner?.toLowerCase() === playerName.toLowerCase()) {
            matchTypeStats[matchType].wins++;
            totalWins++;
          } else if (loser?.toLowerCase() === playerName.toLowerCase()) {
            matchTypeStats[matchType].losses++;
            totalLosses++;
          }
        });
        
        // Add overall stats to embed
        const totalMatches = totalWins + totalLosses;
        const overallWinrate = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0.0';
        
        embed.addFields({
          name: '📊 Overall Stats',
          value: `W/L: ${totalWins}/${totalLosses}\nWinrate: ${overallWinrate}%\nTotal Matches: ${totalMatches}`,
          inline: true
        });
        
        // Add match type breakdown
        Object.entries(matchTypeStats).forEach(([matchType, stats]) => {
          const matches = stats.wins + stats.losses;
          const winrate = matches > 0 ? ((stats.wins / matches) * 100).toFixed(1) : '0.0';
          
          embed.addFields({
            name: matchType,
            value: `W/L: ${stats.wins}/${stats.losses}\nWinrate: ${winrate}%`,
            inline: true
          });
        });
        
        processedMatchTypes = new Set(Object.keys(matchTypeStats));
        
        // Find matches within last 30 days for recent matches section
        recentMatches = playerMatches.filter(row => {
          const matchDate = new Date(row[0]);
          return !isNaN(matchDate.getTime()) && matchDate >= thirtyDaysAgo;
        });
        
        console.log(`[${timestamp}] Found ${recentMatches.length} recent matches (last 30 days) for player ${playerName}`);
        
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
        console.error(`[${timestamp}] Error fetching duel data for ${playerName}:`, error);
        // Don't fail the whole command if this part fails
        console.log(`[${timestamp}] Duel data fetch failed, filteredMatches will remain empty`);
      }
      
      // If no matches found in the specified period, try a longer period for additional info
      if (filteredMatches.length === 0 && playerMatches.length > 0) {
        console.log(`[${timestamp}] No matches in last ${days} days, using all available matches for additional info`);
        filteredMatches = playerMatches; // Use all matches for additional info
      }
      
      // Add a note about more detailed stats
      embed.addFields({ 
        name: 'Need more details?', 
        value: 'Use /rankings to list the top DFC Duelers!',
        inline: false 
      });

      // Create additional player info embed
      console.log(`[${timestamp}] Creating additional player info embed for ${playerName}`);
      const usingAllMatches = filteredMatches.length > 0 && filteredMatches === playerMatches;
      const titleSuffix = usingAllMatches ? ' (All-Time)' : ` (Last ${days} Days)`;
      const playerInfoEmbed = new EmbedBuilder()
        .setColor(0x9932cc)
        .setTitle(`🎯 Additional Info for ${playerName}${titleSuffix}`)
        .setFooter({ text: 'DFC Player Analysis' })
        .setTimestamp();

      // Analyze player matches for class/build and opponent data (use filtered data based on days parameter)
      const matchesToAnalyze = filteredMatches;
      console.log(`[${timestamp}] Matches to analyze: ${matchesToAnalyze ? matchesToAnalyze.length : 0}, Days: ${days}, InputDays: ${inputDays}`);
      if (matchesToAnalyze && matchesToAnalyze.length > 0) {
        console.log(`[${timestamp}] Analyzing ${matchesToAnalyze.length} matches for player insights (last ${days} days)`);
        
        // Track classes/builds played
        const classBuilds = {};
        // Track opponents and records
        const opponentRecords = {};
        
        matchesToAnalyze.forEach((match, index) => {
          const winner = match[1];
          const winnerClass = match[2] || '';
          const winnerBuild = match[3] || '';
          const loser = match[4];
          const loserClass = match[5] || '';
          const loserBuild = match[6] || '';
          
          const isWinner = winner && winner.toLowerCase() === playerName.toLowerCase();
          const playerClass = isWinner ? winnerClass : loserClass;
          const playerBuild = isWinner ? winnerBuild : loserBuild;
          const opponent = isWinner ? loser : winner;
          
          // Track class/build combinations
          if (playerClass && playerBuild) {
            const classBuildKey = `${playerClass} ${playerBuild}`.trim();
            if (!classBuilds[classBuildKey]) {
              classBuilds[classBuildKey] = { count: 0, wins: 0, losses: 0 };
            }
            classBuilds[classBuildKey].count++;
            if (isWinner) {
              classBuilds[classBuildKey].wins++;
            } else {
              classBuilds[classBuildKey].losses++;
            }
          }
          
          // Track opponent records
          if (opponent) {
            if (!opponentRecords[opponent]) {
              opponentRecords[opponent] = { wins: 0, losses: 0, total: 0 };
            }
            opponentRecords[opponent].total++;
            if (isWinner) {
              opponentRecords[opponent].wins++;
            } else {
              opponentRecords[opponent].losses++;
            }
          }
        });
        
        console.log(`[${timestamp}] Found ${Object.keys(classBuilds).length} unique class/build combinations`);
        console.log(`[${timestamp}] Found ${Object.keys(opponentRecords).length} unique opponents`);
        
        // Get top 3 most played class/builds
        const topClassBuilds = Object.entries(classBuilds)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 3);
        
        if (topClassBuilds.length > 0) {
          const classBuildText = topClassBuilds.map((entry, index) => {
            const [classBuild, stats] = entry;
            const winrate = stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(1) : '0.0';
            return `${index + 1}. **${classBuild}** - ${stats.count} games (${stats.wins}W/${stats.losses}L, ${winrate}%)`;
          }).join('\n');
          
          console.log(`[${timestamp}] Adding top class/builds field with ${topClassBuilds.length} entries`);
          playerInfoEmbed.addFields({
            name: '🎲 Most Played Classes/Builds',
            value: classBuildText,
            inline: false
          });
        }
        
        // Get most played opponents (top 5)
        const topOpponents = Object.entries(opponentRecords)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5);
        
        if (topOpponents.length > 0) {
          const opponentText = topOpponents.map((entry, index) => {
            const [opponent, record] = entry;
            const winrate = record.total > 0 ? ((record.wins / record.total) * 100).toFixed(1) : '0.0';
            return `${index + 1}. **${opponent}** - ${record.wins}W/${record.losses}L (${winrate}%)`;
          }).join('\n');
          
          console.log(`[${timestamp}] Adding top opponents field with ${topOpponents.length} entries`);
          playerInfoEmbed.addFields({
            name: '⚔️ Records vs Most Played Opponents',
            value: opponentText,
            inline: false
          });
        }
      } else {
        console.log(`[${timestamp}] No match data found for additional player analysis`);
      }
      
      // Only add the additional embed if it has fields
      const embeds = [embed];
      const hasAdditionalFields = playerInfoEmbed.data.fields && playerInfoEmbed.data.fields.length > 0;
      console.log(`[${timestamp}] Additional embed has ${playerInfoEmbed.data.fields?.length || 0} fields, will include: ${hasAdditionalFields}`);
      
      if (hasAdditionalFields) {
        embeds.push(playerInfoEmbed);
        console.log(`[${timestamp}] Added additional embed to response, total embeds: ${embeds.length}`);
      }

      // Prepare reply content with optional notification
      let replyContent = { embeds: embeds, ephemeral: true };
      
      // Add notification if no days parameter was provided
      if (inputDays === null || inputDays === undefined) {
        replyContent.content = `💡 **Tip**: You can analyze stats for a specific time period by adding a days parameter. Examples:\n` +
          `• Slash command: \`/stats player:${playerName} days:30\`\n` +
          `• Prefix command: \`!stats ${playerName} 30\``;
      }

      const totalTime = Date.now() - startTime;
      console.log(`[${timestamp}] [${commandType}] Sending response with ${embeds.length} embed(s) to ${user.tag} - Total time: ${totalTime}ms`);
      
      // Use editReply for slash commands, reply for text commands
      if (isSlashCommand) {
        await interaction.editReply(replyContent);
      } else {
        await interaction.reply(replyContent);
      }
      
      console.log(`[${timestamp}] [${commandType}] Stats command completed successfully in ${totalTime}ms for ${user.tag} (${user.id}) - found ${processedMatchTypes.size} match types, sent ${embeds.length} embed(s)`);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = `[${timestamp}] [${commandType}] Error fetching stats for player ${playerName} after ${totalTime}ms requested by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      console.error(`[${timestamp}] Error stack trace:`, error.stack);
      
      // Provide more descriptive error messages based on the error type
      let userErrorMessage = '⚠️ **Error**: There was a problem retrieving player stats.';
      
      // Common error cases
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('network')) {
        userErrorMessage += '\n\nThere seems to be a network issue. Please try again later.';
      } else if (error.message?.includes('quota')) {
        userErrorMessage += '\n\nAPI quota limit reached. Please try again later.';
      } else if (error.message?.includes('permission') || error.message?.includes('forbidden') || error.code === 403) {
        userErrorMessage += '\n\nPermission denied when accessing data. Please contact an administrator.';
      } else if (error.message?.includes('not found') || error.code === 404) {
        userErrorMessage += '\n\nThe requested data could not be found. Please check if the player exists or if there is a typo.';
      } else if (error.message?.includes('auth') || error.code === 401) {
        userErrorMessage += '\n\nAuthentication error. Please contact an administrator.';
      } else {
        // Generic fallback with unique ID for troubleshooting
        const errorId = `ERR-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        userErrorMessage += `\n\nError ID: ${errorId} - Please report this to an administrator if the issue persists.`;
      }
      
      if (isSlashCommand) {
        await interaction.editReply({ content: userErrorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: userErrorMessage, ephemeral: true });
      }
    }
  },
};