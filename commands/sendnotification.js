const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { sendNotification } = require('../utils/signupNotifications');
const { sendEventCommandsNotification } = require('../utils/eventCommandsNotifications');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendnotification')
    .setDescription('Manually send a notification to DFC-Chat (Moderator only)')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Which notification to send')
        .setRequired(true)
        .addChoices(
          { name: 'Signups Now Open (Friday)', value: 'open' },
          { name: 'Signup Closing Soon (Tuesday)', value: 'closing' },
          { name: 'Event Commands (Thursday)', value: 'eventcommands' }
        )
    )
    .setDefaultMemberPermissions('0'), // Restrict to administrators

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const notificationType = interaction.options.getString('type');

    console.log(`[${timestamp}] Manual notification send requested by ${user.tag} (${user.id}) - type: ${notificationType}`);

    // Check if user has @Moderator role (fetch fresh without cache)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.some(role => role.name === 'Moderator')) {
      return interaction.reply({
        content: '❌ You need the @Moderator role to send notifications.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Production channel and role IDs
      const prodChannelId = process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD;
      const prodRoleId = process.env.DFC_DUELER_ROLE_ID_PROD;
      const auditChannelId = process.env.AUDIT_CHANNEL_ID;

      // Validate channel exists
      if (!prodChannelId) {
        throw new Error('SIGNUP_NOTIFICATION_CHANNEL_PROD not configured');
      }

      const targetChannel = interaction.client.channels.cache.get(prodChannelId);
      if (!targetChannel) {
        throw new Error(`Channel ${prodChannelId} not found in cache`);
      }

      // Check bot permissions
      const botPermissions = targetChannel.permissionsFor(interaction.client.user);
      if (!botPermissions || !botPermissions.has('SendMessages')) {
        throw new Error(`Bot lacks SEND_MESSAGES permission in channel ${prodChannelId}`);
      }

      // Send appropriate notification type
      let notificationLabel;
      if (notificationType === 'eventcommands') {
        await sendEventCommandsNotification(interaction.client, prodChannelId);
        notificationLabel = 'Event Commands (Thursday)';
      } else {
        if (!prodRoleId) {
          throw new Error('DFC_DUELER_ROLE_ID_PROD not configured');
        }
        await sendNotification(interaction.client, notificationType, prodChannelId, prodRoleId);
        notificationLabel = notificationType === 'open'
          ? 'Signups Now Open (Friday)'
          : 'Signup Closing Soon (Tuesday)';
      }

      // Format timestamp for display
      const displayTimestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Send success confirmation to user
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Notification Sent Successfully!')
        .addFields(
          { name: 'Type', value: notificationLabel, inline: true },
          { name: 'Channel', value: `<#${prodChannelId}>`, inline: true },
          { name: 'Role Mentioned', value: notificationType === 'eventcommands' ? 'None' : `<@&${prodRoleId}>`, inline: true },
          { name: 'Triggered', value: displayTimestamp, inline: false }
        )
        .setFooter({ text: 'Manual Notification Send' })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // Log to audit channel
      if (auditChannelId) {
        const auditChannel = interaction.client.channels.cache.get(auditChannelId);
        if (auditChannel) {
          const auditEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🔔 Manual Notification Sent')
            .addFields(
              { name: 'Type', value: notificationLabel, inline: true },
              { name: 'Channel', value: `<#${prodChannelId}>`, inline: true },
              { name: 'Triggered By', value: `${user.tag} (${user.id})`, inline: false },
              { name: 'Timestamp', value: displayTimestamp, inline: false }
            )
            .setTimestamp();

          auditChannel.send({ embeds: [auditEmbed] }).catch(err => {
            console.error(`[${timestamp}] Failed to send audit log:`, err.message);
          });
        }
      }

      console.log(`[${timestamp}] Manual notification (${notificationType}) sent successfully by ${user.tag} to channel ${prodChannelId}`);

    } catch (error) {
      console.error(`[${timestamp}] Manual notification send failed for ${user.tag}:`, error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Failed to Send Notification')
        .setDescription('There was an error sending the notification. Please check the logs for details.')
        .addFields({ name: 'Error', value: error.message || 'Unknown error', inline: false })
        .setTimestamp()
        .setFooter({ text: 'Manual Notification Send' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
