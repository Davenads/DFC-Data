require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { google } = require('googleapis');
const { EmbedBuilder } = require('discord.js');
const rosterCache = require('../utils/rosterCache');

// Initialize Google Sheets API
const sheets = google.sheets('v4');

// Replace with your Google Sheets ID and authentication setup
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'Elo Summary';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Get the latest ELOs for a specific dueler.')
        .addStringOption(option =>
            option.setName('dueler')
                .setDescription('Name of the dueler')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async execute(interaction, sheets, auth) {
        const duelerName = interaction.options.getString('dueler');
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing elo command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})
        Dueler: ${duelerName}`);

        try {
            // Fetch data from the Google Sheet
            const res = await sheets.spreadsheets.values.get({
                auth: auth,
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A:P`, // Adjust range if necessary to include all relevant columns
            });

            const rows = res.data.values;

            if (!rows || rows.length === 0) {
                await interaction.reply({ content: 'No data found in the sheet.', ephemeral: true });
                return;
            }

            // Filter rows to find all entries for the given dueler
            const duelerRows = rows.filter(row => row[2]?.toLowerCase() === duelerName.toLowerCase());

            if (duelerRows.length === 0) {
                await interaction.reply({ content: `No ELO data found for dueler: ${duelerName}`, ephemeral: true });
                return;
            }

            // Find the latest entry for each match type (e.g., HLD, LLD)
            const latestELOs = {};
            let latestTimestamp = null;

            duelerRows.forEach(row => {
                const timestamp = row[1];
                const matchType = row[10]; // Assuming column K is "Match Type"
                const currentELO = row[5]; // Assuming column F is "Current ELO"

                if (!latestELOs[matchType] || new Date(timestamp) > new Date(latestELOs[matchType].timestamp)) {
                    latestELOs[matchType] = {
                        elo: Math.round(currentELO),
                        timestamp: timestamp,
                    };
                }

                if (!latestTimestamp || new Date(timestamp) > new Date(latestTimestamp)) {
                    latestTimestamp = timestamp;
                }
            });

            // Construct the embed message with emojis and styling
            const embed = new EmbedBuilder()
                .setTitle(`🔥 Latest ELOs for ${duelerName} 🔥`)
                .setColor('#FFA500')
                .setThumbnail('https://example.com/elo-icon.png') // Replace with a relevant icon URL
                .setDescription(`Here are the most recent ELO ratings for **${duelerName}** (as of ${latestTimestamp}):`);

            for (const [matchType, data] of Object.entries(latestELOs)) {
                embed.addFields({ name: matchType, value: `ELO: ${data.elo}`, inline: true });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`[${timestamp}] Elo data for ${duelerName} sent successfully to ${user.tag} (${user.id})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error fetching ELO data for ${duelerName} requested by ${user.tag} (${user.id})`;
            console.error(errorMessage, error);
            await interaction.reply({ content: 'An error occurred while fetching the ELO data. Please try again later.', ephemeral: true });
        }
    },
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            // Get roster data from cache
            const roster = await rosterCache.getCachedRoster();

            // Get all registered players from roster
            const players = Object.entries(roster)
                .filter(([uuid, data]) => data.dataName) // Ensure dataName exists
                .map(([uuid, data]) => data.dataName);

            // Filter by focused value
            const searchTerm = focusedValue.toLowerCase();
            const filtered = players.filter(name =>
                name.toLowerCase().includes(searchTerm)
            );

            await interaction.respond(
                filtered.slice(0, 25).map(name => ({ name, value: name }))
            );
        } catch (error) {
            console.error('Error fetching players for autocomplete:', error);
            await interaction.respond([]);
        }
    },
};
