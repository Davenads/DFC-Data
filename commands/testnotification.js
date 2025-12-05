const { SlashCommandBuilder } = require('discord.js');
const { sendNotification } = require('../utils/signupNotifications');
const { sendEventCommandsNotification } = require('../utils/eventCommandsNotifications');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testnotification')
    .setDescription('Test signup notification embeds (Moderator only)')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Which notification to test')
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

    console.log(`[${timestamp}] Test notification requested by ${user.tag} (${user.id}) - type: ${notificationType}`);

    // Check if user has @Moderator role (fetch fresh without cache)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.some(role => role.name === 'Moderator')) {
      return interaction.reply({
        content: '❌ You need the @Moderator role to use this test command.',
        ephemeral: true
      });
    }

    // Check if command is invoked in test server
    const testGuildId = process.env.GUILD_ID;
    if (interaction.guildId !== testGuildId) {
      return interaction.reply({
        content: '❌ This test command is only available in the test server.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Test environment IDs (hardcoded for test command)
      const testChannelId = '1442946150523998209';
      const testRoleId = '1299781198205419528';

      // Handle different notification types
      if (notificationType === 'eventcommands') {
        // Send event commands notification (no role mention needed)
        await sendEventCommandsNotification(interaction.client, testChannelId);

        await interaction.editReply({
          content: `✅ Test notification sent!\n\n**Type:** Event Commands (Thursday)\n**Channel:** <#${testChannelId}>\n\nCheck the test channel to verify the embed.`
        });
      } else {
        // Send signup notification to test channel with test role
        await sendNotification(interaction.client, notificationType, testChannelId, testRoleId);

        // Get notification type label for confirmation message
        const notificationLabel = notificationType === 'open'
          ? 'Signups Now Open (Friday)'
          : 'Signup Closing Soon (Tuesday)';

        await interaction.editReply({
          content: `✅ Test notification sent!\n\n**Type:** ${notificationLabel}\n**Channel:** <#${testChannelId}>\n**Role:** <@&${testRoleId}>\n\nCheck the test channel to verify the embed.`
        });
      }

      console.log(`[${timestamp}] Test notification (${notificationType}) sent successfully by ${user.tag}`);

    } catch (error) {
      console.error(`[${timestamp}] Test notification failed for ${user.tag}:`, error);

      await interaction.editReply({
        content: `❌ Failed to send test notification.\n\n**Error:** ${error.message}\n\nPlease check the logs for details.`
      });
    }
  },
};
