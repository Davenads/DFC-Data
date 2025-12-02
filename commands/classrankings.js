const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');
const { getClassEmoji, deckardCainEmoji, getMatchTypeEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classrankings')
    .setDescription('Show class performance statistics and matchup win percentages')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to analyze (defaults to 30)')
        .setRequired(false)
        .setMinValue(1)),

  async execute(interaction, sheets, auth, prefixArgs = []) {
    // Handle both slash commands and prefix commands
    let inputDays;

    const isSlashCommand = prefixArgs.length === 0 &&
      interaction.isCommand && typeof interaction.isCommand === 'function';

    if (isSlashCommand) {
      // Real slash command
      inputDays = interaction.options.getInteger('days');
    } else {
      // Prefix command (!classrankings 30)
      const args = prefixArgs;

      // Only parse days argument now
      if (args.length > 0) {
        inputDays = parseInt(args[0]);
        if (isNaN(inputDays) || inputDays < 1) {
          return interaction.reply({
            content: 'Invalid number of days. Usage: `!classrankings [days]`',
            flags: MessageFlags.Ephemeral
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
    Days: ${days} ${usedDefault ? '(default)' : '(specified)'}`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Create initial embed with division selection
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${deckardCainEmoji} Class Rankings & Win Rate Analysis`)
        .setDescription(
          'Select a division to view class performance statistics and head-to-head matchup win rates.\n\n' +
          '📈 **View Full Dashboard:**\n' +
          '[Looker Studio Dashboard](https://lookerstudio.google.com/reporting/f0aef56a-571d-4216-9b70-ea44614f10eb/page/p_omb02u6xvd)\n\n' +
          `📅 **Analysis Period:** Last ${days} days`
        )
        .setFooter({ text: 'Click a division button below to view rankings' })
        .setTimestamp();

      // Create action row with division buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`classrankings_select_HLD_${days}`)
            .setLabel('HLD')
            .setEmoji(getMatchTypeEmoji('HLD'))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`classrankings_select_LLD_${days}`)
            .setLabel('LLD')
            .setEmoji(getMatchTypeEmoji('LLD'))
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`classrankings_select_Melee_${days}`)
            .setLabel('Melee')
            .setEmoji(getMatchTypeEmoji('MELEE'))
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

      console.log(`[${timestamp}] Classrankings command displayed division selection for ${user.tag} (${user.id}) - ${days} days`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error in classrankings command for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({
        content: 'There was an error displaying class rankings. Please try again later.'
      });
    }
  },

  async handleButton(interaction, sheets, auth) {
    const customId = interaction.customId;

    // Only handle classrankings button interactions
    if (!customId.startsWith('classrankings_select_')) return;

    // Parse customId: "classrankings_select_HLD_30"
    const parts = customId.split('_');
    const division = parts[2]; // HLD, LLD, or Melee
    const days = parseInt(parts[3]) || 30;

    const timestamp = new Date().toISOString();
    const user = interaction.user;

    console.log(`[${timestamp}] User ${user.tag} (${user.id}) selected division: ${division} (${days} days)`);

    await interaction.deferUpdate();

    try {
      // Get duel data from cache
      const duelRows = await duelDataCache.getCachedData();

      if (duelRows.length === 0) {
        return interaction.followUp({
          content: 'No duel data available in cache. Please try refreshing the cache.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Find the oldest duel date in the dataset
      const validDuelDates = duelRows
        .map(row => new Date(row[0]))
        .filter(date => !isNaN(date.getTime()));

      if (validDuelDates.length === 0) {
        return interaction.followUp({
          content: 'No valid duel dates found in the dataset.',
          flags: MessageFlags.Ephemeral
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
        return interaction.followUp({
          content: `No duels found for ${division} in the last ${actualDays} day${actualDays === 1 ? '' : 's'}.`,
          flags: MessageFlags.Ephemeral
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

      // Send embeds as follow-ups
      await interaction.followUp({ embeds: [embed1], flags: MessageFlags.Ephemeral });
      await interaction.followUp({ embeds: [embed2], flags: MessageFlags.Ephemeral });

      console.log(`[${timestamp}] Successfully sent class rankings for ${division} to ${user.tag} (${user.id}) - analyzed ${filteredMatches.length} matches over ${actualDays} days${isLimitedByData ? ` (requested ${days})` : ''}`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error in classrankings button handler for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.followUp({
        content: 'There was an error analyzing class rankings. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
