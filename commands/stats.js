const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Get the current ELO stats for a player')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('The player to get stats for')
        .setAutocomplete(true)
        .setRequired(true)),

  async autocomplete(interaction) {
    const sheets = google.sheets('v4');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:A',
      });

      const players = response.data.values ? response.data.values.flat() : [];
      const uniquePlayers = [...new Set(players)]; // Remove duplicate names
      const focusedValue = interaction.options.getFocused().toLowerCase();

      const filteredPlayers = uniquePlayers.filter(player =>
        player.toLowerCase().includes(focusedValue)
      ).slice(0, 25); // Limit to 25 players to meet Discord's requirements

      await interaction.respond(
        filteredPlayers.map(player => ({ name: player, value: player }))
      );
    } catch (error) {
      console.error('Error fetching player names:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const playerName = interaction.options.getString('player');
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
      const playerRows = rows.filter(row => row[0].toLowerCase() === playerName.toLowerCase());

      if (playerRows.length === 0) {
        return interaction.editReply({ content: `Player **${playerName}** not found.`, ephemeral: true });
      }

      // Sort player rows by timestamp in descending order to get the most recent data first
      playerRows.sort((a, b) => new Date(b[1]) - new Date(a[1]));

      const embed = {
        color: 0x0099ff,
        title: `📊 Stats for ${playerName}`,
        fields: [],
        footer: { text: 'DFC Stats' },
      };

      // Use only the most recent row for each match type
      const processedMatchTypes = new Set();
      playerRows.forEach(playerData => {
        const [player, timestamp, matchType, sElo, elo, sEIndex, eIndex, sWins, sLoss, sWinRate, cWins, cLoss, cWinRate] = playerData;

        if (!processedMatchTypes.has(matchType)) {
          processedMatchTypes.add(matchType);

          const matchTypeFields = [];
          if (sElo) matchTypeFields.push({ name: 'Seasonal ELO', value: `${sElo}`, inline: true });
          if (sEIndex) matchTypeFields.push({ name: 'Seasonal Efficiency Index', value: `${sEIndex}`, inline: true });
          if (sWins || sLoss) matchTypeFields.push({ name: 'Season W/L', value: `${sWins || 0}/${sLoss || 0}`, inline: true });
          if (sWinRate) matchTypeFields.push({ name: 'Season Winrate', value: `${sWinRate}`, inline: true });

          if (elo) matchTypeFields.push({ name: 'Career ELO', value: `${elo}`, inline: true });
          if (eIndex) matchTypeFields.push({ name: 'Career Efficiency Index', value: `${eIndex}`, inline: true });
          if (cWins || cLoss) matchTypeFields.push({ name: 'Career W/L', value: `${cWins || 0}/${cLoss || 0}`, inline: true });
          if (cWinRate) matchTypeFields.push({ name: 'Career Winrate', value: `${cWinRate}`, inline: true });

          if (matchTypeFields.length > 0) {
            embed.fields.push({ name: `${
        matchType === 'Melee' ? 'Match Type: Melee ⚔️' :
        matchType === 'HLD' ? 'Match Type: HLD 9️⃣9️⃣' :
        matchType === 'LLD' ? '30 Match Type: LLD 3️⃣0️⃣' :
        `Match Type: ${matchType}`}`, value: matchTypeFields.map(field => `${field.name}: ${field.value}`).join('\n'), inline: false });
          }
        }
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching player stats:', error);
      await interaction.editReply({ content: 'There was an error while retrieving the player stats.', ephemeral: true });
    }
  },
};
