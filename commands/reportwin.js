const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const redisClient = require('../utils/redisClient');
const rosterCache = require('../utils/rosterCache');

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

// Production Form entry IDs
const PROD_FORM_ENTRIES = {
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

// Test Form entry IDs
const TEST_FORM_ENTRIES = {
    duelDate: 'entry.1895335701',
    matchType: 'entry.1592134870',
    title: 'entry.510006768',
    roundWins: 'entry.526540015',
    roundLosses: 'entry.1002526413',
    mirror: 'entry.1320054110',
    mirrorType: 'entry.1822282902',
    winner: 'entry.2115916997',
    winnerClass: 'entry.935484935',
    loser: 'entry.1212393589',
    loserClass: 'entry.1151669949',
    notes: 'entry.1312255002',
    // Winner builds by class
    winnerBuilds: {
        Amazon: 'entry.71129301',
        Assassin: 'entry.1410865365',
        Barbarian: 'entry.526101734',
        Druid: 'entry.1200809719',
        Necromancer: 'entry.686970788',
        Paladin: 'entry.289234995',
        Sorceress: 'entry.1299995905'
    },
    // Loser builds by class
    loserBuilds: {
        Amazon: 'entry.420855245',
        Assassin: 'entry.2107665401',
        Barbarian: 'entry.1591595355',
        Druid: 'entry.2107775276',
        Necromancer: 'entry.1768286282',
        Paladin: 'entry.857564675',
        Sorceress: 'entry.545772854'
    }
};

// Select form entries based on TEST_MODE
const FORM_ENTRIES = process.env.TEST_MODE === 'true' ? TEST_FORM_ENTRIES : PROD_FORM_ENTRIES;

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

// Validation helper functions
function validateDate(dateString) {
    if (!dateString || dateString.trim() === '') {
        return { valid: true, value: '' }; // Empty is valid, will auto-fill
    }

    const datePattern = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{4}$/;
    if (!datePattern.test(dateString)) {
        return { valid: false, error: 'Date must be in MM/DD/YYYY format (e.g., 11/02/2025)' };
    }

    // Validate it's a real date
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return { valid: false, error: 'Invalid date. Please check month/day values.' };
    }

    return { valid: true, value: dateString };
}

function validateTitle(title) {
    const validTitles = ['No', 'Initial', 'Defend', 'Reclaim'];
    const normalized = title.trim();

    // Try case-insensitive match
    const match = validTitles.find(t => t.toLowerCase() === normalized.toLowerCase());
    if (!match) {
        return { valid: false, error: `Title must be one of: ${validTitles.join(', ')}` };
    }

    return { valid: true, value: match }; // Return properly cased value
}

function validateRounds(roundsString, fieldName) {
    const trimmed = roundsString.trim();

    if (!/^\d+$/.test(trimmed)) {
        return { valid: false, error: `${fieldName} must be a number` };
    }

    const rounds = parseInt(trimmed, 10);
    if (rounds < 0 || rounds > 20) {
        return { valid: false, error: `${fieldName} must be between 0 and 20` };
    }

    return { valid: true, value: rounds.toString() };
}

function validatePlayerName(name, fieldName) {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { valid: false, error: `${fieldName} must be at least 2 characters` };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: `${fieldName} must be 100 characters or less` };
    }

    return { valid: true, value: trimmed };
}

