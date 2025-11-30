/**
 * Signup Notifications Module
 *
 * Sends automated Discord notifications for DFC tournament signup windows:
 * - Friday 12:00 AM ET: "Signups Now Open"
 * - Tuesday 5:00 PM ET: "Signup Closing Soon"
 */

const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');

/**
 * Creates the "Signups Now Open" embed (Friday 12:00 AM ET)
 * @returns {EmbedBuilder} Green embed announcing signup window opening
 */
function createSignupOpenEmbed() {
  return new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('🎮 Tournament Signups Now Open!')
    .setDescription(
      `The weekly DFC tournament signup window is now open!\n\n` +
      `Use \`/signup\` to register for this week's tournament.\n\n` +
      `📅 **Signup Window Schedule:**\n` +
      `• **Opens:** Friday 12:00 AM ET\n` +
      `• **Closes:** Tuesday 11:00 PM ET\n\n` +
      `Good luck, and may the best dueler win! 🏆`
    )
    .setFooter({ text: 'DFC Signup Notifications' })
    .setTimestamp();
}

/**
 * Creates the "Signup Closing Soon" embed (Tuesday 5:00 PM ET)
 * @returns {EmbedBuilder} Orange embed warning signup window closing soon
 */
function createSignupClosingEmbed() {
  return new EmbedBuilder()
    .setColor(0xFF6600) // Orange
    .setTitle('⏰ Signups Closing Soon!')
    .setDescription(
      `⚠️ **Last chance to sign up for this week's tournament!**\n\n` +
      `Signups close in **6 hours** at **11:00 PM ET tonight**.\n\n` +
      `Use \`/signup\` now if you haven't already registered!\n\n` +
      `Don't miss out on this week's action! ⚔️`
    )
    .setFooter({ text: 'DFC Signup Notifications' })
    .setTimestamp();
}

/**
 * Sends signup notification to the appropriate channel
 * @param {Client} client - Discord.js client
 * @param {string} type - Notification type: 'open' or 'closing'
 * @param {string} overrideChannelId - Optional channel ID to override environment-based selection (for testing)
 */
async function sendNotification(client, type, overrideChannelId = null) {
  const timestamp = new Date().toISOString();

  try {
    // Determine which environment we're in
    const isTestMode = process.env.TEST_MODE === 'true';

    // Select channel ID (use override if provided, otherwise environment-based)
    const channelId = overrideChannelId || (isTestMode
      ? process.env.SIGNUP_NOTIFICATION_CHANNEL_TEST
      : process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD);

    // Select role ID based on environment
    const roleId = isTestMode
      ? process.env.DFC_DUELER_ROLE_ID_TEST
      : process.env.DFC_DUELER_ROLE_ID_PROD;

    // Validate environment variables
    if (!channelId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing channel ID for ${isTestMode ? 'TEST' : 'PRODUCTION'} environment`);
      return;
    }

    if (!roleId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing role ID for ${isTestMode ? 'TEST' : 'PRODUCTION'} environment`);
      return;
    }

    // Get channel from cache
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      console.warn(`[${timestamp}] [Signup Notifications] Channel ${channelId} not found in cache`);
      return;
    }

    // Create appropriate embed based on type
    let embed;
    if (type === 'open') {
      embed = createSignupOpenEmbed();
    } else if (type === 'closing') {
      embed = createSignupClosingEmbed();
    } else {
      console.error(`[${timestamp}] [Signup Notifications] Invalid notification type: ${type}`);
      return;
    }

    // Send notification (non-blocking with error handling)
    channel.send({
      content: `<@&${roleId}>`, // Mention @DFC Dueler role
      embeds: [embed]
    }).catch(err => {
      console.error(`[${timestamp}] [Signup Notifications] Failed to send ${type} notification:`, err.message);
    });

    console.log(`[${timestamp}] [Signup Notifications] Sent "${type}" notification to channel ${channelId} (${isTestMode ? 'TEST' : 'PRODUCTION'})`);

  } catch (error) {
    console.error(`[${timestamp}] [Signup Notifications] Unexpected error in sendNotification:`, error.message);
  }
}

/**
 * Schedules signup notification cron jobs
 * @param {Client} client - Discord.js client
 */
function scheduleSignupNotifications(client) {
  // Friday 12:00 AM ET - "Signups Now Open"
  cron.schedule('0 0 * * 5', async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Signup Notifications] Triggering "Signups Now Open" notification (Friday 12:00am ET)...`);
    await sendNotification(client, 'open');
  }, {
    timezone: "America/New_York"
  });

  // Tuesday 5:00 PM ET - "Signup Closing Soon"
  cron.schedule('0 17 * * 2', async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Signup Notifications] Triggering "Signup Closing Soon" notification (Tuesday 5:00pm ET)...`);
    await sendNotification(client, 'closing');
  }, {
    timezone: "America/New_York"
  });
}

module.exports = {
  scheduleSignupNotifications,
  sendNotification // Exported for test command
};
