const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getSignupData, setSignupData, clearSignupData } = require('../utils/signupCache');

// Custom emoji IDs from production Discord server
const classEmojis = {
    Amazon: '<:Amazon:953116506726744094>',
    Assassin: '<:Assassin:953116506697379891>',
    Barbarian: '<:barb:924434081406672977>',
    Druid: '<:Druid:953116506839973928>',
    Necromancer: '<:Necro:953116507058085918>',
    Paladin: '<:Pala:1039258310857195730>',
    Sorceress: '<:sorc:924434081163391058>'
};

// Extract emoji IDs for button usage
const classEmojiIds = Object.fromEntries(
    Object.entries(classEmojis).map(([className, emojiString]) => {
        const match = emojiString.match(/:(\d+)>/);
        return [className, match ? match[1] : null];
    })
);

const matchTypeEmojis = {
    HLD: '<:HLD:1434535063755952320>',
    LLD: '<:LLD:1434535487481319598>',
    MELEE: '<:Melee:1434536096238141501>',
    TEAMS: '👥' // Using generic emoji until custom emoji is available
};

/**
 * Check if registration is currently open based on the weekly schedule
 * Registration opens: Friday 12am ET
 * Registration closes: Tuesday 11pm ET (23:00)
 * @returns {boolean} True if registration is open, false otherwise
 */
function isRegistrationOpen() {
    // Get current time in ET timezone
    const etTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const now = new Date(etTime);
    const day = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = now.getHours();

    // Registration is open from Friday 00:00 through Tuesday 22:59:59
    // Friday = 5, Saturday = 6, Sunday = 0, Monday = 1, Tuesday = 2
    // Closed: Wednesday = 3, Thursday = 4

    if (day === 3 || day === 4) {
        // Wednesday or Thursday - closed
        return false;
    }

    if (day === 2 && hour >= 23) {
        // Tuesday at or after 11pm - closed
        return false;
    }

    // Friday (all day), Saturday, Sunday, Monday, Tuesday (before 11pm) - open
    return true;
}

/**
 * Update class selection screen with toggle buttons
 * @param {Interaction} interaction - Discord interaction
 * @param {string} matchType - Selected match type (HLD, LLD, etc.)
 * @param {Array<string>} selectedClasses - Currently selected classes
 */
async function updateClassSelectionScreen(interaction, matchType, selectedClasses) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Amazon`)
                .setLabel('Amazon')
                .setEmoji(classEmojiIds.Amazon)
                .setStyle(selectedClasses.includes('Amazon') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Assassin`)
                .setLabel('Assassin')
                .setEmoji(classEmojiIds.Assassin)
                .setStyle(selectedClasses.includes('Assassin') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Barbarian`)
                .setLabel('Barbarian')
                .setEmoji(classEmojiIds.Barbarian)
                .setStyle(selectedClasses.includes('Barbarian') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Druid`)
                .setLabel('Druid')
                .setEmoji(classEmojiIds.Druid)
                .setStyle(selectedClasses.includes('Druid') ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Necromancer`)
                .setLabel('Necromancer')
                .setEmoji(classEmojiIds.Necromancer)
                .setStyle(selectedClasses.includes('Necromancer') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Paladin`)
                .setLabel('Paladin')
                .setEmoji(classEmojiIds.Paladin)
                .setStyle(selectedClasses.includes('Paladin') ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`signupclass_${matchType}_Sorceress`)
                .setLabel('Sorceress')
                .setEmoji(classEmojiIds.Sorceress)
                .setStyle(selectedClasses.includes('Sorceress') ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('signupcontinue')
                .setLabel('Continue')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(selectedClasses.length === 0)
        );

    const selectionText = selectedClasses.length > 0
        ? `**Selected (${selectedClasses.length}):** ${selectedClasses.join(', ')}`
        : '**Selected:** None';

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📜 Weekly Event Signup')
        .setDescription(`✅ Division: **${matchType}**\n\n**Step 2:** Select your classes (click to toggle):\n\n${selectionText}\n\n*Click Continue when ready*`)
        .setFooter({ text: 'DFC Weekly Event Registration' })
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
}

/**
 * Show build entry modal(s) based on class count
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} data - Session data
 * @param {number} modalNumber - Which modal to show (1 or 2)
 */
