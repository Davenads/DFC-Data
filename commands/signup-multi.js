const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Custom emoji IDs from production Discord server
const classEmojis = {
    Amazon: '<:Amazon:953116506726744094>',
    Assassin: '<:Assassin:953116506697379891>',
    Barbarian: '<:barb:924434081406672977>',
    Druid: '<:Druid:994817312563671050>',
    Necromancer: '<:Necro:994817323653419058>',
    Paladin: '<:Pala:1039258310857195730>',
    Sorceress: '<:sorc:924434081163391058>'
};

const matchTypeEmojis = {
    HLD: '<:HLD:1434535063755952320>',
    LLD: '<:LLD:1434535487481319598>',
    Melee: '<:Melee:1434536096238141501>'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup-multi')
        .setDescription('Sign up for the weekly event (multi-step)'),
    role: 'DFC Dueler',

    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing signup-multi command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);

        try {
            // Step 1: Show match type selection buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('signupmulti_hld')
                        .setLabel('HLD')
                        .setEmoji('1434535063755952320')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('signupmulti_lld')
                        .setLabel('LLD')
                        .setEmoji('1434535487481319598')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('signupmulti_melee')
                        .setLabel('Melee')
                        .setEmoji('1434536096238141501')
                        .setStyle(ButtonStyle.Primary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📜 Weekly Event Signup')
                .setDescription('**Step 1:** Please select your match type:')
                .setFooter({ text: 'DFC Weekly Event Registration' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            console.log(`[${timestamp}] Match type selection shown to ${user.tag} (${user.id})`);
        } catch (error) {
            console.error(`[${timestamp}] Error showing signup-multi to ${user.tag} (${user.id}):`, error);
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
                        .setEmoji('953116506726744094')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Assassin`)
                        .setLabel('Assassin')
                        .setEmoji('953116506697379891')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Barbarian`)
                        .setLabel('Barbarian')
                        .setEmoji('924434081406672977')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Druid`)
                        .setLabel('Druid')
                        .setEmoji('994817312563671050')
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Necromancer`)
                        .setLabel('Necromancer')
                        .setEmoji('994817323653419058')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Paladin`)
                        .setLabel('Paladin')
                        .setEmoji('1039258310857195730')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`signupclass_${matchType}_Sorceress`)
                        .setLabel('Sorceress')
                        .setEmoji('924434081163391058')
                        .setStyle(ButtonStyle.Secondary)
                );

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📜 Weekly Event Signup')
                .setDescription(`✅ Match Type: **${matchType}**\n\n**Step 2:** Now select your class:`)
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
                .setTitle(`${matchType} ${chosenClass} Registration`);

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

            console.log(`[${timestamp}] Processing signup-multi submission:
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
                    'MELEE': 'Melee'
                };

                // Prepare form data for Google Form submission
                const formData = new URLSearchParams();
                formData.append('entry.2092238618', discordName); // Discord Handle
                formData.append('entry.1556369182', divisionMap[matchType] || matchType); // Division
                formData.append('entry.479301265', chosenClass); // Class
                formData.append('entry.2132117571', `${chosenBuild}${notes ? ' - ' + notes : ''}`); // Build Type / Notes

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
                console.log(`[${timestamp}] Signup-multi completed successfully for ${user.tag} (${user.id})`);
            } catch (error) {
                console.error(`[${timestamp}] Error processing signup-multi for ${user.tag} (${user.id}):`, error);

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
