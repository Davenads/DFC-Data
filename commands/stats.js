const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');
const { createGoogleAuth } = require('../utils/googleAuth');

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
    const timestamp = new Date().toISOString();
    const focusedValue = interaction.options.getFocused();
    const user = interaction.user;
    
    console.log(`[${timestamp}] Processing stats autocomplete:
    User: ${user.tag} (${user.id})
    Search Term: ${focusedValue}`);
    
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:A',
      });

      const players = response.data.values ? response.data.values.flat() : [];
      const uniquePlayers = [...new Set(players)]; // Remove duplicate names
      const searchTerm = interaction.options.getFocused().toLowerCase();

      const filteredPlayers = uniquePlayers.filter(player =>
        player.toLowerCase().includes(searchTerm)
      ).slice(0, 25); // Limit to 25 players to meet Discord's requirements

      const results = filteredPlayers.map(player => ({ name: player, value: player }));
      await interaction.respond(results);
      console.log(`[${timestamp}] Stats autocomplete returned ${results.length} results for user ${user.tag} (${user.id}) search: "${searchTerm}"`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching player names for autocomplete by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const playerName = interaction.options.getString('player');
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing stats command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Player: ${playerName}`);
    
    const sheets = google.sheets('v4');
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

    await interaction.deferReply({ ephemeral: true }); // Defer the reply to avoid timeouts

    try {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: process.env.QUERY_SPREADSHEET_ID,
        range: 'Current ELO!A2:M',
      });

      const rows = response.data.values || [];
      const playerRows = rows.filter(row => row[0].toLowerCase() === playerName.toLowerCase());

      if (playerRows.length === 0) {
        console.log(`[${timestamp}] Player ${playerName} not found for stats requested by ${user.tag} (${user.id})`);
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

          const seasonalStats = [
            sElo && `ELO: ${sElo}`,
            sEIndex && `Efficiency Index: ${sEIndex}`,
            (sWins || sLoss) && `W/L: ${sWins || 0}/${sLoss || 0}`,
            sWinRate && `Winrate: ${sWinRate}`
          ].filter(Boolean).join('\n');

          const careerStats = [
            elo && `ELO: ${elo}`,
            eIndex && `Efficiency Index: ${eIndex}`,
            (cWins || cLoss) && `W/L: ${cWins || 0}/${cLoss || 0}`,
            cWinRate && `Winrate: ${cWinRate}`
          ].filter(Boolean).join('\n');

          embed.fields.push({
            name: matchType,
            value: `**Seasonal Stats**:\n${seasonalStats}\n\n**Career Stats**:\n${careerStats}`,
            inline: true
          });
        }
      });

      await interaction.editReply({ embeds: [embed], ephemeral: true });
      console.log(`[${timestamp}] Stats for player ${playerName} sent successfully to ${user.tag} (${user.id}) - found ${processedMatchTypes.size} match types`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching stats for player ${playerName} requested by ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving the player stats.', ephemeral: true });
    }
  },
};