async function showBuildModal(interaction, data, modalNumber) {
    const classesPerModal = 4;
    const startIdx = (modalNumber - 1) * classesPerModal;
    const endIdx = Math.min(startIdx + classesPerModal, data.selectedClasses.length);
    const classesInThisModal = data.selectedClasses.slice(startIdx, endIdx);
    const totalModals = Math.ceil(data.selectedClasses.length / classesPerModal);
    const isLastModal = endIdx === data.selectedClasses.length;

    const modalTitle = totalModals > 1
        ? `${data.division} Signup - Builds (${modalNumber} of ${totalModals})`
        : `${data.division} Signup - Enter Builds`;

    const modal = new ModalBuilder()
        .setCustomId(`signupmodal_${modalNumber}`)
        .setTitle(modalTitle);

    // Add build fields for classes in this modal
    for (const className of classesInThisModal) {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`build_${className}`)
                    .setLabel(`${className} Build`)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(true)
                    .setPlaceholder(`Enter ${className} build type`)
            )
        );
    }

    // Add notes field only in final modal
    if (isLastModal) {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('notes')
                    .setLabel('Notes (Optional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(500)
                    .setRequired(false)
                    .setPlaceholder('Additional comments... Do not share sensitive info!')
            )
        );
    }

    await interaction.showModal(modal);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Sign up for the weekly event'),
    role: 'DFC Dueler',

    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing signup command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);

        // Check if registration is currently open
        if (!isRegistrationOpen()) {
            const closedEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('📜 Registration Closed')
                .setDescription('Registration is currently closed.\n\n**Registration Window:**\nOpens: Friday 12:00 AM ET\nCloses: Tuesday 11:00 PM ET')
                .setFooter({ text: 'DFC Weekly Event Registration' })
                .setTimestamp();

            console.log(`[${timestamp}] Registration closed - informed ${user.tag} (${user.id})`);
            await interaction.reply({ embeds: [closedEmbed], ephemeral: true });
            return;
        }

        try {
            // Step 1: Show match type selection buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('signupmulti_hld')
                        .setLabel('HLD')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('signupmulti_lld')
                        .setLabel('LLD')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('signupmulti_melee')
                        .setLabel('Melee')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('signupmulti_teams')
                        .setLabel('Teams')
                        .setStyle(ButtonStyle.Primary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📜 Weekly Event Signup')
                .setDescription('**Step 1:** Select your division:\n\n*Note: You can select multiple classes for this division. To sign up for additional divisions, run /signup again.*')
                .setFooter({ text: 'DFC Weekly Event Registration' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            console.log(`[${timestamp}] Match type selection shown to ${user.tag} (${user.id})`);
        } catch (error) {
            console.error(`[${timestamp}] Error showing signup to ${user.tag} (${user.id}):`, error);
            await interaction.reply({ content: 'Failed to start signup. Please try again later.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        const customId = interaction.customId;

        // Handle match type selection (Step 1 -> Step 2)
        if (customId.startsWith('signupmulti_')) {
            const matchType = customId.replace('signupmulti_', '').toUpperCase();

            // Initialize session data
            const sessionData = {
                userId: interaction.user.id,
                division: matchType,
                selectedClasses: [],
                builds: {},
                notes: ''
            };
            await setSignupData(interaction.user.id, sessionData);

            // Show class selection with toggle buttons
            await updateClassSelectionScreen(interaction, matchType, []);
            return true;
        }

        // Handle class toggle selection
        if (customId.startsWith('signupclass_')) {
            const parts = customId.replace('signupclass_', '').split('_');
            const matchType = parts[0];
            const clickedClass = parts[1];

            // Get current session data
            let data = await getSignupData(interaction.user.id);
            if (!data) {
                await interaction.reply({ content: 'Session expired. Please run /signup again.', ephemeral: true });
                return true;
            }

            // Toggle class selection
            const index = data.selectedClasses.indexOf(clickedClass);
            if (index > -1) {
                data.selectedClasses.splice(index, 1); // Remove
            } else {
                data.selectedClasses.push(clickedClass); // Add
            }

            // Save updated selection
            await setSignupData(interaction.user.id, data);

            // Update screen with new selections
            await updateClassSelectionScreen(interaction, matchType, data.selectedClasses);
            return true;
        }

        // Handle Continue button (after class selection)
        if (customId.startsWith('signupcontinue_')) {
            const data = await getSignupData(interaction.user.id);

            if (!data || data.selectedClasses.length === 0) {
                await interaction.reply({ content: 'Please select at least one class before continuing.', ephemeral: true });
                return true;
            }

            // Check if warning needed (5+ classes)
            if (data.selectedClasses.length >= 5) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ Multiple Forms Required')
                    .setDescription(`You selected **${data.selectedClasses.length} classes**. You'll need to complete **2 forms** to enter all build details.\n\n**Selected Classes:**\n${data.selectedClasses.join(', ')}`)
                    .setFooter({ text: 'DFC Weekly Event Registration' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('signupproceed')
                            .setLabel('Continue Anyway')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`signupback_${data.division}`)
                            .setLabel('Go Back')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.update({ embeds: [embed], components: [row] });
                return true;
            }

            // 1-4 classes: Show modal directly
            await showBuildModal(interaction, data, 1);
            return true;
        }

        // Handle "Continue Anyway" from warning
        if (customId === 'signupproceed') {
            const data = await getSignupData(interaction.user.id);
            if (!data) {
                await interaction.reply({ content: 'Session expired. Please run /signup again.', ephemeral: true });
                return true;
            }

            await showBuildModal(interaction, data, 1);
            return true;
        }

        // Handle "Go Back" from warning
        if (customId.startsWith('signupback_')) {
            const matchType = customId.replace('signupback_', '');
            const data = await getSignupData(interaction.user.id);

            if (!data) {
                await interaction.reply({ content: 'Session expired. Please run /signup again.', ephemeral: true });
                return true;
            }

            // Show class selection screen again
            await updateClassSelectionScreen(interaction, matchType, data.selectedClasses);
            return true;
        }

        return false;
    },

    async handleModal(interaction, sheets, auth) {
        const customId = interaction.customId;

        if (customId.startsWith('signupmodal_')) {
            const timestamp = new Date().toISOString();
            const user = interaction.user;
            const modalNumber = parseInt(customId.replace('signupmodal_', ''));

            // Get session data
            let data = await getSignupData(interaction.user.id);
            if (!data) {
                await interaction.reply({ content: 'Session expired. Please run /signup again.', ephemeral: true });
                return true;
            }

            // Extract build values from this modal
            const classesPerModal = 4;
            const startIdx = (modalNumber - 1) * classesPerModal;
            const endIdx = Math.min(startIdx + classesPerModal, data.selectedClasses.length);
            const classesInThisModal = data.selectedClasses.slice(startIdx, endIdx);

            for (const className of classesInThisModal) {
                const buildValue = interaction.fields.getTextInputValue(`build_${className}`);
                data.builds[className] = buildValue;
            }

            // Check if this is the last modal
            const isLastModal = endIdx === data.selectedClasses.length;

            if (!isLastModal) {
                // More classes to process - save progress and show next modal
                await setSignupData(interaction.user.id, data);
                await interaction.deferUpdate();

                // Show next modal
                await showBuildModal(interaction, data, modalNumber + 1);
                return true;
            }

            // Last modal - extract notes and submit
            try {
                data.notes = interaction.fields.getTextInputValue('notes') || '';
            } catch {
                data.notes = '';
            }

            console.log(`[${timestamp}] Processing multi-class signup submission:
            User: ${user.tag} (${user.id})
            Division: ${data.division}
            Classes: ${data.selectedClasses.join(', ')}
            Builds: ${JSON.stringify(data.builds)}
            Notes: ${data.notes}`);

            try {
                // Defer reply to prevent timeout
                await interaction.deferReply({ ephemeral: true });

                // Construct class string: "Amazon, Necromancer, Paladin"
                const classString = data.selectedClasses.join(', ');

                // Construct build string: "Amazon - Java, Necro - Bone, Pala - Hammerdin / notes"
                const buildPairs = data.selectedClasses.map(cls => `${cls} - ${data.builds[cls]}`);
                const buildString = buildPairs.join(', ');
                const finalBuildString = data.notes ? `${buildString} / ${data.notes}` : buildString;

                // Map division to Google Form format
                const divisionMap = {
                    'HLD': 'Unlimited (HLD)',
                    'LLD': 'Low Level Dueling (LLD)',
                    'MELEE': 'Melee',
                    'TEAMS': 'Teams'
                };

                const mappedDivision = divisionMap[data.division] || data.division;

                // Prepare form data
                const formData = new URLSearchParams();
                formData.append('entry.2092238618', user.username); // Discord Handle
                formData.append('entry.1556369182', mappedDivision); // Division
                formData.append('entry.479301265', classString); // Class (multi-class string)
                formData.append('entry.2132117571', finalBuildString); // Build Type / Notes (formatted)

                console.log(`[${timestamp}] Submitting multi-class signup:
                Discord: ${user.username}
                Division: ${mappedDivision}
                Classes: ${classString}
                Builds: ${finalBuildString}`);

                // Submit to Google Form
                const formResponse = await fetch(
                    'https://docs.google.com/forms/d/e/1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/formResponse',
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

                // Create confirmation embed
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('✅ Signup Successful!')
                    .setDescription(`You've signed up for **${data.division}** with the following classes:`)
                    .setTimestamp()
                    .setFooter({ text: 'DFC Weekly Event Registration' });

                // Add field for each class
                for (const className of data.selectedClasses) {
                    embed.addFields({
                        name: `${classEmojis[className]} ${className}`,
                        value: `Build: **${data.builds[className]}**`,
                        inline: true
                    });
                }

                // Add notes if present
                if (data.notes) {
                    embed.addFields({ name: '📝 Notes', value: data.notes, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });

                // Clear session data
                await clearSignupData(interaction.user.id);

                console.log(`[${timestamp}] Multi-class signup completed successfully for ${user.tag} (${user.id})`);
            } catch (error) {
                console.error(`[${timestamp}] Error processing multi-class signup for ${user.tag} (${user.id}):`, error);

                if (interaction.deferred) {
                    await interaction.editReply({ content: 'Failed to sign you up. Please try again later.' });
                } else {
                    await interaction.reply({ content: 'Failed to sign you up. Please try again later.', ephemeral: true });
                }
            }

            return true;
        }

        return false;
    }
};
