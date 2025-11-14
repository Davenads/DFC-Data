const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');
const { getClassEmoji } = require('../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recentduels')
    .setDescription('Get the most recent duels (up to 40 duels)')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of recent duels to show (1-40, defaults to 20)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(40)),

  async execute(interaction) {
    const inputCount = interaction.options.getInteger('count');
    const count = inputCount || 20; // Default to 20 duels if no input provided
    const usedDefault = inputCount === null;

    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';

    console.log(`[${timestamp}] Executing recentduels command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Count: ${count} ${usedDefault ? '(default)' : '(specified)'}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get duel data from cache
      const duelRows = await duelDataCache.getCachedData();

      // Filter out invalid rows and sort by most recent first
      const validMatches = duelRows
        .filter(row => {
          if (row.length < 5) return false;
          const matchDate = new Date(row[0]); // Event Date column
          return !isNaN(matchDate.getTime());
        })
        .sort((a, b) => new Date(b[0]) - new Date(a[0]));

      // Get the most recent X duels
      const recentMatches = validMatches.slice(0, count);

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green color
        .setTitle(`⚔️ Recent Duels - Last ${count} Match${count === 1 ? '' : 'es'}`)
        .setDescription(`Showing ${recentMatches.length} recent duel${recentMatches.length === 1 ? '' : 's'}`)
        .setTimestamp()
        .setFooter({ text: 'DFC Recent Duels' });

      let embedsToSend;

      if (recentMatches.length === 0) {
        embed.addFields({
          name: 'No Recent Duels',
          value: 'No duels found in the database.',
          inline: false
        });
        embedsToSend = [embed];
      } else {
        // Build matches and split into multiple embeds if needed
        const matchStrings = [];

        for (const match of recentMatches) {
          const eventDate = new Date(match[0]); // Event Date
          const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
          const winner = match[1] || 'Unknown'; // Winner
          const winnerClass = match[2] || ''; // W Class
          const winnerBuild = match[3] || ''; // W Build
          const loser = match[4] || 'Unknown'; // Loser
          const loserClass = match[5] || ''; // L Class
          const loserBuild = match[6] || ''; // L Build
          const roundLosses = match[7] || ''; // Round Losses
          const matchType = match[8] || 'Unknown'; // Match Type
          const title = match[11] || ''; // Title

          const winnerClassEmoji = getClassEmoji(winnerClass);
          const loserClassEmoji = getClassEmoji(loserClass);
          
          let matchString = `**${formattedDate}** - ${winner} def. ${loser}`;
          
          // Add class and build information if available (simplified)
          if (winnerClass || loserClass) {
            matchString += `\n${winnerClassEmoji} ${winnerClass} ${winnerBuild} vs ${loserClassEmoji} ${loserClass} ${loserBuild}`;
          }
          
          // Add match type if available
          if (matchType && matchType !== 'Unknown') {
            matchString += `\nType: ${matchType}`;
          }
          
          matchStrings.push(matchString);
        }
        
        // Split matches into multiple embeds based on character limits
        const embeds = [];
        const maxFieldLength = 1000; // Leave some buffer under 1024 limit
        let currentMatches = [];
        let currentLength = 0;
        
        for (const matchString of matchStrings) {
          const matchWithSeparator = currentMatches.length > 0 ? `\n\n${matchString}` : matchString;
          
          // If adding this match would exceed the limit, finalize current embed and start a new one
          if (currentLength + matchWithSeparator.length > maxFieldLength && currentMatches.length > 0) {
            // Create embed for current batch
            const embedForBatch = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle(embeds.length === 0 ? `⚔️ Recent Duels - Last ${count} Match${count === 1 ? '' : 'es'}` : `⚔️ Recent Duels (cont.)`);

            if (embeds.length === 0) {
              embedForBatch.setDescription(`Showing ${recentMatches.length} recent duel${recentMatches.length === 1 ? '' : 's'}`);
            }
            
            embedForBatch.addFields({
              name: `Recent Matches${embeds.length > 0 ? ` (Part ${embeds.length + 1})` : ''}`,
              value: currentMatches.join('\n\n'),
              inline: false
            });
            
            if (embeds.length === 0) {
              embedForBatch.setTimestamp().setFooter({ text: 'DFC Recent Duels' });
            }
            
            embeds.push(embedForBatch);
            
            // Reset for next batch
            currentMatches = [matchString];
            currentLength = matchString.length;
          } else {
            currentMatches.push(matchString);
            currentLength += matchWithSeparator.length;
          }
        }
        
        // Add remaining matches to final embed
        if (currentMatches.length > 0) {
          const embedForBatch = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(embeds.length === 0 ? `⚔️ Recent Duels - Last ${count} Match${count === 1 ? '' : 'es'}` : `⚔️ Recent Duels (cont.)`);

          if (embeds.length === 0) {
            embedForBatch.setDescription(`Showing ${recentMatches.length} recent duel${recentMatches.length === 1 ? '' : 's'}`);
          }
          
          embedForBatch.addFields({
            name: `Recent Matches${embeds.length > 0 ? ` (Part ${embeds.length + 1})` : ''}`,
            value: currentMatches.join('\n\n'),
            inline: false
          });
          
          if (embeds.length === 0) {
            embedForBatch.setTimestamp().setFooter({ text: 'DFC Recent Duels' });
          }
          
          embeds.push(embedForBatch);
        }
        
        embedsToSend = embeds;
      }

      // Try to send embeds via DM
      try {
        // Send embeds to user via DM in batches of up to 10 embeds per message
        const EMBEDS_PER_MESSAGE = 10;
        for (let i = 0; i < embedsToSend.length; i += EMBEDS_PER_MESSAGE) {
          const embedBatch = embedsToSend.slice(i, i + EMBEDS_PER_MESSAGE);
          await user.send({ embeds: embedBatch });
        }

        // Create notification embed for channel
        const notificationEmbed = new EmbedBuilder()
          .setColor(0x0099FF) // Blue color
          .setTitle('📬 Recent Duels Sent!')
          .setDescription(`Check your DM from <@${interaction.client.user.id}> for the last ${count} duel${count === 1 ? '' : 's'}.`)
          .setTimestamp();

        let replyContent = { embeds: [notificationEmbed], ephemeral: true };

        if (usedDefault) {
          replyContent.content = `💡 **Tip**: You can specify the number of duels using \`/recentduels count:[number]\` (e.g., \`/recentduels count:30\`) - up to 40 duels max.`;
        }

        await interaction.editReply(replyContent);
        console.log(`[${timestamp}] Recent duels command completed successfully for ${user.tag} (${user.id}) - sent ${recentMatches.length} of ${count} requested duels via DM`);
      } catch (dmError) {
        console.error(`[${timestamp}] Failed to send DM to ${user.tag} (${user.id})`, dmError);
        await interaction.editReply({
          content: '❌ Unable to send you a DM. Please check that your DMs are enabled for this server.',
          ephemeral: true
        });
      }
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching recent duels for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving recent duels.', ephemeral: true });
    }
  },
};