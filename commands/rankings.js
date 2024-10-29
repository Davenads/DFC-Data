const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankings')
        .setDescription('Get the DFC rankings')
        .addStringOption(option =>
            option.setName('rank_type')
                .setDescription('Specify the rank type')
                .setRequired(true)
                .addChoices(
                    { name: 'Efficiency Index', value: 'eindex' },
                    { name: 'ELO', value: 'elo' }
                )
        )
        .addStringOption(option =>
            option.setName('match_type')
                .setDescription('Specify the match type (HLD, LLD, Melee)')
                .setRequired(true)
                .addChoices(
                    { name: 'HLD', value: 'HLD' },
                    { name: 'LLD', value: 'LLD' },
                    { name: 'Melee', value: 'Melee' }
                )
        )
        .addStringOption(option =>
            option.setName('ranking_scope')
                .setDescription('Specify the ranking scope')
                .setRequired(true)
                .addChoices(
                    { name: 'Career', value: 'career' },
                    { name: 'Seasonal', value: 'seasonal' }
                )
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of players to rank (max 50)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(50)
        ),

    async execute(interaction) {
        const rankType = interaction.options.getString('rank_type');
        const matchType = interaction.options.getString('match_type');
        const rankingScope = interaction.options.getString('ranking_scope');
        const limit = interaction.options.getInteger('limit');

        try {
            await interaction.deferReply();
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_CLIENT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
            const client = await auth.getClient();
            const sheets = google.sheets('v4');

            // Fetch data from the "Elo Summary" tab for ELO ranking
            if (rankType === 'elo') {
                const SHEET_NAME = 'Elo Summary';
                const res = await sheets.spreadsheets.values.get({
                    auth: client,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: `${SHEET_NAME}!B:L`,
                });

                const rows = res.data.values;
                if (!rows || rows.length === 0) {
                    await interaction.editReply('No data found in the sheet.');
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
                        elo: parseInt(parseFloat(row[rankingScope === 'career' ? 4 : 10])), // Career or Seasonal Elo (Columns F or L, adjusted to index 4 or 10), rounded to int
                    }))
                    .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending to get the latest entries first
                    .reduce((acc, row) => {
                        if (!acc.some(r => r.player === row.player)) {
                            acc.push(row); // Add only the latest entry for each player
                        }
                        return acc;
                    }, [])
                    .sort((a, b) => b.elo - a.elo) // Sort by ELO descending
                    .slice(0, limit); // Get top players up to the limit specified

                // Log filtered data for debugging
                console.log('Filtered Rows:', filteredRows);

                if (filteredRows.length === 0) {
                    await interaction.editReply('No players found for the specified match type and ELO type.');
                    return;
                }

                // Emojis for ranks
                const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

                // Create the embed pages
                const embeds = [];
                for (let i = 0; i < filteredRows.length; i += 10) {
                    const currentPage = filteredRows.slice(i, i + 10);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle(`📊 Top ${limit} Player ELOs - ${matchType} (${rankingScope.charAt(0).toUpperCase() + rankingScope.slice(1)} Elo)`)
                        .setDescription(`Parsed from Google Sheets "${SHEET_NAME}" tab`)
                        .setTimestamp();

                    currentPage.forEach((row, index) => {
                        const rankDisplay = rankEmojis[i + index] || `#${i + index + 1}`;
                        embed.addFields({
                            name: `${rankDisplay} - ${row.player} (${row.elo})`,
                            value: '​​​',
                            inline: false
                        });
                    });

                    embeds.push(embed);
                }

                // Send the first embed and add buttons for pagination if needed
                if (embeds.length > 1) {
                    let currentPageIndex = 0;
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_button')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('next_button')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const message = await interaction.editReply({ embeds: [embeds[currentPageIndex]], components: [row], fetchReply: true });

                    const filter = i => ['prev_button', 'next_button'].includes(i.customId) && i.user.id === interaction.user.id;
                    const collector = message.createMessageComponentCollector({ filter, time: 60000 });

                    collector.on('collect', async i => {
                        if (i.customId === 'prev_button') {
                            currentPageIndex = currentPageIndex > 0 ? currentPageIndex - 1 : embeds.length - 1;
                        } else if (i.customId === 'next_button') {
                            currentPageIndex = currentPageIndex + 1 < embeds.length ? currentPageIndex + 1 : 0;
                        }
                        await i.update({ embeds: [embeds[currentPageIndex]], components: [row] });
                    });

                    collector.on('end', () => {
                        message.edit({ components: [] });
                    });
                } else {
                    await interaction.editReply({ embeds: [embeds[0]] });
                }
                return;
            }

            // Existing logic for Efficiency Index ranking
            const res = await sheets.spreadsheets.values.get({
                auth: client,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Current Elo!A:G',
            });

            const eloData = res.data.values || [];
            console.log('Raw Data from Google Sheets:', eloData);
            if (eloData.length === 0) {
                console.log('No data found in the sheet.');
                return interaction.editReply('No player data available.');
            }

            const headerRow = eloData.shift(); // Remove the header row
            console.log('Header Row:', headerRow);

            // Filter data based on match type
            const filteredData = eloData.filter(row => {
                const matchTypeValue = row[2];
                console.log('Checking match type for row:', row, 'Match Type:', matchTypeValue);
                return matchTypeValue === matchType;
            });
            console.log('Filtered Data by Match Type:', filteredData);

            if (filteredData.length === 0) {
                console.log('No data found for the specified match type:', matchType);
                return interaction.editReply(`No players found for match type: ${matchType}`);
            }

            // Select the correct column based on rank type and ranking scope
            let rankColumnIndex;
            filteredData.forEach(row => {
                rankColumnIndex = (rankingScope === 'career' && row.length >= 7) ? 6 : 5;
                console.log('Determined Rank Column Index for Player:', row[0], 'Index:', rankColumnIndex);
            });

            console.log('Rank Type:', rankType);
            console.log('Ranking Scope:', rankingScope);
            console.log('Selected Column Index:', rankColumnIndex);

            // Clean and validate data
            const cleanedData = filteredData.map(row => {
                if (rankColumnIndex >= row.length) {
                    console.log('Skipping row due to missing data:', row);
                    return null;
                }
                const value = parseFloat(row[rankColumnIndex]);
                console.log('Processing Player:', row[0], 'Rank Column Value:', row[rankColumnIndex], 'Parsed Value:', value);
                return {
                    player: row[0],
                    value: !isNaN(value) ? value : null,
                    row: row
                };
            }).filter(entry => entry !== null && entry.value !== null);

            if (cleanedData.length === 0) {
                console.log('No valid Efficiency Index data found after cleaning.');
                return interaction.editReply('No valid ranking data found for the specified criteria.');
            }

            // Sort data by value in descending order
            const sortedData = cleanedData.sort((a, b) => b.value - a.value);
            console.log('Sorted Data:', sortedData);

            // Limit the number of results (cap at 20)
            const limitedData = sortedData.slice(0, Math.min(limit, 20));
            console.log('Limited Data (Top N):', limitedData);

            // Emojis for ranks
            const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

            // Create the embed pages
            const embeds = [];
            for (let i = 0; i < limitedData.length; i += 10) {
                const currentPage = limitedData.slice(i, i + 10);
                const embed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle(`${rankingScope.charAt(0).toUpperCase() + rankingScope.slice(1)} Efficiency Index Rankings - ${matchType}`)
                    .setDescription('Top players based on the specified criteria:')
                    .setTimestamp();

                currentPage.forEach((entry, index) => {
                    const rankDisplay = rankEmojis[i + index] || `#${i + index + 1}`;
                    embed.addFields(
                        { name: `${rankDisplay} - ${entry.player}`, value: `Index: ${entry.value.toFixed(2)}`, inline: false }
                    );
                });

                embeds.push(embed);
            }

            // Send the first embed and add buttons for pagination if needed
            if (embeds.length > 1) {
                let currentPageIndex = 0;
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_button')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('next_button')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                    );

                const message = await interaction.editReply({ embeds: [embeds[currentPageIndex]], components: [row], fetchReply: true });

                const filter = i => ['prev_button', 'next_button'].includes(i.customId) && i.user.id === interaction.user.id;
                const collector = message.createMessageComponentCollector({ filter, time: 60000 });

                collector.on('collect', async i => {
                    if (i.customId === 'prev_button') {
                        currentPageIndex = currentPageIndex > 0 ? currentPageIndex - 1 : embeds.length - 1;
                    } else if (i.customId === 'next_button') {
                        currentPageIndex = currentPageIndex + 1 < embeds.length ? currentPageIndex + 1 : 0;
                    }
                    await i.update({ embeds: [embeds[currentPageIndex]], components: [row] });
                });

                collector.on('end', () => {
                    message.edit({ components: [] });
                });
            } else {
                await interaction.editReply({ embeds: [embeds[0]] });
            }
        } catch (error) {
            console.error('Error fetching rankings:', error);
            await interaction.editReply('Failed to fetch rankings. Please try again later.');
        }
    }
};
