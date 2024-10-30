const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('Get the player rankings based on ELO or Efficiency Index')
    .addStringOption(option =>
      option.setName('rank_type')
        .setDescription('Choose ranking type: Efficiency Index or ELO')
        .setRequired(true)
        .addChoices(
          { name: 'ELO', value: 'elo' },
          { name: 'Efficiency Index', value: 'efficiency' },
        ))
    .addStringOption(option =>
      option.setName('match_type')
        .setDescription('Choose match type: HLD, LLD, or Melee')
        .setRequired(true)
        .addChoices(
          { name: 'HLD', value: 'HLD' },
          { name: 'LLD', value: 'LLD' },
          { name: 'Melee', value: 'Melee' },
        ))
    .addStringOption(option =>
      option.setName('time_frame')
        .setDescription('Choose timeframe: Career or Seasonal')
        .setRequired(true)
        .addChoices(
          { name: 'Career', value: 'career' },
          { name: 'Seasonal', value: 'seasonal' },
        ))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of players to display (max 50)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(50)),

  async execute(interaction) {
    const rankType = interaction.options.getString('rank_type');
    const matchType = interaction.options.getString('match_type');
    const timeFrame = interaction.options.getString('time_frame');
    const limit = interaction.options.getInteger('limit');

    const sheets = google.sheets('v4');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    await interaction.deferReply(); // Defer the reply to avoid timeouts

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:M',
      });

      const rows = response.data.values || [];

      // Filter rows based on match type, remove duplicate entries, and parse ELO properly
      const uniquePlayers = new Map();
      rows.filter(row => row[2] === matchType) // Match type (Column C)
        .forEach(row => {
          const player = row[0];
          if (!uniquePlayers.has(player)) {
            uniquePlayers.set(player, row);
          }
        });

      const filteredRows = Array.from(uniquePlayers.values())
        .map(row => {
          const eloValue = row[timeFrame === 'career' ? 4 : 3].replace(/,/g, '');
          console.log(`Parsing ELO for player ${row[0]}: ${eloValue}`);
          return {
            player: row[0],
            timestamp: row[1],
            matchType: row[2],
            elo: parseFloat(eloValue), // Remove commas and parse ELO (Columns E or D)
            eIndex: parseFloat(row[timeFrame === 'career' ? 6 : 5]), // Career or Seasonal Efficiency Index (Columns G or F)
            sWins: parseInt(row[7]) || 0,
            sLoss: parseInt(row[8]) || 0,
            sWinRate: row[9] || '0%',
            wins: parseInt(row[10]) || 0,
            loss: parseInt(row[11]) || 0,
            winRate: row[12] || '0%',
          };
        })
        .filter(player => timeFrame === 'career' || player.sWins > 0 || player.sLoss > 0) // Exclude players with no seasonal data
        .sort((a, b) => rankType === 'elo' ? b.elo - a.elo : b.eIndex - a.eIndex) // Sort by ELO or Efficiency Index descending
        .slice(0, limit); // Get top players up to the limit specified

      // Emojis for the top 10 ranks
      const rankEmojis = [
        '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'
      ];

      // Paginate the rankings, 5 per page
      let currentPage = 0;
      const totalPages = Math.ceil(filteredRows.length / 5);

      const generateEmbed = (page) => {
        const embed = {
          color: 0x0099ff,
          title: `🏆 ${timeFrame === 'career' ? 'Career' : 'Seasonal'} Rankings - ${rankType === 'elo' ? 'ELO' : 'Efficiency Index'} (${matchType}) - Page ${page + 1}/${totalPages}`,
          fields: [],
          footer: { text: 'DFC Rankings' },
        };

        filteredRows.slice(page * 5, (page + 1) * 5).forEach((player, index) => {
          const rank = page * 5 + index + 1;
          const rankEmoji = rank <= 10 ? rankEmojis[rank - 1] : `#${rank}`;
          console.log(`Player ${player.player} - ELO: ${player.elo}`);
          embed.fields.push({
            name: `${rankEmoji} - ${player.player}`,
            value: `ELO: ${player.elo}
            Efficiency Index: ${player.eIndex}
            Wins/Losses: ${timeFrame === 'career' ? player.wins : player.sWins}/${timeFrame === 'career' ? player.loss : player.sLoss}
            Win Rate: ${timeFrame === 'career' ? player.winRate : player.sWinRate}`,
            inline: false,
          });
        });
        return embed;
      };

      const updateReply = async () => {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1),
        );

        await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: [row] });
      };

      await updateReply();

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on('collect', async i => {
        if (i.customId === 'prev_page' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next_page' && currentPage < totalPages - 1) {
          currentPage++;
        }
        await i.deferUpdate();
        await updateReply();
      });

      collector.on('end', async () => {
        await interaction.editReply({ components: [] });
      });
    } catch (error) {
      console.error('Error fetching rankings:', error);
      await interaction.editReply({ content: 'There was an error while retrieving the rankings.', ephemeral: true });
    }
  },
};
