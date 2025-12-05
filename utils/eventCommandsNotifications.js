/**
 * Event Commands Notifications Module
 *
 * Sends automated Discord notification during weekly DFC event:
 * - Thursday 6:05 PM ET: "DFC Live - Useful Commands" embed with relevant commands
 */

const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const { deckardCainEmoji, soundAlphaEmoji } = require('./emojis');

/**
 * Creates the "Event Commands" embed (Thursday 6:05 PM ET)
 * @returns {EmbedBuilder} Blue embed showcasing useful commands during event
 */
function createEventCommandsEmbed() {
  return new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(`${deckardCainEmoji} DFC Live - Useful Commands`)
    .setDescription(
      `The weekly DFC Event is underway! Here are the most useful commands for tracking stats and standings:\n\n` +
      `📊 **Statistics & Rankings:**\n` +
      `• \`/rankings\` - View top 30 players per division\n` +
      `• \`/classrankings\` - Class-specific rankings and win rates\n` +
      `• \`/dueltrends\` - Analyze duel trends and statistics\n` +
      `• \`/stats\` - View player stats (with options)\n\n` +
      `🎯 **Event Information:**\n` +
      `• \`/fightcard\` - View current matchups\n` +
      `• \`/recentsignups\` - See who signed up recently\n\n` +
      `📖 **Rules & Updates:**\n` +
      `• \`/rules\` - Review tournament rules (with options)\n` +
      `• \`/changelog\` - Check recent rule changes\n\n` +
      `Good luck to all duelers! ⚔️`
    )
    .addFields({
      name: '\u200B', // Zero-width space for blank name
      value: `${soundAlphaEmoji} View [interactive leaderboards by Sound](https://lookerstudio.google.com/reporting/f0aef56a-571d-4216-9b70-ea44614f10eb/page/p_omb02u6xvd)`
    })
    .setFooter({ text: 'DFC Event Commands' })
    .setTimestamp();
}

/**
 * Sends event commands notification to the appropriate channel
 * @param {Client} client - Discord.js client
 * @param {string} overrideChannelId - Optional channel ID override (for testing)
 */
async function sendEventCommandsNotification(client, overrideChannelId = null) {
  const timestamp = new Date().toISOString();

  try {
    // Use override if provided (for testing), otherwise use production env var
    // Falls back to SIGNUP_NOTIFICATION_CHANNEL_PROD if DFC_CHAT_CHANNEL_PROD not set
    const channelId = overrideChannelId || process.env.DFC_CHAT_CHANNEL_PROD || process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD;

    // Validate required parameter
    if (!channelId) {
      console.warn(`[${timestamp}] [Event Commands Notifications] Missing channel ID`);
      return;
    }

    const isTestMode = overrideChannelId !== null;
    console.log(`[${timestamp}] [Event Commands Notifications] Sending notification to channel ${channelId} (${isTestMode ? 'TEST' : 'PRODUCTION'})`);

    // Get channel from cache
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      console.warn(`[${timestamp}] [Event Commands Notifications] Channel ${channelId} not found in cache`);
      return;
    }

    // Create embed
    const embed = createEventCommandsEmbed();

    // Send notification (non-blocking with error handling)
    channel.send({
      embeds: [embed]
    }).catch(err => {
      console.error(`[${timestamp}] [Event Commands Notifications] Failed to send notification:`, err.message);
    });

  } catch (error) {
    console.error(`[${timestamp}] [Event Commands Notifications] Unexpected error in sendEventCommandsNotification:`, error.message);
  }
}

/**
 * Schedules event commands notification cron job
 * @param {Client} client - Discord.js client
 */
function scheduleEventCommandsNotification(client) {
  // Thursday 6:05 PM ET - "DFC Live - Useful Commands"
  cron.schedule('5 18 * * 4', async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Event Commands Notifications] Triggering "DFC Live - Useful Commands" notification (Thursday 6:05pm ET)...`);
    await sendEventCommandsNotification(client);
  }, {
    timezone: "America/New_York"
  });
}

module.exports = {
  scheduleEventCommandsNotification,
  sendEventCommandsNotification // Exported for test command
};
