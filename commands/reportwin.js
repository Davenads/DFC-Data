const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const redisClient = require('../utils/redisClient');

// Custom emoji IDs from production Discord server
const matchTypeEmojis = {
    HLD: '<:HLD:1434535063755952320>',
    LLD: '<:LLD:1434535487481319598>',
    Melee: '<:Melee:1434536096238141501>'
};

const classEmojis = {
    Amazon: '<:Amazon:953116506726744094>',
    Assassin: '<:Assassin:953116506697379891>',
    Barbarian: '<:barb:924434081406672977>',
    Druid: '<:Druid:994817312563671050>',
    Necromancer: '<:Necro:994817323653419058>',
    Paladin: '<:Pala:1039258310857195730>',
    Sorceress: '<:sorc:924434081163391058>'
};

// Form entry IDs for Google Form submission
const FORM_ENTRIES = {
    duelDate: 'entry.666586256',
    matchType: 'entry.781478868',
    title: 'entry.2023271252',
    roundWins: 'entry.163517227',
    roundLosses: 'entry.1181419043',
    mirror: 'entry.609831919',
    mirrorType: 'entry.609696423',
    winner: 'entry.1277410118',
    winnerClass: 'entry.680532683',
    loser: 'entry.163644941',
    loserClass: 'entry.1258194465',
    notes: 'entry.1405294917',
    // Winner builds by class
    winnerBuilds: {
        Amazon: 'entry.1213271713',
        Assassin: 'entry.1581661749',
        Barbarian: 'entry.431357945',
        Druid: 'entry.589644688',
        Necromancer: 'entry.1267787377',
        Paladin: 'entry.706357155',
        Sorceress: 'entry.835898849'
    },
    // Loser builds by class
    loserBuilds: {
        Amazon: 'entry.1175026707',
        Assassin: 'entry.1900276267',
        Barbarian: 'entry.385883979',
        Druid: 'entry.1436103576',
        Necromancer: 'entry.1513417734',
        Paladin: 'entry.1927282053',
        Sorceress: 'entry.1431447468'
    }
};

// Helper function to get/set Redis data for a user's reportwin session
async function getReportData(userId) {
    try {
        const client = redisClient.getClient();
        if (!client) return null;

        const data = await client.get(`reportwin_${userId}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error getting report data for user ${userId}:`, error);
        return null;
    }
}

async function setReportData(userId, data) {
    try {
        const client = redisClient.getClient();
        if (!client) return false;

        // Store for 10 minutes (TTL)
        await client.setEx(`reportwin_${userId}`, 600, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`Error setting report data for user ${userId}:`, error);
        return false;
    }
}

