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
        .setDescription('Get the top 10 ELO rankings by match type and ELO type.')
        .addStringOption(option =>
            option.setName('match_type')
                .setDescription('Match type to view rankings for')
                .setRequired(true)
                .addChoices(
                    { name: 'HLD', value: 'HLD' },
                    { name: 'LLD', value: 'LLD' },
                    { name: 'Melee', value: 'Melee' }
                )
        )
        .addStringOption(option =>
            option.setName('elo_type')
                .setDescription('ELO type to view rankings for')
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
                range: `${SHEET_NAME}!B:L`, // Adjust range if necessary to include all relevant columns
            });

            const rows = res.data.values;

            if (!rows || rows.length === 0) {
                await interaction.reply('No data found in the sheet.');
                return;
            }

            // Filter rows based on match type and extract ELOs
            const filteredRows = rows.filter(row => row[10] === matchType); // Assuming column K is "Match Type"
            const eloColumnIndex = eloType === 'Current Elo' ? 5 : 11; // Column F for Current Elo, Column L for Seasonal Elo

            // Sort rows by ELO and take the top 10, making sure to use the latest timestamp for each player
            const sortedRows = filteredRows
                .map(row => ({
                    player: row[2], // Assuming column C is "Player Name"
                    elo: parseFloat(row[eloColumnIndex]),
                    timestamp: new Date(row[1]), // Column B is "Timestamp"
                }))
                .sort((a, b) => b.elo - a.elo || b.timestamp - a.timestamp)
                .slice(0, 10);

            if (sortedRows.length === 0) {
                await interaction.reply(`No rankings found for match type: ${matchType}.`);
                return;
            }

            // Construct the embed message with emojis and styling
            const embed = new EmbedBuilder()
                .setTitle(`🏆 Top 10 ${eloType} Rankings for ${matchType} 🏆`)
                .setColor('#FFD700')
                .setThumbnail('https://example.com/rankings-icon.png') // Replace with a relevant icon URL
                .setDescription(`Here are the top 10 players for **${matchType}** (${eloType}):`);

            sortedRows.forEach((row, index) => {
                const rankEmoji = [
                    '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'
                ][index];
                embed.addFields({ name: `${rankEmoji} ${row.player}`, value: `ELO: ${row.elo}`, inline: false });
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching rankings data:', error);
            await interaction.reply('An error occurred while fetching the rankings. Please try again later.');
        }
    },
};
