const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const signupsCache = require('../utils/signupsCache');
const { filterCurrentWeekSignups, getWeekRangeString, isRegistrationOpen } = require('../utils/dfcWeekUtils');
const { getClassEmoji } = require('../utils/emojis');

// Cache for sheet ID to avoid repeated metadata queries
let SIGNUPS_SHEET_ID = null;

/**
 * Get the numeric sheet ID for the "DFC Recent Signups" tab
 * Caches the result to avoid repeated API calls
 */
async function getSignupsSheetId(sheets, auth) {
    if (SIGNUPS_SHEET_ID !== null) {
        return SIGNUPS_SHEET_ID;
    }

    try {
        const spreadsheetId = process.env.TEST_MODE === 'true'
            ? process.env.TEST_SSOT_ID
            : process.env.PROD_SSOT_ID;

        const metadata = await sheets.spreadsheets.get({
            auth,
            spreadsheetId
        });

        const sheet = metadata.data.sheets.find(
            s => s.properties.title === 'DFC Recent Signups'
        );

        if (!sheet) {
            throw new Error('DFC Recent Signups sheet not found');
        }

        SIGNUPS_SHEET_ID = sheet.properties.sheetId;
        console.log(`Cached DFC Recent Signups sheet ID: ${SIGNUPS_SHEET_ID}`);
        return SIGNUPS_SHEET_ID;
    } catch (error) {
        console.error('Error fetching sheet metadata:', error);
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cancelsignup')
        .setDescription('Cancel your recent tournament signup'),

    // Handle button interactions (return true to mark as handled by this command)
    async handleButton(interaction) {
        // CRITICAL: Check if this button is for our command
        if (!interaction.customId.startsWith('cancelsignup_')) {
            return false; // Not our button, let other commands try
        }

        const timestamp = new Date().toISOString();
        const user = interaction.user;

        try {
            // Parse button customId: cancelsignup_delete_{unixTimestamp}
            const parts = interaction.customId.split('_');
            if (parts.length !== 3 || parts[1] !== 'delete') {
                console.error(`[${timestamp}] Invalid customId format: ${interaction.customId}`);
                await interaction.reply({
                    content: '❌ Invalid button interaction. Please try again.',
                    ephemeral: true
                });
                return true;
            }

            const targetTimestamp = parseInt(parts[2]);
            if (isNaN(targetTimestamp)) {
                console.error(`[${timestamp}] Invalid timestamp in customId: ${parts[2]}`);
                await interaction.reply({
                    content: '❌ Invalid signup timestamp. Please try again.',
                    ephemeral: true
                });
                return true;
            }

            console.log(`[${timestamp}] ${user.tag} (${user.id}) canceling signup with timestamp ${targetTimestamp}`);

            await interaction.deferUpdate(); // Show loading state

            const sheets = google.sheets('v4');
            const { createGoogleAuth } = require('../utils/googleAuth');
            const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

            const spreadsheetId = process.env.TEST_MODE === 'true'
                ? process.env.TEST_SSOT_ID
                : process.env.PROD_SSOT_ID;

            // Step 1: Fetch only column A (timestamps) from Google Sheets
            // This is more efficient than fetching all columns A:E
            const response = await sheets.spreadsheets.values.get({
                auth,
                spreadsheetId,
                range: 'DFC Recent Signups!A:A'
            });

            const timestamps = response.data.values || [];

            // Step 2: Find the exact row index by matching timestamp
            const targetDate = new Date(targetTimestamp);
            const rowIndex = timestamps.findIndex(row => {
                if (!row[0]) return false;
                const sheetDate = new Date(row[0]);
                return sheetDate.getTime() === targetTimestamp;
            });

            if (rowIndex === -1) {
                console.log(`[${timestamp}] Signup not found for timestamp ${targetTimestamp}`);
                return interaction.editReply({
                    content: '❌ Signup not found. It may have already been deleted or the data has changed.\n\nUse `/cancelsignup` again to see your current signups.',
                    components: [],
                    embeds: []
                });
            }

            console.log(`[${timestamp}] Found signup at row ${rowIndex + 1} (0-indexed: ${rowIndex})`);

            // Step 3: Get sheet ID for batchUpdate
            const sheetId = await getSignupsSheetId(sheets, auth);

            // Step 4: Delete the row using batchUpdate
            await sheets.spreadsheets.batchUpdate({
                auth,
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex, // 0-indexed
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }
            });

            console.log(`[${timestamp}] Successfully deleted row ${rowIndex + 1} from Google Sheets`);

            // Step 5: Invalidate cache immediately
            await signupsCache.refreshCache();
            console.log(`[${timestamp}] Signup cache refreshed after deletion`);

            // Step 6: Send success message
            await interaction.editReply({
                content: '✅ **Signup canceled successfully!**\n\nYou can sign up again using `/signup` if you change your mind.',
                components: [],
                embeds: []
            });

            console.log(`[${timestamp}] ${user.tag} successfully canceled signup`);

        } catch (error) {
            console.error(`[${timestamp}] Error canceling signup for ${user.tag}:`, error);

            try {
                await interaction.editReply({
                    content: '❌ **Error:** Failed to cancel signup. Please try again or contact a moderator.\n\nIf this issue persists, please DM a moderator.',
                    components: [],
                    embeds: []
                });
            } catch (editError) {
                console.error(`[${timestamp}] Failed to send error message:`, editError);
            }
        }

        return true; // We handled this button
    },

    async execute(interaction, sheets, auth) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

        console.log(`[${timestamp}] Executing cancelsignup command:
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})`);

        try {
            await interaction.deferReply({ ephemeral: true });

            // Step 1: Fetch all signups from cache
            const allSignups = await signupsCache.getCachedData();

            // Step 2: Filter to current week only (Friday 12am ET onwards)
            const currentWeekSignups = filterCurrentWeekSignups(allSignups, true);

            // Step 3: Filter to current user's signups
            const userSignups = currentWeekSignups.filter(row =>
                row[1] && row[1].toLowerCase() === user.username.toLowerCase() // Column B = Discord Handle
            );

            // Step 4: Handle no signups case
            if (userSignups.length === 0) {
                const weekRange = getWeekRangeString();
                console.log(`[${timestamp}] ${user.tag} has no signups for current week (${weekRange})`);
                return interaction.editReply({
                    content: `❌ You don't have any active signups for this week (${weekRange}).\n\nUse \`/signup\` to register for the DFC!`,
                    ephemeral: true
                });
            }

            // Step 5: Check if signup window is closed (Wed/Thu)
            const windowOpen = isRegistrationOpen();
            const weekRange = getWeekRangeString();

            console.log(`[${timestamp}] ${user.tag} has ${userSignups.length} signup(s) for current week (${weekRange}), window ${windowOpen ? 'OPEN' : 'CLOSED'}`);

            // Step 6: Build embed
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B) // Red for deletion
                .setTitle('🗑️ Cancel Your Tournament Signups');

            // Step 7: Add warning if window is closed (Wed/Thu)
            if (!windowOpen) {
                embed.setDescription(
                    `⚠️ **Signup window is closed** - You cannot re-signup this week. Coooley may be building the fightcard now. If you're already added to the card, please DM him directly.\n\n` +
                    `You have **${userSignups.length}** signup${userSignups.length > 1 ? 's' : ''} for this week (${weekRange}).`
                );
            } else {
                embed.setDescription(
                    `You have **${userSignups.length}** signup${userSignups.length > 1 ? 's' : ''} for this week (${weekRange}).`
                );
            }

            embed.setFooter({ text: 'Click a button below to cancel that signup' });

            // Step 8: Add each signup as a field
            userSignups.forEach((signup, index) => {
                const signupTimestamp = new Date(signup[0]).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/New_York'
                });
                const division = signup[2] || 'Unknown';
                const characterClass = signup[3] || 'Unknown';
                const buildType = signup[4] || 'Unknown';

                // Handle class names that may include build type (e.g., "Paladin (Hammerdin)")
                const classNameOnly = characterClass.split(' ')[0];
                const classEmoji = getClassEmoji(classNameOnly);

                embed.addFields({
                    name: `${classEmoji} ${division} - ${characterClass}`,
                    value: `📅 ${signupTimestamp} ET\n🔧 Build: **${buildType}**`,
                    inline: false
                });
            });

            // Step 9: Create cancel buttons (limit to 5 max per Discord ActionRow limit)
            const buttons = new ActionRowBuilder();
            const maxButtons = Math.min(userSignups.length, 5);

            for (let i = 0; i < maxButtons; i++) {
                const signup = userSignups[i];
                const division = signup[2] || 'Unknown';
                const unixTimestamp = new Date(signup[0]).getTime();

                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancelsignup_delete_${unixTimestamp}`)
                        .setLabel(`Cancel ${division}`)
                        .setStyle(ButtonStyle.Danger)
                );
            }

            // Step 10: Send response
            const response = await interaction.editReply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });

            // Step 11: Create button collector with 60-second timeout
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60000 // 60 seconds
            });

            collector.on('end', async () => {
                // Remove buttons when collector expires
                try {
                    await interaction.editReply({
                        embeds: [embed],
                        components: []
                    });
                    console.log(`[${new Date().toISOString()}] Cancel buttons expired for ${user.tag}`);
                } catch (error) {
                    // Interaction may have been deleted, ignore error
                    console.log(`[${new Date().toISOString()}] Could not remove buttons (interaction deleted)`);
                }
            });

            console.log(`[${timestamp}] Cancelsignup command completed successfully for ${user.tag}`);

        } catch (error) {
            const errorMessage = `[${timestamp}] Error executing cancelsignup for ${user.tag}`;
            console.error(errorMessage, error);

            try {
                await interaction.editReply({
                    content: '❌ An error occurred while fetching your signups. Please try again later.\n\nIf this issue persists, please contact a moderator.',
                    ephemeral: true
                });
            } catch (editError) {
                console.error(`[${timestamp}] Failed to send error message:`, editError);
            }
        }
    }
};
