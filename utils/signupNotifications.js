/**
 * Signup Notifications Module
 *
 * Sends automated Discord notifications for DFC tournament signup windows:
 * - Friday 12:00 AM ET: "Signups Now Open"
 * - Tuesday 5:00 PM ET: "Signup Closing Soon"
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cron = require('node-cron');
const { deckardCainEmoji } = require('./emojis');

/**
 * Creates the "Signups Now Open" embed (Friday 12:00 AM ET)
 * @returns {EmbedBuilder} Green embed announcing signup window opening
 */
function createSignupOpenEmbed() {
  return new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle(`${deckardCainEmoji} DFC Event Signups Now Open!`)
    .setDescription(
      `The weekly DFC Event signup window is now open!\n\n` +
      `Click the **Start Signup** button below or type \`/signup\` to register.\n\n` +
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
    .setTitle(`${deckardCainEmoji} DFC Event Signups Closing Soon!`)
    .setDescription(
      `⚠️ **Last chance to sign up for this week's event!**\n\n` +
      `Signups close in **6 hours** at **11:00 PM ET tonight**.\n\n` +
      `Click the **Start Signup** button below or type \`/signup\` now!\n\n` +
      `Don't miss out on this week's action! ⚔️`
    )
    .setFooter({ text: 'DFC Signup Notifications' })
    .setTimestamp();
}

/**
 * Creates the action row with Start Signup button
 * @returns {ActionRowBuilder} Action row containing signup button
 */
function createSignupButton() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('notification_startsignup')
        .setLabel('Start Signup')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Success)
    );
}

/**
 * Sends signup notification to the appropriate channel
 * @param {Client} client - Discord.js client
 * @param {string} type - Notification type: 'open' or 'closing'
 * @param {string} overrideChannelId - Optional channel ID override (for testing)
 * @param {string} overrideRoleId - Optional role ID override (for testing)
 */
async function sendNotification(client, type, overrideChannelId = null, overrideRoleId = null) {
  const timestamp = new Date().toISOString();

  try {
    // Use overrides if provided (for testing), otherwise use production env vars
    const channelId = overrideChannelId || process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD;
    const roleId = overrideRoleId || process.env.DFC_DUELER_ROLE_ID_PROD;

    // Validate required parameters
    if (!channelId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing channel ID`);
      return;
    }

    if (!roleId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing role ID`);
      return;
    }

    const isTestMode = overrideChannelId !== null;
    console.log(`[${timestamp}] [Signup Notifications] Sending ${type} notification to channel ${channelId} with role ${roleId} (${isTestMode ? 'TEST' : 'PRODUCTION'})`);

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

    // Create signup button
    const button = createSignupButton();

    // Send notification (non-blocking with error handling)
    channel.send({
      content: `<@&${roleId}>`, // Mention @DFC Dueler role
      embeds: [embed],
      components: [button]
    }).catch(err => {
      console.error(`[${timestamp}] [Signup Notifications] Failed to send ${type} notification:`, err.message);
    });

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
