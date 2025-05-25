const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');
const playerListCache = require('../utils/playerListCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refreshcache')
    .setDescription('Manually refresh both Duel Data and Player List caches')
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
      
      // Get cache timestamps before refresh
      const oldDuelTimestamp = await duelDataCache.getCacheTimestamp();
      const oldPlayerTimestamp = await playerListCache.getCacheTimestamp();
      
      const oldDuelDate = oldDuelTimestamp ? new Date(oldDuelTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';
      
      const oldPlayerDate = oldPlayerTimestamp ? new Date(oldPlayerTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      // Refresh both caches
      const [duelData, playerList] = await Promise.all([
        duelDataCache.refreshCache(),
        playerListCache.refreshPlayerListCache()
      ]);
      
      // Get new cache timestamps
      const newDuelTimestamp = await duelDataCache.getCacheTimestamp();
      const newPlayerTimestamp = await playerListCache.getCacheTimestamp();
      
      const newDuelDate = new Date(newDuelTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      
      const newPlayerDate = new Date(newPlayerTimestamp).toLocaleString('en-US', {
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
        .setDescription('Both Duel Data and Player List caches have been successfully refreshed.')
        .addFields(
          { name: '📊 Duel Rows Cached', value: duelData.length.toString(), inline: true },
          { name: '👥 Players Cached', value: playerList.length.toString(), inline: true },
          { name: '🕐 Refresh Time', value: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          }), inline: true },
          { name: 'Previous Duel Update', value: oldDuelDate, inline: true },
          { name: 'Previous Player Update', value: oldPlayerDate, inline: true },
          { name: '🆕 Both Updated', value: 'Just now', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Manual Cache Refresh' });

      await interaction.editReply({ embeds: [embed] });
      
      console.log(`[${timestamp}] Manual cache refresh completed successfully by ${user.tag} (${user.id}) - ${duelData.length} duel rows and ${playerList.length} players cached`);
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