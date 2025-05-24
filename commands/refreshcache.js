const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refreshcache')
    .setDescription('Manually refresh the Duel Data cache')
    .setDefaultMemberPermissions('0'), // Restrict to administrators

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    
    console.log(`[${timestamp}] Manual cache refresh requested by ${user.tag} (${user.id})`);

    // Check if user has @Moderator role
    if (!interaction.member.roles.cache.some(role => role.name === 'Moderator')) {
      return interaction.reply({
        content: '❌ You need the @Moderator role to refresh the cache.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      console.log(`[${timestamp}] Starting manual cache refresh...`);
      
      // Get cache timestamp before refresh
      const oldTimestamp = await duelDataCache.getCacheTimestamp();
      const oldDate = oldTimestamp ? new Date(oldTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      // Refresh the cache
      const data = await duelDataCache.refreshCache();
      
      // Get new cache timestamp
      const newTimestamp = await duelDataCache.getCacheTimestamp();
      const newDate = new Date(newTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Cache Refresh Complete')
        .setDescription('The Duel Data cache has been successfully refreshed.')
        .addFields(
          { name: 'Rows Cached', value: data.length.toString(), inline: true },
          { name: 'Previous Update', value: oldDate, inline: true },
          { name: 'New Update', value: newDate, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Manual Cache Refresh' });

      await interaction.editReply({ embeds: [embed] });
      
      console.log(`[${timestamp}] Manual cache refresh completed successfully by ${user.tag} (${user.id}) - ${data.length} rows cached`);
    } catch (error) {
      console.error(`[${timestamp}] Manual cache refresh failed for ${user.tag} (${user.id}):`, error);
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cache Refresh Failed')
        .setDescription('There was an error refreshing the cache. Please check the logs for details.')
        .addFields({ name: 'Error', value: error.message || 'Unknown error', inline: false })
        .setTimestamp()
        .setFooter({ text: 'Manual Cache Refresh' });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};