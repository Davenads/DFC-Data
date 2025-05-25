const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dueltrends')
    .setDescription('Analyze duel trends and statistics over the last X days')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to analyze (defaults to 30, use large number for all-time)')
        .setRequired(false)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('matchtype')
        .setDescription('Filter by match type (defaults to all combined)')
        .setRequired(false)
        .addChoices(
          { name: 'HLD - High Level Duel', value: 'HLD' },
          { name: 'LLD - Low Level Duel', value: 'LLD' },
          { name: 'Melee', value: 'Melee' }
        )),

  async execute(interaction, sheets, auth, prefixArgs = []) {
    // Handle both slash commands and prefix commands
    let inputDays, matchType;
    
    if (interaction.options && typeof interaction.options.getInteger === 'function') {
      // Slash command
      inputDays = interaction.options.getInteger('days');
      matchType = interaction.options.getString('matchtype');
    } else {
      // Prefix command (!dueltrends)
      // Get args from the createMessageAdapter function call
      const args = prefixArgs.length > 0 ? prefixArgs : 
        (interaction.args || []);
      
      console.log(`[DEBUG] Prefix args received:`, args, `prefixArgs:`, prefixArgs);
      
      // Parse arguments: !dueltrends [days] [matchtype] or !dueltrends [matchtype]
      if (args.length > 0) {
        const firstArg = args[0];
        const secondArg = args[1];
        
        console.log(`[DEBUG] First arg: "${firstArg}", Second arg: "${secondArg}"`);
        
        // If first argument is a number, treat it as days
        if (!isNaN(parseInt(firstArg))) {
          inputDays = parseInt(firstArg);
          console.log(`[DEBUG] Parsed days: ${inputDays}`);
          
          // Second argument would be match type
          if (secondArg) {
            const lowerArg = secondArg.toLowerCase();
            console.log(`[DEBUG] Second arg lowercase: "${lowerArg}"`);
            if (lowerArg === 'hld') matchType = 'HLD';
            else if (lowerArg === 'lld') matchType = 'LLD';
            else if (lowerArg === 'melee') matchType = 'Melee';
            console.log(`[DEBUG] Parsed match type: ${matchType}`);
          }
        } else {
          // First argument is not a number, treat it as match type
          const lowerArg = firstArg.toLowerCase();
          console.log(`[DEBUG] First arg as match type: "${lowerArg}"`);
          if (lowerArg === 'hld') matchType = 'HLD';
          else if (lowerArg === 'lld') matchType = 'LLD';
          else if (lowerArg === 'melee') matchType = 'Melee';
          console.log(`[DEBUG] Parsed match type: ${matchType}`);
        }
      }
    }
    
    const days = inputDays || 30; // Default to 30 days if no input provided
    const usedDefault = inputDays === null;
    
    console.log(`[DEBUG] Final parsed values - inputDays: ${inputDays}, days: ${days}, matchType: ${matchType}`);
    
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing dueltrends command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Days: ${days} ${usedDefault ? '(default)' : '(specified)'}
    Match Type: ${matchType || 'All Types (combined)'}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get duel data from cache first to determine available date range
      const duelRows = await duelDataCache.getCachedData();

      if (duelRows.length === 0) {
        return interaction.editReply({
          content: 'No duel data available in cache. Please try refreshing the cache.',
          ephemeral: true
        });
      }

      // Find the oldest duel date in the dataset
      const validDuelDates = duelRows
        .map(row => new Date(row[0]))
        .filter(date => !isNaN(date.getTime()));
      
      if (validDuelDates.length === 0) {
        return interaction.editReply({
          content: 'No valid duel dates found in the dataset.',
          ephemeral: true
        });
      }

      const oldestDuelDate = new Date(Math.min(...validDuelDates));
      const currentDate = new Date();
      const maxAvailableDays = Math.ceil((currentDate - oldestDuelDate) / (1000 * 60 * 60 * 24));
      
      // Use the smaller of requested days or available days
      const actualDays = Math.min(days, maxAvailableDays);
      const isLimitedByData = days > maxAvailableDays;

      // Calculate the cutoff date based on actual days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - actualDays);

      // Filter matches within the specified time period and by match type
      const recentMatches = duelRows.filter(row => {
        if (row.length < 9) return false; // Need at least 9 columns to include match type
        
        const matchDate = new Date(row[0]); // Event Date column
        if (isNaN(matchDate.getTime())) return false;
        
        const isWithinTimeRange = matchDate >= cutoffDate;
        
        // Apply match type filter if specified
        if (matchType) {
          const rowMatchType = row[8] || ''; // Match Type column (index 8)
          return isWithinTimeRange && rowMatchType === matchType;
        }
        
        return isWithinTimeRange;
      });

      if (recentMatches.length === 0) {
        const matchTypeText = matchType ? ` for ${matchType}` : '';
        return interaction.editReply({
          content: `No duels found in the last ${actualDays} day${actualDays === 1 ? '' : 's'}${matchTypeText}.`,
          ephemeral: true
        });
      }

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

      // Data analysis
      const buildCounts = {};
      const classCounts = {};
      const matchupCounts = {};
      const matchupWins = {};
      const playerDuels = {};

      // Process each match
      for (const match of recentMatches) {
        const winner = match[1] || 'Unknown';
        const winnerClass = (match[2] || '').toLowerCase();
        const winnerBuild = match[3] || '';
        const loser = match[4] || 'Unknown';
        const loserClass = (match[5] || '').toLowerCase();
        const loserBuild = match[6] || '';

        // Count builds (winner and loser)
        if (winnerClass && winnerBuild) {
          const winnerClassBuild = `${winnerClass} (${winnerBuild})`;
          buildCounts[winnerClassBuild] = (buildCounts[winnerClassBuild] || 0) + 1;
        }
        if (loserClass && loserBuild) {
          const loserClassBuild = `${loserClass} (${loserBuild})`;
          buildCounts[loserClassBuild] = (buildCounts[loserClassBuild] || 0) + 1;
        }

        // Count classes
        if (winnerClass) classCounts[winnerClass] = (classCounts[winnerClass] || 0) + 1;
        if (loserClass) classCounts[loserClass] = (classCounts[loserClass] || 0) + 1;

        // Count matchups and wins
        if (winnerClass && loserClass) {
          const matchup = [winnerClass, loserClass].sort().join(' vs ');
          matchupCounts[matchup] = (matchupCounts[matchup] || 0) + 1;
          
          // Track wins for each side of the matchup
          if (!matchupWins[matchup]) {
            matchupWins[matchup] = {};
          }
          matchupWins[matchup][winnerClass] = (matchupWins[matchup][winnerClass] || 0) + 1;
        }

        // Count player activity
        if (winner !== 'Unknown') playerDuels[winner] = (playerDuels[winner] || 0) + 1;
        if (loser !== 'Unknown') playerDuels[loser] = (playerDuels[loser] || 0) + 1;
      }

      // Sort data for top lists
      const topBuilds = Object.entries(buildCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      const topClasses = Object.entries(classCounts)
        .sort(([,a], [,b]) => b - a);

      const topMatchups = Object.entries(matchupCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6);

      const topPlayers = Object.entries(playerDuels)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      // Create embeds
      const embeds = [];

      // Create title with actual vs requested range info and match type
      const rangeText = isLimitedByData 
        ? `Last ${actualDays} Days (All Available Data)`
        : `Last ${actualDays} Day${actualDays === 1 ? '' : 's'}`;
      
      const matchTypeText = matchType ? ` • ${matchType}` : ' • All Types';
      
      // Embed 1: Build and Class Trends
      const buildsEmbed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(`📊 Build & Class Trends - ${rangeText}${matchTypeText}`)
        .setDescription(`Analysis of ${recentMatches.length} duel${recentMatches.length === 1 ? '' : 's'}${isLimitedByData ? ` • Dataset spans ${maxAvailableDays} days total` : ''}`)
        .setTimestamp()
        .setFooter({ text: 'DFC Duel Trends' });

      // Top builds
      if (topBuilds.length > 0) {
        const buildsList = topBuilds.map(([build, count], index) => {
          const percentage = ((count / (recentMatches.length * 2)) * 100).toFixed(1);
          return `${index + 1}. **${build}** - ${count} uses (${percentage}%)`;
        }).join('\n');
        
        buildsEmbed.addFields({
          name: '🔧 Most Popular Builds',
          value: buildsList,
          inline: false
        });
      }

      // Class distribution
      if (topClasses.length > 0) {
        const classDistribution = topClasses.map(([className, count]) => {
          const emoji = classEmojis[className] || '👤';
          const percentage = ((count / (recentMatches.length * 2)) * 100).toFixed(1);
          const capitalizedClass = className.charAt(0).toUpperCase() + className.slice(1);
          return `${emoji} **${capitalizedClass}**: ${count} (${percentage}%)`;
        }).join('\n');
        
        buildsEmbed.addFields({
          name: '⚡ Class Distribution',
          value: classDistribution,
          inline: false
        });
      }

      embeds.push(buildsEmbed);

      // Embed 2: Matchup Analysis
      const matchupsEmbed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle(`⚔️ Matchup Analysis - ${rangeText}${matchTypeText}`)
        .setTimestamp();

      if (topMatchups.length > 0) {
        const matchupsList = topMatchups.map(([matchup, count], index) => {
          const [class1, class2] = matchup.split(' vs ');
          const class1Emoji = classEmojis[class1] || '👤';
          const class2Emoji = classEmojis[class2] || '👤';
          
          // Calculate win rates
          const wins = matchupWins[matchup] || {};
          const class1Wins = wins[class1] || 0;
          const class2Wins = wins[class2] || 0;
          const class1WinRate = count > 0 ? ((class1Wins / count) * 100).toFixed(1) : '0.0';
          const class2WinRate = count > 0 ? ((class2Wins / count) * 100).toFixed(1) : '0.0';
          
          const capitalizedClass1 = class1.charAt(0).toUpperCase() + class1.slice(1);
          const capitalizedClass2 = class2.charAt(0).toUpperCase() + class2.slice(1);
          
          return `${index + 1}. ${class1Emoji} **${capitalizedClass1}** vs ${class2Emoji} **${capitalizedClass2}**\n` +
                 `   ${count} duel${count === 1 ? '' : 's'} • Win rates: ${class1WinRate}% / ${class2WinRate}%`;
        }).join('\n\n');
        
        matchupsEmbed.addFields({
          name: '🥊 Most Common Matchups',
          value: matchupsList,
          inline: false
        });
      }

      embeds.push(matchupsEmbed);

      // Embed 3: General Statistics (if there's enough data)
      if (topPlayers.length > 0 || recentMatches.length >= 10) {
        const statsEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`📈 General Statistics - ${rangeText}${matchTypeText}`)
          .setTimestamp();

        // Basic stats
        const uniquePlayers = Object.keys(playerDuels).length;
        const avgDuelsPerDay = (recentMatches.length / actualDays).toFixed(1);
        
        statsEmbed.addFields({
          name: '📊 Overview',
          value: `**Total Duels:** ${recentMatches.length}\n` +
                 `**Active Players:** ${uniquePlayers}\n` +
                 `**Average per Day:** ${avgDuelsPerDay} duels`,
          inline: true
        });

        // Most active players
        if (topPlayers.length > 0) {
          const playersList = topPlayers.map(([player, duels], index) => 
            `${index + 1}. **${player}** - ${duels} duel${duels === 1 ? '' : 's'}`
          ).join('\n');
          
          statsEmbed.addFields({
            name: '🏆 Most Active Players',
            value: playersList,
            inline: true
          });
        }

        embeds.push(statsEmbed);
      }

      // Send embeds
      let replyContent = {};
      
      if (usedDefault) {
        replyContent.content = `💡 **Tip**: You can specify a custom time period with \`/dueltrends days:[number]\` (use large numbers for all-time analysis)`;
      } else if (isLimitedByData) {
        replyContent.content = `ℹ️ **Note**: Requested ${days} days, but showing all available data (${actualDays} days since ${oldestDuelDate.toLocaleDateString()})`;
      }
      
      replyContent.embeds = [embeds[0]];
      await interaction.editReply({ ...replyContent, ephemeral: true });
      
      // Send additional embeds as follow-up messages
      if (embeds.length > 1) {
        for (let i = 1; i < embeds.length; i++) {
          await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
        }
      }

      console.log(`[${timestamp}] Dueltrends command completed successfully for ${user.tag} (${user.id}) - analyzed ${recentMatches.length} matches over ${actualDays} days${isLimitedByData ? ` (requested ${days})` : ''}${matchType ? ` for ${matchType}` : ' (all types)'}`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error analyzing duel trends for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ 
        content: 'There was an error while analyzing duel trends. Please try again later.', 
        ephemeral: true 
      });
    }
  },
};