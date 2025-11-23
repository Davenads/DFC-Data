const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const rankingsCache = require('../utils/rankingsCache');
const { getMatchTypeEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
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

    console.log(`[${timestamp}] Executing rankings command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Division: ${selectedDivision}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      console.log(`[${timestamp}] [rankings] Fetching rankings for division: ${selectedDivision}`);

      // Fetch rankings from cache (falls back to computation if cache miss)
      const fetchStart = Date.now();
      const rankingsData = await rankingsCache.getRankings(selectedDivision);
      console.log(`[${timestamp}] [rankings] Retrieved rankings in ${Date.now() - fetchStart}ms`);

      const sortedPlayers = rankingsData.players;
      const champion = rankingsData.champion;
      const DAYS = rankingsData.daysWindow;

      if (!sortedPlayers || sortedPlayers.length === 0) {
        console.log(`[${timestamp}] [rankings] No player data for ${selectedDivision}`);
        await interaction.editReply({
          content: `⚠️ No ranking data available for ${selectedDivision} in the last ${DAYS} days.`,
          ephemeral: true
        });
        return;
      }

      console.log(`[${timestamp}] [rankings] Found ${sortedPlayers.length} players in ${selectedDivision}`);

      // Log top 3 for debugging
      if (sortedPlayers.length >= 3) {
        console.log(`[${timestamp}] [rankings] Top 3 in ${selectedDivision}:`,
          sortedPlayers.slice(0, 3).map((p, i) =>
            `${i + 1}. ${p.name} (${p.wins}W/${p.losses}L - ${p.winRate.toFixed(1)}% - ARL:${p.arl.toFixed(2)})`
          ).join(', ')
        );
      }

      const PLAYERS_PER_PAGE = 15;
      const top30 = sortedPlayers.slice(0, 30);
      const totalPages = Math.ceil(top30.length / PLAYERS_PER_PAGE);

      const championName = champion ? champion.arenaName.toLowerCase() : null;

      if (champion) {
        console.log(`[${timestamp}] [rankings] ${selectedDivision} champion: ${champion.dataName || champion.arenaName}`);
      }

      // Helper function to build embed for a specific page
      const buildEmbed = (page) => {
        const start = (page - 1) * PLAYERS_PER_PAGE;
        const end = start + PLAYERS_PER_PAGE;
        const pagePlayers = top30.slice(start, end);

        console.log(`[${timestamp}] [rankings] Building embed for page ${page}/${totalPages}...`);
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
            console.log(`[${timestamp}] [rankings] Champion ${player.name} at rank ${rank} with ARL: ${player.arl.toFixed(2)}`);
          }

          description += `${line}\n`;
        });

        // Check embed character limits (Discord limit: 4096 for description)
        const EMBED_DESC_LIMIT = 4096;
        if (description.length > EMBED_DESC_LIMIT) {
          console.warn(`[${timestamp}] [rankings] ⚠️ Description exceeds limit! Length: ${description.length}/${EMBED_DESC_LIMIT}`);
          description = description.substring(0, EMBED_DESC_LIMIT - 50) + '\n\n*[Truncated due to length]*';
        }

        console.log(`[${timestamp}] [rankings] Page ${page} description length: ${description.length}/${EMBED_DESC_LIMIT}`);

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
          .setCustomId(`rankings_prev_${selectedDivision}_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rankings_next_${selectedDivision}_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages);

        const pageInfo = new ButtonBuilder()
          .setCustomId(`rankings_pageinfo_${page}`)
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

      console.log(`[${timestamp}] [rankings] Sending embed to user (Page 1/${totalPages})...`);
      await interaction.editReply({
        embeds: [embed],
        components: buttons ? [buttons] : [],
        ephemeral: true
      });

      console.log(`[${timestamp}] [rankings] ✅ Command completed successfully for ${user.tag} (${user.id}) - Division: ${selectedDivision}, Total players: ${top30.length}, Pages: ${totalPages}`);

    } catch (error) {
      console.error(`[${timestamp}] [rankings] ❌ Error executing rankings command:`, error);
      console.error(`[${timestamp}] [rankings] Error name: ${error.name}`);
      console.error(`[${timestamp}] [rankings] Error message: ${error.message}`);
      console.error(`[${timestamp}] [rankings] Stack trace:`, error.stack);

      const errorMessage = '⚠️ **Error**: Failed to fetch rankings data. Please try again later.';

      try {
        await interaction.editReply({
          content: errorMessage,
          ephemeral: true
        });
        console.log(`[${timestamp}] [rankings] Error message sent to user`);
      } catch (followUpError) {
        console.error(`[${timestamp}] [rankings] Failed to send error message:`, followUpError);
        console.error(`[${timestamp}] [rankings] Follow-up error stack:`, followUpError.stack);
      }
    }
  },

  async handleButton(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;

    // Parse customId: rankings_[action]_[division]_[currentPage]
    const parts = interaction.customId.split('_');
    const action = parts[1]; // 'prev', 'next', or 'pageinfo'
    const selectedDivision = parts[2]; // 'HLD', 'LLD', or 'MELEE'
    const currentPage = parseInt(parts[3]);

    console.log(`[${timestamp}] [rankings] Button clicked:`, {
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
      const PLAYERS_PER_PAGE = 15;

      // Fetch rankings from cache (much faster than recomputing)
      const rankingsData = await rankingsCache.getRankings(selectedDivision);
      const sortedPlayers = rankingsData.players;
      const champion = rankingsData.champion;
      const DAYS = rankingsData.daysWindow;

      if (!sortedPlayers || sortedPlayers.length === 0) {
        await interaction.editReply({
          content: `⚠️ No ranking data available for ${selectedDivision} in the last ${DAYS} days.`,
          components: []
        });
        return;
      }

      const top30 = sortedPlayers.slice(0, 30);
      const totalPages = Math.ceil(top30.length / PLAYERS_PER_PAGE);

      // Calculate new page based on action
      let newPage = currentPage;
      if (action === 'prev') {
        newPage = Math.max(1, currentPage - 1);
      } else if (action === 'next') {
        newPage = Math.min(totalPages, currentPage + 1);
      }

      console.log(`[${timestamp}] [rankings] Navigating from page ${currentPage} to ${newPage}`);

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
          console.warn(`[${timestamp}] [rankings] ⚠️ Page ${page} description exceeds limit! Length: ${description.length}/${EMBED_DESC_LIMIT}`);
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
          .setCustomId(`rankings_prev_${selectedDivision}_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1);

        const nextButton = new ButtonBuilder()
          .setCustomId(`rankings_next_${selectedDivision}_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages);

        const pageInfo = new ButtonBuilder()
          .setCustomId(`rankings_pageinfo_${page}`)
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

      console.log(`[${timestamp}] [rankings] ✅ Page navigation successful - User: ${user.tag}, Division: ${selectedDivision}, Page: ${newPage}/${totalPages}`);

    } catch (error) {
      console.error(`[${timestamp}] [rankings] ❌ Error in button handler:`, error);

      try {
        await interaction.editReply({
          content: '⚠️ **Error**: Failed to navigate pages. Please try the command again.',
          components: []
        });
      } catch (followUpError) {
        console.error(`[${timestamp}] [rankings] Failed to send error message:`, followUpError);
      }
    }
  },
};
