require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { google } = require('googleapis');
const { EmbedBuilder } = require('discord.js');

// Initialize Google Sheets API
const sheets = google.sheets('v4');

// Replace with your Google Sheets ID and authentication setup
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'Elo Summary';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankings')
        .setDescription('Get the top 10 players by ELO for a specific match type and ELO type.')
        .addStringOption(option =>
            option.setName('match_type')
                .setDescription('Type of match')
                .setRequired(true)
                .addChoices(
                    { name: 'HLD', value: 'HLD' },
                    { name: 'LLD', value: 'LLD' },
                    { name: 'Melee', value: 'Melee' }
                )
        )
        .addStringOption(option =>
            option.setName('elo_type')
                .setDescription('Type of ELO ranking')
                .setRequired(true)
                .addChoices(
                    { name: 'Overall', value: 'Current Elo' },
                    { name: 'Seasonal', value: 'Seasonal Elo' }
                )
        ),
    async execute(interaction) {
        const matchType = interaction.options.getString('match_type');
        const eloType = interaction.options.getString('elo_type');

        try {
            // Fetch data from the Google Sheet
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_CLIENT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });

            const client = await auth.getClient();

            const res = await sheets.spreadsheets.values.get({
                auth: client,
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!B:L`, // Adjust range to include relevant columns
            });

            const rows = res.data.values;

            if (!rows || rows.length === 0) {
                await interaction.reply('No data found in the sheet.');
                return;
            }

            // Log match type for debugging
            console.log('Selected Match Type:', matchType);
            rows.slice(1).forEach(row => console.log('Row Match Type:', row[9]));

            // Filter rows based on match type and ELO type, and get the latest entry for each player
            const filteredRows = rows.slice(1) // Remove header row
                .filter(row => row[9] === matchType) // Match type (Column K, adjusted to index 9)
                .map(row => ({
                    timestamp: new Date(row[0]), // Timestamp (Column B, adjusted to index 0)
                    player: row[1], // Player name (Column C, adjusted to index 1)
                    elo: parseInt(parseFloat(row[eloType === 'Current Elo' ? 4 : 10])), // Current or Seasonal Elo (Columns F or L, adjusted to index 4 or 10), rounded to int
                }))
                .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending to get the latest entries first
                .reduce((acc, row) => {
                    if (!acc.some(r => r.player === row.player)) {
                        acc.push(row); // Add only the latest entry for each player
                    }
                    return acc;
                }, [])
                .sort((a, b) => b.elo - a.elo) // Sort by ELO descending
                .slice(0, 10); // Get top 10 players

            // Log filtered data for debugging
            console.log('Filtered Rows:', filteredRows);

            if (filteredRows.length === 0) {
                await interaction.reply('No players found for the specified match type and ELO type.');
                return;
            }

            // Emojis for ranks
            const rankEmojis = [
                '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'
            ];

            // Construct the embed message with emojis and styling
            const embed = new EmbedBuilder()
                .setTitle(`📊 Top 10 Players - ${matchType} (${eloType}) 📊`)
                .setColor('#FFD700')
                .setThumbnail('https://example.com/elo-icon.png') // Replace with a relevant icon URL
                .setDescription(`Here are the top 10 players for **${matchType}** (${eloType}):`);

            filteredRows.forEach((row, index) => {
                embed.addFields({ name: `${rankEmojis[index]} - ${row.player}`, value: `ELO: ${row.elo}`, inline: false });
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching ELO data:', error);
            await interaction.reply('An error occurred while fetching the ELO data. Please try again later.');
        }
    },
};