async function clearReportData(userId) {
    try {
        const client = redisClient.getClient();
        if (!client) return false;

        await client.del(`reportwin_${userId}`);
        return true;
    } catch (error) {
        console.error(`Error clearing report data for user ${userId}:`, error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportwin')
        .setDescription('Report the result of a match'),
    role: 'DFC Dueler',

    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing reportwin command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);

        try {
            // Clear any existing session data
            await clearReportData(user.id);

            // Step 1: Show match type selection buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('reportwin_hld')
                        .setLabel('HLD')
                        .setEmoji('1434535063755952320')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('reportwin_lld')
                        .setLabel('LLD')
                        .setEmoji('1434535487481319598')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('reportwin_melee')
                        .setLabel('Melee')
                        .setEmoji('1434536096238141501')
                        .setStyle(ButtonStyle.Primary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🏆 Report Match Result')
                .setDescription('**Step 1/6:** Select the match type:')
                .setFooter({ text: 'DFC Match Reporting' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            console.log(`[${timestamp}] Match type selection shown to ${user.tag} (${user.id})`);
        } catch (error) {
            console.error(`[${timestamp}] Error showing reportwin to ${user.tag} (${user.id}):`, error);
            await interaction.reply({ content: 'Failed to start match reporting. Please try again later.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        const customId = interaction.customId;
        const userId = interaction.user.id;

        try {
            // Handle match type selection (Step 1 -> Step 2)
            if (customId.startsWith('reportwin_')) {
                const matchType = customId.replace('reportwin_', '').toUpperCase();

                // Store match type in Redis
                await setReportData(userId, { matchType });

                // Show mirror match selection
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportmirror_no')
                            .setLabel('No - Regular Match')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('reportmirror_yes')
                            .setLabel('Yes - Mirror Match')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🏆 Report Match Result')
                    .setDescription(`✅ Match Type: **${matchType}**\n\n**Step 2/6:** Was this a mirror match?`)
                    .setFooter({ text: 'DFC Match Reporting' })
                    .setTimestamp();

                await interaction.update({ embeds: [embed], components: [row] });
                return true;
            }

            // Handle mirror selection (Step 2 -> Step 3)
            if (customId.startsWith('reportmirror_')) {
                const isMirror = customId === 'reportmirror_yes';
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

                data.isMirror = isMirror;
                await setReportData(userId, data);

                // Show winner class selection
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Amazon')
                            .setLabel('Amazon')
                            .setEmoji('953116506726744094')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Assassin')
                            .setLabel('Assassin')
                            .setEmoji('953116506697379891')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Barbarian')
                            .setLabel('Barbarian')
                            .setEmoji('924434081406672977')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Druid')
                            .setLabel('Druid')
                            .setEmoji('994817312563671050')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Necromancer')
                            .setLabel('Necromancer')
                            .setEmoji('994817323653419058')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Paladin')
                            .setLabel('Paladin')
                            .setEmoji('1039258310857195730')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportwinclass_Sorceress')
                            .setLabel('Sorceress')
                            .setEmoji('924434081163391058')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🏆 Report Match Result')
                    .setDescription(`✅ Match Type: **${data.matchType}**\n✅ Mirror: **${isMirror ? 'Yes' : 'No'}**\n\n**Step 3/6:** Select the **Winner's** class:`)
                    .setFooter({ text: 'DFC Match Reporting' })
                    .setTimestamp();

                await interaction.update({ embeds: [embed], components: [row1, row2] });
                return true;
            }

            // Handle winner class selection (Step 3 -> Step 4)
            if (customId.startsWith('reportwinclass_')) {
                const winnerClass = customId.replace('reportwinclass_', '');
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

                data.winnerClass = winnerClass;
                await setReportData(userId, data);

                // Show loser class selection
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Amazon')
                            .setLabel('Amazon')
                            .setEmoji('953116506726744094')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Assassin')
                            .setLabel('Assassin')
                            .setEmoji('953116506697379891')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Barbarian')
                            .setLabel('Barbarian')
                            .setEmoji('924434081406672977')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Druid')
                            .setLabel('Druid')
                            .setEmoji('994817312563671050')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Necromancer')
                            .setLabel('Necromancer')
                            .setEmoji('994817323653419058')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Paladin')
                            .setLabel('Paladin')
                            .setEmoji('1039258310857195730')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('reportloseclass_Sorceress')
                            .setLabel('Sorceress')
                            .setEmoji('924434081163391058')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🏆 Report Match Result')
                    .setDescription(`✅ Match Type: **${data.matchType}**\n✅ Winner Class: **${winnerClass}**\n\n**Step 4/6:** Select the **Loser's** class:`)
                    .setFooter({ text: 'DFC Match Reporting' })
                    .setTimestamp();

                await interaction.update({ embeds: [embed], components: [row1, row2] });
                return true;
            }

            // Handle loser class selection (Step 4 -> Step 5 Modal)
            if (customId.startsWith('reportloseclass_')) {
                const loserClass = customId.replace('reportloseclass_', '');
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

                data.loserClass = loserClass;
                await setReportData(userId, data);

                // Show modal for player names and builds
                const modal = new ModalBuilder()
                    .setCustomId('reportplayers')
                    .setTitle('Step 5/6: Player Details');

                const winnerInput = new TextInputBuilder()
                    .setCustomId('winner')
                    .setLabel('Winner Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Discord username or in-game name')
                    .setRequired(true)
                    .setMaxLength(100);

                const winnerBuildInput = new TextInputBuilder()
                    .setCustomId('winnerBuild')
                    .setLabel(`Winner Build (${data.winnerClass})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., Wind, Ghost, Hybrid LS, etc.')
                    .setRequired(true)
                    .setMaxLength(100);

                const loserInput = new TextInputBuilder()
                    .setCustomId('loser')
                    .setLabel('Loser Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Discord username or in-game name')
                    .setRequired(true)
                    .setMaxLength(100);

                const loserBuildInput = new TextInputBuilder()
                    .setCustomId('loserBuild')
                    .setLabel(`Loser Build (${loserClass})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., Wind, Ghost, Hybrid LS, etc.')
                    .setRequired(true)
                    .setMaxLength(100);

                const dateInput = new TextInputBuilder()
                    .setCustomId('duelDate')
                    .setLabel('Duel Date (MM/DD/YYYY) - Leave blank for today')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Leave empty to use current date')
                    .setRequired(false)
                    .setMaxLength(10);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(winnerInput),
                    new ActionRowBuilder().addComponents(winnerBuildInput),
                    new ActionRowBuilder().addComponents(loserInput),
                    new ActionRowBuilder().addComponents(loserBuildInput),
                    new ActionRowBuilder().addComponents(dateInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in reportwin handleButton:`, error);
            console.error(`CustomId: ${customId}, UserId: ${userId}`);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
            }
            return true;
        }
    },

    async handleModal(interaction, sheets, auth) {
        const customId = interaction.customId;
        const userId = interaction.user.id;
        const timestamp = new Date().toISOString();

        try {
            // Handle player details modal (Step 5 -> Step 6)
            if (customId === 'reportplayers') {
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.reply({ content: 'Session expired. Please run /reportwin again.', ephemeral: true });
                    return true;
                }

                data.winner = interaction.fields.getTextInputValue('winner');
                data.winnerBuild = interaction.fields.getTextInputValue('winnerBuild');
                data.loser = interaction.fields.getTextInputValue('loser');
                data.loserBuild = interaction.fields.getTextInputValue('loserBuild');

                // Handle optional date field - auto-populate if empty
                let duelDate = interaction.fields.getTextInputValue('duelDate').trim();
                if (!duelDate) {
                    const today = new Date();
                    duelDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
                    console.log(`[${timestamp}] Auto-populated date: ${duelDate}`);
                }
                data.duelDate = duelDate;

                await setReportData(userId, data);

                // Show match details modal
                const modal = new ModalBuilder()
                    .setCustomId('reportdetails')
                    .setTitle('Step 6/6: Match Details');

                const titleInput = new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('No, Initial, Defend, or Reclaim')
                    .setRequired(true)
                    .setMaxLength(20);

                const roundWinsInput = new TextInputBuilder()
                    .setCustomId('roundWins')
                    .setLabel('Round Wins (Winner)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Number of rounds winner won (0-20)')
                    .setRequired(true)
                    .setMaxLength(2);

                const roundLossesInput = new TextInputBuilder()
                    .setCustomId('roundLosses')
                    .setLabel('Round Losses (Loser)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Number of rounds loser won (0-20)')
                    .setRequired(true)
                    .setMaxLength(2);

                const notesInput = new TextInputBuilder()
                    .setCustomId('notes')
                    .setLabel('Notes (Optional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Any additional notes or comments...')
                    .setRequired(false)
                    .setMaxLength(500);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(roundWinsInput),
                    new ActionRowBuilder().addComponents(roundLossesInput),
                    new ActionRowBuilder().addComponents(notesInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            // Handle match details modal (Final submission)
            if (customId === 'reportdetails') {
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.reply({ content: 'Session expired. Please run /reportwin again.', ephemeral: true });
                    return true;
                }

                data.title = interaction.fields.getTextInputValue('title');
                data.roundWins = interaction.fields.getTextInputValue('roundWins');
                data.roundLosses = interaction.fields.getTextInputValue('roundLosses');
                data.notes = interaction.fields.getTextInputValue('notes') || '';

                console.log(`[${timestamp}] Processing reportwin submission:
                User: ${interaction.user.tag} (${userId})
                Match Type: ${data.matchType}
                Mirror: ${data.isMirror}
                Winner: ${data.winner} (${data.winnerClass} - ${data.winnerBuild})
                Loser: ${data.loser} (${data.loserClass} - ${data.loserBuild})
                Date: ${data.duelDate}
                Title: ${data.title}
                Score: ${data.roundWins}-${data.roundLosses}
                Notes: ${data.notes}`);

                await interaction.deferReply({ ephemeral: true });

                const testMode = process.env.TEST_MODE === 'true';

                if (testMode) {
                    console.log(`[${timestamp}] TEST MODE: Would submit to Google Form with data:`, data);

                    try {
                        // Write to test sheet
                        console.log(`[${timestamp}] Attempting to write to test sheet...`);
                        console.log(`Spreadsheet ID: ${process.env.TEST_SPREADSHEET_ID}`);
                        console.log(`Range: Duel Data Preview!A:M`);

                        const rowData = [
                            data.duelDate,
                            data.winner,
                            data.winnerClass,
                            data.winnerBuild,
                            data.loser,
                            data.loserClass,
                            data.loserBuild,
                            data.roundLosses, // # Round Losses
                            data.matchType,
                            '', // Exceptions
                            data.isMirror ? 'Yes' : '', // Mirror
                            data.title,
                            data.notes
                        ];

                        console.log(`[${timestamp}] Row data to append:`, rowData);

                        const appendResponse = await sheets.spreadsheets.values.append({
                            auth: auth,
                            spreadsheetId: process.env.TEST_SPREADSHEET_ID,
                            range: 'Duel Data Preview!A:M',
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [rowData]
                            }
                        });

                        console.log(`[${timestamp}] TEST MODE: Sheet append successful!`);
                        console.log(`[${timestamp}] Append response:`, JSON.stringify(appendResponse.data, null, 2));
                    } catch (sheetError) {
                        console.error(`[${timestamp}] ERROR writing to test sheet:`, sheetError);
                        console.error(`[${timestamp}] Error details:`, {
                            message: sheetError.message,
                            stack: sheetError.stack,
                            response: sheetError.response?.data
                        });

                        await interaction.editReply({
                            content: `Failed to write to test sheet. Error: ${sheetError.message}\n\nCheck console logs for details.`
                        });
                        await clearReportData(userId);
                        return true;
                    }
                } else {
                    // Production mode - submit to Google Form
                    console.log(`[${timestamp}] PRODUCTION MODE: Submitting to Google Form...`);

                    const formData = new URLSearchParams();
                    formData.append(FORM_ENTRIES.duelDate, data.duelDate);
                    formData.append(FORM_ENTRIES.matchType, data.matchType);
                    formData.append(FORM_ENTRIES.title, data.title);
                    formData.append(FORM_ENTRIES.roundWins, data.roundWins);
                    formData.append(FORM_ENTRIES.roundLosses, data.roundLosses);
                    formData.append(FORM_ENTRIES.mirror, data.isMirror ? 'Yes' : 'No');
                    formData.append(FORM_ENTRIES.winner, data.winner);
                    formData.append(FORM_ENTRIES.winnerClass, data.winnerClass);
                    formData.append(FORM_ENTRIES.winnerBuilds[data.winnerClass], data.winnerBuild);
                    formData.append(FORM_ENTRIES.loser, data.loser);
                    formData.append(FORM_ENTRIES.loserClass, data.loserClass);
                    formData.append(FORM_ENTRIES.loserBuilds[data.loserClass], data.loserBuild);
                    if (data.notes) formData.append(FORM_ENTRIES.notes, data.notes);

                    const formResponse = await fetch(
                        'https://docs.google.com/forms/d/e/1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg/formResponse',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: formData.toString(),
                            redirect: 'manual'
                        }
                    );

                    console.log(`[${timestamp}] Form submission status: ${formResponse.status}`);
                }

                // Create confirmation embed
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🏆 Match Result Reported')
                    .addFields(
                        { name: 'Match Type', value: `${matchTypeEmojis[data.matchType]} **${data.matchType}**`, inline: true },
                        { name: 'Date', value: `**${data.duelDate}**`, inline: true },
                        { name: 'Title', value: `**${data.title}**`, inline: true },
                        { name: 'Winner', value: `**${data.winner}**\n${classEmojis[data.winnerClass]} ${data.winnerClass} - ${data.winnerBuild}`, inline: true },
                        { name: 'Loser', value: `**${data.loser}**\n${classEmojis[data.loserClass]} ${data.loserClass} - ${data.loserBuild}`, inline: true },
                        { name: 'Score', value: `**${data.roundWins}-${data.roundLosses}**`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: testMode ? 'TEST MODE - Data written to test sheet' : 'Match reported successfully!' });

                if (data.isMirror) {
                    embed.addFields({ name: '🪞 Mirror Match', value: 'Yes', inline: true });
                }

                if (data.notes) {
                    embed.addFields({ name: '📝 Notes', value: data.notes, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });
                console.log(`[${timestamp}] Reportwin completed successfully for ${interaction.user.tag} (${userId})`);

                // Clear Redis data
                await clearReportData(userId);

                return true;
            }

            return false;
        } catch (error) {
            console.error(`[${timestamp}] Error in reportwin handleModal:`, error);
            console.error(`CustomId: ${customId}, UserId: ${userId}`);
            console.error(`Error stack:`, error.stack);

            if (interaction.deferred) {
                await interaction.editReply({ content: 'Failed to process match report. Please try again later.' });
            } else if (!interaction.replied) {
                await interaction.reply({ content: 'Failed to process match report. Please try again later.', ephemeral: true });
            }

            await clearReportData(userId);
            return true;
        }
    }
};
