/**
 * /signup command - Multi-step wizard for weekly event signups
 *
 * This is a user-friendly multi-step signup flow that uses buttons and modals.
 * Users select match type -> class -> enter build details through an interactive wizard.
 *
 * Usage: /signup (then follow the interactive prompts)
 *
 * Replaced the original argument-based version (backed up as signup-with-initial-args.js.backup)
 * on 2025-11-05
 */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

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
                .setDescription('**Step 1/3:** Please select your match type:\n\n*Note: To sign up for multiple match types, submit a separate entry for each.*')
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

            // Show class selection buttons
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Amazon`)
                        .setLabel('Amazon')
                        .setEmoji(classEmojiIds.Amazon)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Assassin`)
                        .setLabel('Assassin')
                        .setEmoji(classEmojiIds.Assassin)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Barbarian`)
                        .setLabel('Barbarian')
                        .setEmoji(classEmojiIds.Barbarian)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Druid`)
                        .setLabel('Druid')
                        .setEmoji(classEmojiIds.Druid)
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Necromancer`)
                        .setLabel('Necromancer')
                        .setEmoji(classEmojiIds.Necromancer)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Paladin`)
                        .setLabel('Paladin')
                        .setEmoji(classEmojiIds.Paladin)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Sorceress`)
                        .setLabel('Sorceress')
                        .setEmoji(classEmojiIds.Sorceress)
                        .setStyle(ButtonStyle.Secondary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📜 Weekly Event Signup')
                .setDescription(`✅ Match Type: **${matchType}**\n\n**Step 2/3:** Now select your class:`)
                .setFooter({ text: 'DFC Weekly Event Registration' })
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [row1, row2] });
            return true;
        }

        // Handle class selection (Step 2 -> Step 3 Modal)
        if (customId.startsWith('signupclass_')) {
            const parts = customId.replace('signupclass_', '').split('_');
            const matchType = parts[0];
            const chosenClass = parts[1];

            // Show modal for build and notes
            const modal = new ModalBuilder()
                .setCustomId(`signupmodal_${matchType}_${chosenClass}`)
                .setTitle(`Step 3/3: ${matchType} ${chosenClass}`);

            const buildInput = new TextInputBuilder()
                .setCustomId('build')
                .setLabel('Build Type')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., T/V, Wind, Ghost, etc.')
                .setRequired(true)
                .setMaxLength(100);

            const notesInput = new TextInputBuilder()
                .setCustomId('notes')
                .setLabel('Notes (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Additional comments... Do not share sensitive info!')
                .setRequired(false)
                .setMaxLength(500);

            const buildRow = new ActionRowBuilder().addComponents(buildInput);
            const notesRow = new ActionRowBuilder().addComponents(notesInput);

            modal.addComponents(buildRow, notesRow);

            await interaction.showModal(modal);
            return true;
        }

        return false;
    },

    async handleModal(interaction, sheets, auth) {
        const customId = interaction.customId;

        if (customId.startsWith('signupmodal_')) {
            const timestamp = new Date().toISOString();
            const user = interaction.user;

            const parts = customId.replace('signupmodal_', '').split('_');
            const matchType = parts[0];
            const chosenClass = parts[1];
            const chosenBuild = interaction.fields.getTextInputValue('build');
            const notes = interaction.fields.getTextInputValue('notes') || '';
            const discordName = user.username;

            console.log(`[${timestamp}] Processing signup submission:
            User: ${user.tag} (${user.id})
            Match Type: ${matchType}
            Class: ${chosenClass}
            Build: ${chosenBuild}
            Notes: ${notes}`);

            try {
                // Defer reply to prevent timeout
                await interaction.deferReply({ ephemeral: true });

                // Map match type to division format expected by form
                const divisionMap = {
                    'HLD': 'Unlimited (HLD)',
                    'LLD': 'Low Level Dueling (LLD)',
                    'MELEE': 'Melee',
                    'TEAMS': 'Teams'
                };

                // Prepare form data for Google Form submission
                const formData = new URLSearchParams();
                const mappedDivision = divisionMap[matchType] || matchType;

                console.log(`[${timestamp}] TEAMS DEBUG - matchType: "${matchType}", mapped: "${mappedDivision}"`);

                formData.append('entry.2092238618', discordName); // Discord Handle
                formData.append('entry.1556369182', mappedDivision); // Division
                formData.append('entry.479301265', chosenClass); // Class
                formData.append('entry.2132117571', `${chosenBuild}${notes ? ' - ' + notes : ''}`); // Build Type / Notes

                console.log(`[${timestamp}] TEAMS DEBUG - Form data being submitted:`, formData.toString());

                // Submit to Google Form (using Node.js 20+ native fetch)
                const formResponse = await fetch(
                    'https://docs.google.com/forms/d/e/1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/formResponse',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: formData.toString(),
                        redirect: 'manual' // Google Forms redirects on success
                    }
                );

                console.log(`[${timestamp}] Form submission status: ${formResponse.status}`);

                // Create confirmation embed (styled like current signup.js)
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📜 Weekly Event Signup')
                    .addFields(
                        { name: 'Player', value: `**${discordName}**`, inline: true },
                        { name: 'Class', value: `${classEmojis[chosenClass]} **${chosenClass}**`, inline: true },
                        { name: 'Build', value: `**${chosenBuild}**`, inline: true },
                        { name: 'Match Type', value: `${matchTypeEmojis[matchType]} **${matchType}**`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Successfully signed up for the weekly event!' });

                if (notes) {
                    embed.addFields({ name: '📝 Notes', value: notes, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });
                console.log(`[${timestamp}] Signup completed successfully for ${user.tag} (${user.id})`);
            } catch (error) {
                console.error(`[${timestamp}] Error processing signup for ${user.tag} (${user.id}):`, error);

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
