const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');
const playerListCache = require('../utils/playerListCache');
const rosterCache = require('../utils/rosterCache');
const signupsCache = require('../utils/signupsCache');
const rulesCache = require('../utils/rulesCache');
const rankingsCache = require('../utils/rankingsCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refreshcache')
    .setDescription('Manually refresh all caches (Duel Data, Player List, Roster, Signups, Rules, Rankings)')
    .setDefaultMemberPermissions('0'), // Restrict to administrators

  async execute(interaction) {
    const timestamp = new Date().toISOString();
    const user = interaction.user;

    console.log(`[${timestamp}] Manual cache refresh requested by ${user.tag} (${user.id})`);

    // Check if user has @Moderator role (fetch fresh without cache)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.some(role => role.name === 'Moderator')) {
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
      const oldRosterTimestamp = await rosterCache.getCacheTimestamp();
      const oldSignupsTimestamp = await signupsCache.getCacheTimestamp();
      const oldRulesTimestamp = await rulesCache.getCacheTimestamp();
      const oldRankingsTimestamp = await rankingsCache.getCacheTimestamp();

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

      const oldRosterDate = oldRosterTimestamp ? new Date(oldRosterTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      const oldSignupsDate = oldSignupsTimestamp ? new Date(oldSignupsTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      const oldRulesDate = oldRulesTimestamp ? new Date(oldRulesTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      const oldRankingsDate = oldRankingsTimestamp ? new Date(oldRankingsTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }) : 'Never';

      // Refresh all caches
      const [duelData, playerList, rosterMap, signupsData, rulesData, rankingsData] = await Promise.all([
        duelDataCache.refreshCache(),
        playerListCache.refreshPlayerListCache(),
        rosterCache.refreshCache(),
        signupsCache.refreshCache(),
        rulesCache.refreshCache(),
        rankingsCache.refreshAllDivisions()
      ]);
      
      // Get new cache timestamps
      const newDuelTimestamp = await duelDataCache.getCacheTimestamp();
      const newPlayerTimestamp = await playerListCache.getCacheTimestamp();
      const newRosterTimestamp = await rosterCache.getCacheTimestamp();
      const newSignupsTimestamp = await signupsCache.getCacheTimestamp();
      const newRulesTimestamp = await rulesCache.getCacheTimestamp();
      const newRankingsTimestamp = await rankingsCache.getCacheTimestamp();

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

      const newRosterDate = new Date(newRosterTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const newSignupsDate = new Date(newSignupsTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const newRulesDate = new Date(newRulesTimestamp).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const rosterCount = Object.keys(rosterMap).length;
      const rulesSource = rulesData?.metadata?.source || 'unknown';
      const rulesDocId = rulesData?.metadata?.documentId ?
        `${rulesData.metadata.source} (${rulesData.metadata.documentId.substring(0, 8)}...)` :
        rulesSource;

      const rankingsCount = `HLD:${rankingsData.HLD.players.length} LLD:${rankingsData.LLD.players.length} MEL:${rankingsData.MELEE.players.length}`;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Cache Refresh Complete')
        .setDescription('All caches (Duel Data, Player List, Roster, Signups, Rules, Rankings) have been successfully refreshed.')
        .addFields(
          { name: '📊 Duel Rows Cached', value: duelData.length.toString(), inline: true },
          { name: '👥 Players Cached', value: playerList.length.toString(), inline: true },
          { name: '📋 Roster Entries', value: rosterCount.toString(), inline: true },
          { name: '📝 Signup Rows Cached', value: signupsData.length.toString(), inline: true },
          { name: '📜 Rules Source', value: rulesDocId, inline: true },
          { name: '🏆 Rankings Cached', value: rankingsCount, inline: true },
          { name: 'Previous Duel Update', value: oldDuelDate, inline: true },
          { name: 'Previous Player Update', value: oldPlayerDate, inline: true },
          { name: 'Previous Roster Update', value: oldRosterDate, inline: true },
          { name: 'Previous Signups Update', value: oldSignupsDate, inline: true },
          { name: 'Previous Rules Update', value: oldRulesDate, inline: true },
          { name: 'Previous Rankings Update', value: oldRankingsDate, inline: true },
          { name: '🆕 All Updated', value: 'Just now', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Manual Cache Refresh' });

      await interaction.editReply({ embeds: [embed] });

      console.log(`[${timestamp}] Manual cache refresh completed successfully by ${user.tag} (${user.id}) - ${duelData.length} duel rows, ${playerList.length} players, ${rosterCount} roster entries, ${signupsData.length} signup rows, rules (${rulesSource}), and rankings (${rankingsCount}) cached`);
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