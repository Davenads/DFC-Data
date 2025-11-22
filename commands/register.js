const NodeCache = require('node-cache');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const rosterCache = require('../utils/rosterCache');
const playerListCache = require('../utils/playerListCache');

// Create a cache instance
const cache = new NodeCache({ stdTTL: 300 }); // Cache expires in 300 seconds (5 minutes)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Add your arena name to the DFC roster')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(option =>
            option.setName('dueler_name')
                .setDescription('In-game dueling/arena name')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player to register (optional, defaults to yourself)')
                .setRequired(false)),
    async execute(interaction, sheets, auth) {
        const duelerName = interaction.options.getString('dueler_name');
        const targetUser = interaction.options.getUser('player') || interaction.user;
        const discordName = targetUser.username;
        const userId = targetUser.id;
        const timestamp = new Date().toISOString();
        const commandUser = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing register command:
        Command User: ${commandUser.tag} (${commandUser.id})
        Target User: ${targetUser.tag} (${targetUser.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})
        Dueler Name: ${duelerName}`);

        // Defer reply to prevent "application did not respond" error
        await interaction.deferReply({ ephemeral: true });

        try {
            // Check cached data to verify if the user is already registered
            if (process.env.FORCE_CACHE_REFRESH === 'true') {
                cache.del('uuids'); // Delete the cache to force a refresh if FORCE_CACHE_REFRESH is set
            }
            let cachedUuids = cache.get('uuids');
            if (!cachedUuids) {
                // Use the auth object directly as it's already a JWT client
                const updatedRes = await sheets.spreadsheets.values.get({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: 'Roster!D:D',
                });
                cachedUuids = updatedRes.data.values.flat();
                cache.set('uuids', cachedUuids);
            }
            if (cachedUuids.includes(userId)) {
                const pronoun = targetUser.id === commandUser.id ? 'You are' : 'They are';
                return interaction.editReply({ content: `${pronoun} already registered. Their UUID is already present in our data.` });
            }

            // Use the auth object directly as it's already a JWT client
            
            // Fetch existing roster data to verify if the user is already registered
            const res = await sheets.spreadsheets.values.get({
                auth: auth,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Roster!A:D',
            });

            const roster = res.data.values || [];
            const isRegistered = roster.some(row => row[3] === userId);

            if (isRegistered) {
                const pronoun = targetUser.id === commandUser.id ? 'You are' : 'They are';
                return interaction.editReply({ content: `${pronoun} already registered. Their UUID is already present in our data.` });
            }

            // Find the first available row
            const nextRow = roster.length + 1;

            try {
                // Append new user to the roster with the required columns
                await sheets.spreadsheets.values.update({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: `Roster!A${nextRow}:D${nextRow}`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [[duelerName, duelerName, discordName, userId]],
                    },
                });
            } catch (error) {
                console.error('Error appending new user to Google Sheets:', error);
                return interaction.editReply({ content: 'Failed to register. Please try again later.' });
            }

            try {
                // Re-cache UUID data for /signup command
                const updatedRes = await sheets.spreadsheets.values.get({
                    auth: auth,
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: 'Roster!D:D',
                });
                const uuids = updatedRes.data.values.flat();
                cache.set('uuids', uuids);
            } catch (error) {
                console.error('Error updating cache with new UUID data:', error);
                // Continue, as this is a non-critical failure
            }

            // Asynchronously refresh Redis caches (fire-and-forget)
            Promise.all([
                rosterCache.refreshCache(),
                playerListCache.refreshPlayerListCache()
            ]).then(() => {
                console.log(`[${timestamp}] Cache refreshed successfully after player registration`);
            }).catch(err => {
                console.error(`[${timestamp}] Failed to refresh cache after player registration:`, err.message);
            });

            // Create an embed to confirm successful registration
            const isSelfRegistration = targetUser.id === commandUser.id;
            const embed = new EmbedBuilder()
                .setTitle('🎉 DFC Registration Successful 🎉')
                .setColor('#FF4500') // DFC branded color
                .setDescription(isSelfRegistration
                    ? "✅ You have been successfully added into the DFC roster! 🏆 You can now use signup to join the weekly events."
                    : `✅ <@${targetUser.id}> has been successfully added into the DFC roster! 🏆 They can now use signup to join the weekly events.`)
                .addFields(
                    { name: '🏟️ Arena Name', value: duelerName, inline: true },
                    { name: '👤 Discord Name', value: discordName, inline: true }
                )
                .setFooter({ text: 'Good luck in the arena! ⚔️' });

            await interaction.channel.send({ embeds: [embed] });

            // Delete the deferred reply since we sent the public embed
            await interaction.deleteReply().catch(err => console.error('Failed to delete deferred reply:', err));

            console.log(`[${timestamp}] Registration command completed successfully for ${targetUser.tag} (${targetUser.id}) with dueler name: ${duelerName} (registered by ${commandUser.tag})`);
        } catch (error) {
            const errorMessage = `[${timestamp}] Error during registration for ${targetUser.tag} (${targetUser.id}) by ${commandUser.tag}`;
            console.error(errorMessage, error);
            await interaction.editReply({ content: 'Failed to register. Please try again later.' });
        }
    }
};
