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
 * Sends audit log message to the audit channel
 * @param {Client} client - Discord.js client
 * @param {string} message - Message to log
 */
async function sendAuditLog(client, message) {
  const auditChannelId = process.env.AUDIT_CHANNEL_ID; // Reuse existing audit channel config

  try {
    const auditChannel = client.channels.cache.get(auditChannelId);
    if (auditChannel) {
      await auditChannel.send(message).catch(() => {
        // Silent fail for audit logs - don't let audit logging break notifications
      });
    }
  } catch {
    // Silent fail for audit logs
  }
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
  const FALLBACK_CHANNEL_ID = '733748097913585727'; // Chatroom

  try {
    // Use overrides if provided (for testing), otherwise use production env vars
    const channelId = overrideChannelId || process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD;
    const roleId = overrideRoleId || process.env.DFC_DUELER_ROLE_ID_PROD;

    // Validate required parameters
    if (!channelId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing channel ID`);
      await sendAuditLog(client, `⚠️ **Signup Notification Failed**\nType: ${type}\nReason: Missing channel ID configuration`);
      return;
    }

    if (!roleId) {
      console.warn(`[${timestamp}] [Signup Notifications] Missing role ID`);
      await sendAuditLog(client, `⚠️ **Signup Notification Failed**\nType: ${type}\nReason: Missing role ID configuration`);
      return;
    }

    const isTestMode = overrideChannelId !== null;
    console.log(`[${timestamp}] [Signup Notifications] Sending ${type} notification to channel ${channelId} with role ${roleId} (${isTestMode ? 'TEST' : 'PRODUCTION'})`);

    // Get channel from cache
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      console.warn(`[${timestamp}] [Signup Notifications] Channel ${channelId} not found in cache`);
      await sendAuditLog(client, `⚠️ **Signup Notification Failed**\nType: ${type}\nChannel: ${channelId}\nReason: Channel not found in cache`);
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

    // Prepare notification payload
    const notificationPayload = {
      content: `<@&${roleId}>`, // Mention @DFC Dueler role
      embeds: [embed],
      components: [button]
    };

    // Attempt to send to primary channel
    try {
      await channel.send(notificationPayload);
      console.log(`[${timestamp}] [Signup Notifications] Successfully sent ${type} notification to primary channel ${channelId}`);
      await sendAuditLog(client, `✅ **Signup Notification Sent**\nType: ${type === 'open' ? 'Signups Now Open' : 'Signup Closing Soon'}\nChannel: <#${channelId}>\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
    } catch (err) {
      // Check if error is permission-related
      const isPermissionError = err.message && (
        err.message.includes('Missing Access') ||
        err.message.includes('Missing Permissions') ||
        err.code === 50013 || // Missing Permissions Discord API code
        err.code === 50001    // Missing Access Discord API code
      );

      if (isPermissionError && !isTestMode) {
        // Attempt fallback to Chatroom channel
        console.warn(`[${timestamp}] [Signup Notifications] Permission error in primary channel, attempting fallback to ${FALLBACK_CHANNEL_ID}`);

        const fallbackChannel = client.channels.cache.get(FALLBACK_CHANNEL_ID);

        if (fallbackChannel) {
          try {
            await fallbackChannel.send(notificationPayload);
            console.log(`[${timestamp}] [Signup Notifications] Successfully sent ${type} notification to fallback channel ${FALLBACK_CHANNEL_ID}`);
            await sendAuditLog(client, `⚠️ **Signup Notification Sent to Fallback**\nType: ${type === 'open' ? 'Signups Now Open' : 'Signup Closing Soon'}\nPrimary Channel: <#${channelId}> (Permission Error)\nFallback Channel: <#${FALLBACK_CHANNEL_ID}>\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
          } catch (fallbackErr) {
            console.error(`[${timestamp}] [Signup Notifications] Failed to send ${type} notification to fallback channel:`, fallbackErr.message);
            await sendAuditLog(client, `❌ **Signup Notification Failed (Both Channels)**\nType: ${type}\nPrimary Channel: <#${channelId}> - ${err.message}\nFallback Channel: <#${FALLBACK_CHANNEL_ID}> - ${fallbackErr.message}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
          }
        } else {
          console.error(`[${timestamp}] [Signup Notifications] Fallback channel ${FALLBACK_CHANNEL_ID} not found in cache`);
          await sendAuditLog(client, `❌ **Signup Notification Failed**\nType: ${type}\nPrimary Channel: <#${channelId}> - ${err.message}\nFallback Channel: Not found in cache\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
        }
      } else {
        // Non-permission error or test mode - just log it
        console.error(`[${timestamp}] [Signup Notifications] Failed to send ${type} notification:`, err.message);
        if (!isTestMode) {
          await sendAuditLog(client, `❌ **Signup Notification Failed**\nType: ${type}\nChannel: <#${channelId}>\nError: ${err.message}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
        }
      }
    }

  } catch (error) {
    console.error(`[${timestamp}] [Signup Notifications] Unexpected error in sendNotification:`, error.message);
    await sendAuditLog(client, `❌ **Signup Notification Critical Error**\nType: ${type}\nError: ${error.message}`);
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
