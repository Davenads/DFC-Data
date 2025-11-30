const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');
const { getClassEmoji, deckardCainEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classrankings')
    .setDescription('Show class performance statistics and matchup win percentages for a division')
    .addStringOption(option =>
      option.setName('division')
        .setDescription('The division to analyze')
        .setRequired(true)
        .addChoices(
          { name: 'HLD - High Level Duel', value: 'HLD' },
          { name: 'LLD - Low Level Duel', value: 'LLD' },
          { name: 'Melee', value: 'Melee' }
        ))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to analyze (defaults to 30)')
        .setRequired(false)
        .setMinValue(1)),

  async execute(interaction, sheets, auth, prefixArgs = []) {
    // Handle both slash commands and prefix commands
    let division, inputDays;

    const isSlashCommand = prefixArgs.length === 0 &&
      interaction.isCommand && typeof interaction.isCommand === 'function';

    if (isSlashCommand) {
      // Real slash command
      division = interaction.options.getString('division');
      inputDays = interaction.options.getInteger('days');
    } else {
      // Prefix command (!classrankings hld 30)
      const args = prefixArgs;

      if (args.length === 0) {
        return interaction.reply({
          content: 'Please specify a division: `!classrankings <hld|lld|melee> [days]`',
          ephemeral: true
        });
      }

      // First argument is division
      const divisionArg = args[0].toLowerCase();
      if (divisionArg === 'hld') division = 'HLD';
      else if (divisionArg === 'lld') division = 'LLD';
      else if (divisionArg === 'melee') division = 'Melee';
      else {
        return interaction.reply({
          content: 'Invalid division. Use: hld, lld, or melee',
          ephemeral: true
        });
      }

      // Second argument is days (optional)
      if (args.length > 1) {
        inputDays = parseInt(args[1]);
        if (isNaN(inputDays) || inputDays < 1) {
          return interaction.reply({
            content: 'Invalid number of days. Please provide a positive integer.',
            ephemeral: true
          });
        }
      }
    }

    const days = inputDays || 30; // Default to 30 days
    const usedDefault = inputDays === null || inputDays === undefined;

    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

    console.log(`[${timestamp}] Executing classrankings command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Division: ${division}
    Days: ${days} ${usedDefault ? '(default)' : '(specified)'}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get duel data from cache
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

      // Filter matches within the specified time period and by division
      const filteredMatches = duelRows.filter(row => {
        if (row.length < 9) return false; // Need at least 9 columns

        const matchDate = new Date(row[0]); // Event Date column
        if (isNaN(matchDate.getTime())) return false;

        const rowMatchType = row[8] || ''; // Match Type column (index 8)
        return matchDate >= cutoffDate && rowMatchType === division;
      });

      if (filteredMatches.length === 0) {
        return interaction.editReply({
          content: `No duels found for ${division} in the last ${actualDays} day${actualDays === 1 ? '' : 's'}.`,
          ephemeral: true
        });
      }

      // Initialize class statistics
      const allClasses = ['amazon', 'assassin', 'barbarian', 'druid', 'necromancer', 'paladin', 'sorceress'];
      const classStats = {};
      const matchupStats = {};

      // Initialize all classes with zero stats
      allClasses.forEach(className => {
        classStats[className] = { wins: 0, losses: 0 };
        matchupStats[className] = {};

        // Initialize matchup records for each opponent (excluding self)
        allClasses.forEach(opponentClass => {
          if (className !== opponentClass) {
            matchupStats[className][opponentClass] = { wins: 0, losses: 0 };
          }
        });
      });

      // Process each match
      for (const match of filteredMatches) {
        const winnerClass = (match[2] || '').toLowerCase().trim();
        const loserClass = (match[5] || '').toLowerCase().trim();

        // Skip if either class is missing or not in our class list
        if (!winnerClass || !loserClass ||
            !allClasses.includes(winnerClass) ||
            !allClasses.includes(loserClass)) {
          continue;
        }

        // Update overall stats
        classStats[winnerClass].wins += 1;
        classStats[loserClass].losses += 1;

        // Update head-to-head stats (excluding mirror matches)
        if (winnerClass !== loserClass) {
          matchupStats[winnerClass][loserClass].wins += 1;
          matchupStats[loserClass][winnerClass].losses += 1;
        }
      }

      // Calculate win percentages and create rankings
      const classRankings = allClasses.map(className => {
        const stats = classStats[className];
        const totalGames = stats.wins + stats.losses;
        const winRate = totalGames > 0 ? (stats.wins / totalGames * 100) : 0;

        return {
          className,
          wins: stats.wins,
          losses: stats.losses,
          totalGames,
          winRate
        };
      }).sort((a, b) => b.winRate - a.winRate); // Sort by win rate descending

      // Build Embed 1: Class Rankings by Win %
      const dateRangeStart = new Date(cutoffDate);
      const dateRangeEnd = new Date();
      const dateRangeText = `${dateRangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${dateRangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      const embed1 = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`${deckardCainEmoji} Class Rankings by Win % - ${division} - Last ${actualDays} Days`)
        .setFooter({ text: `📊 ${filteredMatches.length} total duels analyzed • ${dateRangeText}` })
        .setTimestamp();

      let rankingsText = '';
      classRankings.forEach((classData, index) => {
        const rank = index + 1;
        const emoji = getClassEmoji(classData.className);
        const className = classData.className.charAt(0).toUpperCase() + classData.className.slice(1);
        const record = `${classData.wins}-${classData.losses}`;
        const winRateText = classData.totalGames > 0 ? `${classData.winRate.toFixed(1)}%` : 'N/A';

        rankingsText += `${rank}. ${emoji} **${className}**: ${record} (${winRateText})\n`;
      });

      embed1.setDescription(rankingsText || 'No data available');

      // Build Embed 2: Head-to-Head Matchup Win Rates
      const embed2 = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle(`${deckardCainEmoji} Head-to-Head Matchup Win Rates - ${division}`)
        .setFooter({ text: `Last ${actualDays} days • Mirror matches excluded` })
        .setTimestamp();

      // Class name abbreviations
      const classAbbreviations = {
        'amazon': 'Amz',
        'assassin': 'Asn',
        'barbarian': 'Barb',
        'druid': 'Dru',
        'necromancer': 'Nec',
        'paladin': 'Pal',
        'sorceress': 'Sor'
      };

      let matchupText = '';

      // Sort by overall win rate for display order
      classRankings.forEach(classData => {
        const className = classData.className;
        const emoji = getClassEmoji(className);
        const classNameDisplay = className.charAt(0).toUpperCase() + className.slice(1);

        // Build matchup string for this class
        const opponents = matchupStats[className];
        const matchupParts = [];

        // Calculate win rates for all matchups
        const matchupWinRates = [];
        for (const [opponentClass, record] of Object.entries(opponents)) {
          const totalGames = record.wins + record.losses;
          if (totalGames > 0) {
            const winRate = (record.wins / totalGames) * 100;
            matchupWinRates.push({
              opponent: opponentClass,
              winRate: winRate,
              wins: record.wins,
              losses: record.losses
            });
          }
        }

        // Sort by win rate descending
        matchupWinRates.sort((a, b) => b.winRate - a.winRate);

        // Build display string
        matchupWinRates.forEach(matchupData => {
          const oppAbbrev = classAbbreviations[matchupData.opponent];
          const winRateDisplay = Math.round(matchupData.winRate);
          matchupParts.push(`vs ${oppAbbrev} ${winRateDisplay}%`);
        });

        if (matchupParts.length > 0) {
          matchupText += `${emoji} **${classNameDisplay}**: ${matchupParts.join(' | ')}\n`;
        } else {
          matchupText += `${emoji} **${classNameDisplay}**: No matchup data\n`;
        }
      });

      embed2.setDescription(matchupText || 'No matchup data available');

      // Send initial reply with first embed
      await interaction.editReply({ embeds: [embed1], ephemeral: true });

      // Send second embed as follow-up
      await interaction.followUp({ embeds: [embed2], ephemeral: true });

      console.log(`[${timestamp}] Classrankings command completed successfully for ${user.tag} (${user.id}) - analyzed ${filteredMatches.length} matches over ${actualDays} days for ${division}${isLimitedByData ? ` (requested ${days})` : ''}`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error analyzing class rankings for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({
        content: 'There was an error analyzing class rankings. Please try again later.',
        ephemeral: true
      });
    }
  }
};