function validateBuild(build, fieldName) {
    const trimmed = build.trim();

    if (trimmed.length < 1) {
        return { valid: false, error: `${fieldName} is required` };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: `${fieldName} must be 100 characters or less` };
    }

    return { valid: true, value: trimmed };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportwin')
        .setDescription('Report the result of a match')
        .addUserOption(option =>
            option.setName('winner')
                .setDescription('Select the winner (@mention)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('loser')
                .setDescription('Select the loser (@mention)')
                .setRequired(true)),
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
            // Get winner and loser from command options
            const winnerUser = interaction.options.getUser('winner');
            const loserUser = interaction.options.getUser('loser');

            console.log(`[${timestamp}] Winner: ${winnerUser.tag} (${winnerUser.id})`);
            console.log(`[${timestamp}] Loser: ${loserUser.tag} (${loserUser.id})`);

            // Validate winner and loser are different
            if (winnerUser.id === loserUser.id) {
                return interaction.reply({
                    content: 'Winner and Loser cannot be the same player.',
                    ephemeral: true
                });
            }

            // Look up winner in Roster
            console.log(`[${timestamp}] Looking up winner in Roster...`);
            const winnerRoster = await rosterCache.getUserByUUID(winnerUser.id);

            if (!winnerRoster) {
                return interaction.reply({
                    content: `Winner ${winnerUser} not found in Roster. Please add them to the Roster sheet first.`,
                    ephemeral: true
                });
            }

            if (winnerRoster.leaveStatus && winnerRoster.leaveStatus.trim() !== '') {
                return interaction.reply({
                    content: `Winner ${winnerUser} has left (Leave Status: ${winnerRoster.leaveStatus}). Cannot report matches for inactive players.`,
                    ephemeral: true
                });
            }

            // Look up loser in Roster
            console.log(`[${timestamp}] Looking up loser in Roster...`);
            const loserRoster = await rosterCache.getUserByUUID(loserUser.id);

            if (!loserRoster) {
                return interaction.reply({
                    content: `Loser ${loserUser} not found in Roster. Please add them to the Roster sheet first.`,
                    ephemeral: true
                });
            }

            if (loserRoster.leaveStatus && loserRoster.leaveStatus.trim() !== '') {
                return interaction.reply({
                    content: `Loser ${loserUser} has left (Leave Status: ${loserRoster.leaveStatus}). Cannot report matches for inactive players.`,
                    ephemeral: true
                });
            }

            console.log(`[${timestamp}] Roster validation passed`);
            console.log(`[${timestamp}] Winner Data Name: ${winnerRoster.dataName}`);
            console.log(`[${timestamp}] Loser Data Name: ${loserRoster.dataName}`);

            // Clear any existing session data
            await clearReportData(user.id);

            // Store winner/loser Data Names in Redis
            await setReportData(user.id, {
                winnerName: winnerRoster.dataName,
                loserName: loserRoster.dataName,
                winnerDiscord: winnerUser.tag,
                loserDiscord: loserUser.tag
            });

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
                .setDescription(`**Winner:** ${winnerRoster.dataName} (${winnerUser})\n**Loser:** ${loserRoster.dataName} (${loserUser})\n\n**Step 1/5:** Select the match type:`)
                .setFooter({ text: 'DFC Match Reporting' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            console.log(`[${timestamp}] Match type selection shown to ${user.tag} (${user.id})`);
        } catch (error) {
            console.error(`[${timestamp}] Error in reportwin execute:`, error);
            console.error(`[${timestamp}] Error stack:`, error.stack);
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

                // Get existing data and add match type
                const data = await getReportData(userId);
                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

                data.matchType = matchType;
                await setReportData(userId, data);

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

                // Show modal for builds and date (names already from command args)
                const modal = new ModalBuilder()
                    .setCustomId('reportplayers')
                    .setTitle('Step 5/5: Builds & Date');

                const winnerBuildInput = new TextInputBuilder()
                    .setCustomId('winnerBuild')
                    .setLabel(`Winner Build (${data.winnerClass})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., Wind, Ghost, Hybrid LS, etc.')
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
                    .setLabel('Date (MM/DD/YYYY) - blank = today')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Leave empty to auto-fill today')
                    .setRequired(false)
                    .setMaxLength(10);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(winnerBuildInput),
                    new ActionRowBuilder().addComponents(loserBuildInput),
                    new ActionRowBuilder().addComponents(dateInput)
                );

                await interaction.showModal(modal);
                return true;
            }

            // Handle mirror type toggle buttons
            if (customId.startsWith('mirrortoggle_')) {
                const mirrorType = customId.replace('mirrortoggle_', '');
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

                // Initialize mirrorTypes array if it doesn't exist
                if (!data.mirrorTypes) {
                    data.mirrorTypes = [];
                }

                // Map button ID to form value
                const mirrorTypeMap = {
                    'split': 'Split Server',
                    'single': 'Single Mirror',
                    'dual': 'Dual Mirror'
                };
                const typeValue = mirrorTypeMap[mirrorType];

                // Toggle selection
                const index = data.mirrorTypes.indexOf(typeValue);
                if (index > -1) {
                    data.mirrorTypes.splice(index, 1); // Remove if already selected
                } else {
                    data.mirrorTypes.push(typeValue); // Add if not selected
                }

                await setReportData(userId, data);

                // Update embed to show current selections
                const selectedText = data.mirrorTypes.length > 0
                    ? data.mirrorTypes.join(', ')
                    : 'None';

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🏆 Report Match Result')
                    .setDescription(`✅ Players recorded\n\n**Mirror Type (optional):** Select all that apply, then Continue:\n\nSelected: ${selectedText}`)
                    .setFooter({ text: 'DFC Match Reporting - Step 6/6' })
                    .setTimestamp();

                // Keep same buttons
                const mirrorTypeRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('mirrortoggle_split')
                            .setLabel('Split Server')
                            .setStyle(data.mirrorTypes.includes('Split Server') ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('mirrortoggle_single')
                            .setLabel('Single Mirror')
                            .setStyle(data.mirrorTypes.includes('Single Mirror') ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('mirrortoggle_dual')
                            .setLabel('Dual Mirror')
                            .setStyle(data.mirrorTypes.includes('Dual Mirror') ? ButtonStyle.Success : ButtonStyle.Secondary)
                    );

                const continueRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('reportcontinue')
                            .setLabel('Continue to Match Details')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.update({ embeds: [embed], components: [mirrorTypeRow, continueRow] });
                return true;
            }

            // Handle continue button (Step 5.5 -> Step 6 Modal)
            if (customId === 'reportcontinue') {
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.update({ content: 'Session expired. Please run /reportwin again.', embeds: [], components: [] });
                    return true;
                }

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
            // Handle player details modal (Step 5 -> Button for Step 6)
            if (customId === 'reportplayers') {
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.reply({ content: 'Session expired. Please run /reportwin again.', ephemeral: true });
                    return true;
                }

                // Winner/loser names already validated and stored in Redis from execute() function
                // Now we only need to validate builds and date from the modal
                const validationErrors = [];

                const winnerBuildValidation = validateBuild(interaction.fields.getTextInputValue('winnerBuild'), 'Winner build');
                if (!winnerBuildValidation.valid) validationErrors.push(winnerBuildValidation.error);

                const loserBuildValidation = validateBuild(interaction.fields.getTextInputValue('loserBuild'), 'Loser build');
                if (!loserBuildValidation.valid) validationErrors.push(loserBuildValidation.error);

                const dateValidation = validateDate(interaction.fields.getTextInputValue('duelDate'));
                if (!dateValidation.valid) validationErrors.push(dateValidation.error);

                // If there are validation errors, show them and stop
                if (validationErrors.length > 0) {
                    const errorMessage = 'Validation errors:\n' + validationErrors.map((err, i) => `${i + 1}. ${err}`).join('\n');
                    await interaction.reply({
                        content: errorMessage + '\n\nPlease run `/reportwin` again and correct the errors.',
                        ephemeral: true
                    });
                    await clearReportData(userId);
                    return true;
                }

                // All validation passed, store build and date data
                // Note: winner/loser names are already in Redis as data.winnerName and data.loserName
                // Map them to data.winner and data.loser for consistency with rest of code
                data.winner = data.winnerName;
                data.loser = data.loserName;
                data.winnerBuild = winnerBuildValidation.value;
                data.loserBuild = loserBuildValidation.value;

                // Handle date - auto-populate if empty
                if (!dateValidation.value || dateValidation.value === '') {
                    const today = new Date();
                    data.duelDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
                    console.log(`[${timestamp}] Auto-populated date: ${data.duelDate}`);
                } else {
                    data.duelDate = dateValidation.value;
                }

                await setReportData(userId, data);

                // If mirror match, show mirror type selection; otherwise, just continue button
                if (data.isMirror) {
                    const mirrorTypeRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('mirrortoggle_split')
                                .setLabel('Split Server')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('mirrortoggle_single')
                                .setLabel('Single Mirror')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('mirrortoggle_dual')
                                .setLabel('Dual Mirror')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    const continueRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('reportcontinue')
                                .setLabel('Continue to Match Details')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🏆 Report Match Result')
                        .setDescription(`✅ Players recorded\n\n**Mirror Type (optional):** Select all that apply, then Continue:\n\nSelected: None`)
                        .setFooter({ text: 'DFC Match Reporting - Step 6/6' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], components: [mirrorTypeRow, continueRow], ephemeral: true });
                } else {
                    // Non-mirror match, just show continue button
                    const continueButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('reportcontinue')
                                .setLabel('Continue to Match Details')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🏆 Report Match Result')
                        .setDescription(`✅ Players recorded\n\n**Step 6/6:** Click below to enter match details:`)
                        .setFooter({ text: 'DFC Match Reporting' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], components: [continueButton], ephemeral: true });
                }
                return true;
            }

            // Handle match details modal (Final submission)
            if (customId === 'reportdetails') {
                const data = await getReportData(userId);

                if (!data) {
                    await interaction.reply({ content: 'Session expired. Please run /reportwin again.', ephemeral: true });
                    return true;
                }

                // Validate all inputs
                const validationErrors = [];

                const titleValidation = validateTitle(interaction.fields.getTextInputValue('title'));
                if (!titleValidation.valid) validationErrors.push(titleValidation.error);

                const winsValidation = validateRounds(interaction.fields.getTextInputValue('roundWins'), 'Round Wins');
                if (!winsValidation.valid) validationErrors.push(winsValidation.error);

                const lossesValidation = validateRounds(interaction.fields.getTextInputValue('roundLosses'), 'Round Losses');
                if (!lossesValidation.valid) validationErrors.push(lossesValidation.error);

                // If there are validation errors, show them and stop
                if (validationErrors.length > 0) {
                    const errorMessage = 'Validation errors:\n' + validationErrors.map((err, i) => `${i + 1}. ${err}`).join('\n');
                    await interaction.reply({
                        content: errorMessage + '\n\nPlease click Continue again and correct the errors.',
                        ephemeral: true
                    });
                    return true; // Don't clear data, user can click Continue button again
                }

                // All validation passed, store data
                data.title = titleValidation.value;
                data.roundWins = winsValidation.value;
                data.roundLosses = lossesValidation.value;
                data.notes = interaction.fields.getTextInputValue('notes').trim() || '';

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

                // Look up reporter info from Roster cache
                console.log(`[${timestamp}] Looking up reporter info for UUID: ${userId}`);
                const reporterInfo = await rosterCache.getUserByUUID(userId);

                const reporterDataName = reporterInfo?.dataName || interaction.user.username || 'Unknown';
                const reporterDiscordName = reporterInfo?.discordName || interaction.user.username || 'Unknown';
                const reporterUUID = userId;

                console.log(`[${timestamp}] Reporter info:`, {
                    dataName: reporterDataName,
                    discordName: reporterDiscordName,
                    uuid: reporterUUID,
                    foundInRoster: !!reporterInfo
                });

                // Choose environment based on TEST_MODE
                const formId = testMode ? process.env.TEST_FORM_ID : process.env.PROD_FORM_ID;
                const formUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
                const environment = testMode ? 'TEST' : 'PRODUCTION';

                console.log(`[${timestamp}] ${environment} MODE: Submitting to Google Form...`);
                console.log(`[${timestamp}] Form URL: ${formUrl}`);

                const formData = new URLSearchParams();
                formData.append(FORM_ENTRIES.duelDate, data.duelDate);
                formData.append(FORM_ENTRIES.matchType, data.matchType);
                formData.append(FORM_ENTRIES.title, data.title);
                formData.append(FORM_ENTRIES.roundWins, data.roundWins);
                formData.append(FORM_ENTRIES.roundLosses, data.roundLosses);
                formData.append(FORM_ENTRIES.mirror, data.isMirror ? 'Yes' : 'No');

                // Add mirror types if present (checkbox field - append each value)
                if (data.mirrorTypes && data.mirrorTypes.length > 0) {
                    data.mirrorTypes.forEach(type => {
                        formData.append(FORM_ENTRIES.mirrorType, type);
                    });
                }

                formData.append(FORM_ENTRIES.winner, data.winner);
                formData.append(FORM_ENTRIES.winnerClass, data.winnerClass);
                formData.append(FORM_ENTRIES.winnerBuilds[data.winnerClass], data.winnerBuild);
                formData.append(FORM_ENTRIES.loser, data.loser);
                formData.append(FORM_ENTRIES.loserClass, data.loserClass);
                formData.append(FORM_ENTRIES.loserBuilds[data.loserClass], data.loserBuild);
                if (data.notes) formData.append(FORM_ENTRIES.notes, data.notes);

                // Log form data being submitted (for debugging)
                console.log(`[${timestamp}] Form data being submitted:`, {
                    duelDate: data.duelDate,
                    matchType: data.matchType,
                    title: data.title,
                    roundWins: data.roundWins,
                    roundLosses: data.roundLosses,
                    mirror: data.isMirror ? 'Yes' : 'No',
                    mirrorTypes: data.mirrorTypes || [],
                    winner: data.winner,
                    winnerClass: data.winnerClass,
                    winnerBuild: data.winnerBuild,
                    loser: data.loser,
                    loserClass: data.loserClass,
                    loserBuild: data.loserBuild,
                    notes: data.notes || ''
                });

                try {
                    const formResponse = await fetch(formUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: formData.toString(),
                        redirect: 'manual'
                    });

                    console.log(`[${timestamp}] Form submission status: ${formResponse.status}`);
                    console.log(`[${timestamp}] Form response headers:`, Object.fromEntries(formResponse.headers.entries()));

                    // Try to read response body if available
                    try {
                        const responseText = await formResponse.text();
                        if (responseText) {
                            console.log(`[${timestamp}] Form response body (first 500 chars):`, responseText.substring(0, 500));
                        }
                    } catch (bodyError) {
                        console.log(`[${timestamp}] Could not read response body:`, bodyError.message);
                    }

                    // Check if submission was successful
                    if (formResponse.status !== 302 && formResponse.status !== 200) {
                        console.warn(`[${timestamp}] WARNING: Unexpected form response status ${formResponse.status}. Expected 302 or 200.`);
                    }
                } catch (fetchError) {
                    console.error(`[${timestamp}] ERROR submitting to form:`, fetchError);
                    await interaction.editReply({
                        content: `Failed to submit to form. Error: ${fetchError.message}\n\nCheck console logs for details.`
                    });
                    await clearReportData(userId);
                    return true;
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
                    .setFooter({ text: testMode ? 'TEST MODE - Submitted to test form' : 'Match reported successfully!' });

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
