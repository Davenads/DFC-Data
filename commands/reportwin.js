const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Custom emoji IDs from production Discord server
const matchTypeEmojis = {
    HLD: '<:HLD:1434535063755952320>',
    LLD: '<:LLD:1434535487481319598>',
    Melee: '<:Melee:1434536096238141501>'
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
                .setDescription('**Step 1/5:** Select the match type:')
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

        // Handle match type selection (Step 1 -> Step 2)
        if (customId.startsWith('reportwin_')) {
            const matchType = customId.replace('reportwin_', '').toUpperCase();

            // Show mirror match selection
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`reportmirror_${matchType}_no`)
                        .setLabel('No - Regular Match')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reportmirror_${matchType}_yes`)
                        .setLabel('Yes - Mirror Match')
                        .setStyle(ButtonStyle.Secondary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏆 Report Match Result')
                .setDescription(`✅ Match Type: **${matchType}**\n\n**Step 2/5:** Was this a mirror match?`)
                .setFooter({ text: 'DFC Match Reporting' })
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [row] });
            return true;
        }

        // Handle mirror selection (Step 2 -> Step 3)
        if (customId.startsWith('reportmirror_')) {
            const parts = customId.replace('reportmirror_', '').split('_');
            const matchType = parts[0];
            const isMirror = parts[1] === 'yes';

            // Show player selection modal
            const modal = new ModalBuilder()
                .setCustomId(`reportplayers_${matchType}_${isMirror}`)
                .setTitle(`Step 3/5: Player Info`);

            const winnerInput = new TextInputBuilder()
                .setCustomId('winner')
                .setLabel('Winner Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Discord username or in-game name')
                .setRequired(true)
                .setMaxLength(100);

            const winnerClassInput = new TextInputBuilder()
                .setCustomId('winnerClass')
                .setLabel('Winner Class')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Amazon, Assassin, Barbarian, Druid, etc.')
                .setRequired(true)
                .setMaxLength(50);

            const winnerBuildInput = new TextInputBuilder()
                .setCustomId('winnerBuild')
                .setLabel('Winner Build')
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

            const loserClassInput = new TextInputBuilder()
                .setCustomId('loserClass')
                .setLabel('Loser Class')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Amazon, Assassin, Barbarian, Druid, etc.')
                .setRequired(true)
                .setMaxLength(50);

            const row1 = new ActionRowBuilder().addComponents(winnerInput);
            const row2 = new ActionRowBuilder().addComponents(winnerClassInput);
            const row3 = new ActionRowBuilder().addComponents(winnerBuildInput);
            const row4 = new ActionRowBuilder().addComponents(loserInput);
            const row5 = new ActionRowBuilder().addComponents(loserClassInput);

            modal.addComponents(row1, row2, row3, row4, row5);

            await interaction.showModal(modal);
            return true;
        }

        return false;
    },

    async handleModal(interaction, sheets, auth) {
        const customId = interaction.customId;

        // Handle player selection modal (Step 3 -> Step 4)
        if (customId.startsWith('reportplayers_')) {
            const parts = customId.replace('reportplayers_', '').split('_');
            const matchType = parts[0];
            const isMirror = parts[1] === 'true';

            const winner = interaction.fields.getTextInputValue('winner');
            const winnerClass = interaction.fields.getTextInputValue('winnerClass');
            const winnerBuild = interaction.fields.getTextInputValue('winnerBuild');
            const loser = interaction.fields.getTextInputValue('loser');
            const loserClass = interaction.fields.getTextInputValue('loserClass');

            // Store data and show match details modal
            const modal = new ModalBuilder()
                .setCustomId(`reportdetails_${matchType}_${isMirror}_${winner}_${winnerClass}_${winnerBuild}_${loser}_${loserClass}`)
                .setTitle(`Step 4/5: Match Details`);

            const loserBuildInput = new TextInputBuilder()
                .setCustomId('loserBuild')
                .setLabel('Loser Build')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Wind, Ghost, Hybrid LS, etc.')
                .setRequired(true)
                .setMaxLength(100);

            const dateInput = new TextInputBuilder()
                .setCustomId('duelDate')
                .setLabel('Duel Date (MM/DD/YYYY)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('11/02/2025')
                .setRequired(true)
                .setMaxLength(10);

            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('No, Initial, Defend, or Reclaim')
                .setRequired(true)
                .setMaxLength(20);

            const roundWinsInput = new TextInputBuilder()
                .setCustomId('roundWins')
                .setLabel('Round Wins')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Number of rounds winner won (0-20)')
                .setRequired(true)
                .setMaxLength(2);

            const roundLossesInput = new TextInputBuilder()
                .setCustomId('roundLosses')
                .setLabel('Round Losses')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Number of rounds loser won (0-20)')
                .setRequired(true)
                .setMaxLength(2);

            const row1 = new ActionRowBuilder().addComponents(loserBuildInput);
            const row2 = new ActionRowBuilder().addComponents(dateInput);
            const row3 = new ActionRowBuilder().addComponents(titleInput);
            const row4 = new ActionRowBuilder().addComponents(roundWinsInput);
            const row5 = new ActionRowBuilder().addComponents(roundLossesInput);

            modal.addComponents(row1, row2, row3, row4, row5);

            await interaction.showModal(modal);
            return true;
        }

        // Handle match details modal (Step 4 -> Step 5)
        if (customId.startsWith('reportdetails_')) {
            const parts = customId.replace('reportdetails_', '').split('_');
            const matchType = parts[0];
            const isMirror = parts[1] === 'true';
            const winner = parts[2];
            const winnerClass = parts[3];
            const winnerBuild = parts[4];
            const loser = parts[5];
            const loserClass = parts[6];

            const loserBuild = interaction.fields.getTextInputValue('loserBuild');
            const duelDate = interaction.fields.getTextInputValue('duelDate');
            const title = interaction.fields.getTextInputValue('title');
            const roundWins = interaction.fields.getTextInputValue('roundWins');
            const roundLosses = interaction.fields.getTextInputValue('roundLosses');

            // Show notes modal
            const modal = new ModalBuilder()
                .setCustomId(`reportnotes_${matchType}_${isMirror}_${winner}_${winnerClass}_${winnerBuild}_${loser}_${loserClass}_${loserBuild}_${duelDate}_${title}_${roundWins}_${roundLosses}`)
                .setTitle(`Step 5/5: Optional Notes`);

            const notesInput = new TextInputBuilder()
                .setCustomId('notes')
                .setLabel('Notes (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Any additional notes or comments...')
                .setRequired(false)
                .setMaxLength(500);

            const row1 = new ActionRowBuilder().addComponents(notesInput);
            modal.addComponents(row1);

            await interaction.showModal(modal);
            return true;
        }

        // Handle final submission (Step 5 -> Submit)
        if (customId.startsWith('reportnotes_')) {
            const timestamp = new Date().toISOString();
            const user = interaction.user;

            const parts = customId.replace('reportnotes_', '').split('_');
            const matchType = parts[0];
            const isMirror = parts[1] === 'true';
            const winner = parts[2];
            const winnerClass = parts[3];
            const winnerBuild = parts[4];
            const loser = parts[5];
            const loserClass = parts[6];
            const loserBuild = parts[7];
            const duelDate = parts[8];
            const title = parts[9];
            const roundWins = parts[10];
            const roundLosses = parts[11];
            const notes = interaction.fields.getTextInputValue('notes') || '';

            console.log(`[${timestamp}] Processing reportwin submission:
            User: ${user.tag} (${user.id})
            Match Type: ${matchType}
            Mirror: ${isMirror}
            Winner: ${winner} (${winnerClass} - ${winnerBuild})
            Loser: ${loser} (${loserClass} - ${loserBuild})
            Date: ${duelDate}
            Title: ${title}
            Score: ${roundWins}-${roundLosses}
            Notes: ${notes}`);

            try {
                await interaction.deferReply({ ephemeral: true });

                const testMode = process.env.TEST_MODE === 'true';

                if (testMode) {
                    console.log(`[${timestamp}] TEST MODE: Would submit to Google Form:`);
                    console.log(`Form Data:`, {
                        [FORM_ENTRIES.duelDate]: duelDate,
                        [FORM_ENTRIES.matchType]: matchType,
                        [FORM_ENTRIES.title]: title,
                        [FORM_ENTRIES.roundWins]: roundWins,
                        [FORM_ENTRIES.roundLosses]: roundLosses,
                        [FORM_ENTRIES.mirror]: isMirror ? 'Yes' : 'No',
                        [FORM_ENTRIES.winner]: winner,
                        [FORM_ENTRIES.winnerClass]: winnerClass,
                        [FORM_ENTRIES.winnerBuilds[winnerClass]]: winnerBuild,
                        [FORM_ENTRIES.loser]: loser,
                        [FORM_ENTRIES.loserClass]: loserClass,
                        [FORM_ENTRIES.loserBuilds[loserClass]]: loserBuild,
                        [FORM_ENTRIES.notes]: notes
                    });

                    // Write to test sheet
                    const sheetTimestamp = new Date().toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });

                    await sheets.spreadsheets.values.append({
                        auth: auth,
                        spreadsheetId: process.env.TEST_SPREADSHEET_ID,
                        range: 'Duel Data Preview!A:M',
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [[
                                duelDate,
                                winner,
                                winnerClass,
                                winnerBuild,
                                loser,
                                loserClass,
                                loserBuild,
                                roundLosses, // # Round Losses
                                matchType,
                                '', // Exceptions
                                isMirror ? 'Yes' : '', // Mirror
                                title,
                                notes
                            ]]
                        }
                    });

                    console.log(`[${timestamp}] TEST MODE: Data written to test sheet`);
                } else {
                    // Production mode - submit to Google Form
                    const formData = new URLSearchParams();
                    formData.append(FORM_ENTRIES.duelDate, duelDate);
                    formData.append(FORM_ENTRIES.matchType, matchType);
                    formData.append(FORM_ENTRIES.title, title);
                    formData.append(FORM_ENTRIES.roundWins, roundWins);
                    formData.append(FORM_ENTRIES.roundLosses, roundLosses);
                    formData.append(FORM_ENTRIES.mirror, isMirror ? 'Yes' : 'No');
                    formData.append(FORM_ENTRIES.winner, winner);
                    formData.append(FORM_ENTRIES.winnerClass, winnerClass);
                    formData.append(FORM_ENTRIES.winnerBuilds[winnerClass], winnerBuild);
                    formData.append(FORM_ENTRIES.loser, loser);
                    formData.append(FORM_ENTRIES.loserClass, loserClass);
                    formData.append(FORM_ENTRIES.loserBuilds[loserClass], loserBuild);
                    if (notes) formData.append(FORM_ENTRIES.notes, notes);

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
                        { name: 'Match Type', value: `${matchTypeEmojis[matchType]} **${matchType}**`, inline: true },
                        { name: 'Date', value: `**${duelDate}**`, inline: true },
                        { name: 'Title', value: `**${title}**`, inline: true },
                        { name: 'Winner', value: `**${winner}**\n${winnerClass} - ${winnerBuild}`, inline: true },
                        { name: 'Loser', value: `**${loser}**\n${loserClass} - ${loserBuild}`, inline: true },
                        { name: 'Score', value: `**${roundWins}-${roundLosses}**`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: testMode ? 'TEST MODE - Data written to test sheet' : 'Match reported successfully!' });

                if (isMirror) {
                    embed.addFields({ name: '🪞 Mirror Match', value: 'Yes', inline: true });
                }

                if (notes) {
                    embed.addFields({ name: '📝 Notes', value: notes, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });
                console.log(`[${timestamp}] Reportwin completed successfully for ${user.tag} (${user.id})`);
            } catch (error) {
                console.error(`[${timestamp}] Error processing reportwin for ${user.tag} (${user.id}):`, error);

                if (interaction.deferred) {
                    await interaction.editReply({ content: 'Failed to report match result. Please try again later.' });
                } else {
                    await interaction.reply({ content: 'Failed to report match result. Please try again later.', ephemeral: true });
                }
            }

            return true;
        }

        return false;
    }
};
