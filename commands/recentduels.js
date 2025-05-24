const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const duelDataCache = require('../utils/duelDataCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recentduels')
    .setDescription('Get recent duels from the last X days (up to 30 days)')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to look back (1-30, defaults to 7)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(30)),

  async execute(interaction) {
    const inputDays = interaction.options.getInteger('days');
    const days = inputDays || 7; // Default to 7 days if no input provided
    const usedDefault = inputDays === null;
    
    const timestamp = new Date().toISOString();
    const user = interaction.user;
    const guildName = interaction.guild ? interaction.guild.name : 'DM';
    const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Executing recentduels command:
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${interaction.guildId || 'N/A'})
    Channel: ${channelName} (${interaction.channelId})
    Days: ${days} ${usedDefault ? '(default)' : '(specified)'}`);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get duel data from cache
      const duelRows = await duelDataCache.getCachedData();

      // Filter matches within the specified time period
      const recentMatches = duelRows.filter(row => {
        if (row.length < 5) return false;
        
        const matchDate = new Date(row[0]); // Event Date column
        if (isNaN(matchDate.getTime())) return false;
        
        return matchDate >= cutoffDate;
      });

      // Sort by most recent first
      recentMatches.sort((a, b) => new Date(b[0]) - new Date(a[0]));

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green color
        .setTitle(`⚔️ Recent Duels - Last ${days} Day${days === 1 ? '' : 's'}`)
        .setDescription(`Found ${recentMatches.length} duel${recentMatches.length === 1 ? '' : 's'} in the last ${days} day${days === 1 ? '' : 's'}`)
        .setTimestamp()
        .setFooter({ text: 'DFC Recent Duels' });

      let embedsToSend;

      if (recentMatches.length === 0) {
        embed.addFields({ 
          name: 'No Recent Duels', 
          value: `No duels found in the last ${days} day${days === 1 ? '' : 's'}.`,
          inline: false 
        });
        embedsToSend = [embed];
      } else {
        // Class emojis
        const classEmojis = {
          'amazon': '🏹',
          'assassin': '🥷',
          'barbarian': '⚔️',
          'druid': '🐺',
          'necromancer': '💀',
          'paladin': '🛡️',
          'sorceress': '🔮'
        };

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
          
          const winnerClassEmoji = classEmojis[winnerClass.toLowerCase()] || '👤';
          const loserClassEmoji = classEmojis[loserClass.toLowerCase()] || '👤';
          
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
              .setTitle(embeds.length === 0 ? `⚔️ Recent Duels - Last ${days} Day${days === 1 ? '' : 's'}` : `⚔️ Recent Duels (cont.)`);
            
            if (embeds.length === 0) {
              embedForBatch.setDescription(`Found ${recentMatches.length} duel${recentMatches.length === 1 ? '' : 's'} in the last ${days} day${days === 1 ? '' : 's'}`);
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
            .setTitle(embeds.length === 0 ? `⚔️ Recent Duels - Last ${days} Day${days === 1 ? '' : 's'}` : `⚔️ Recent Duels (cont.)`);
          
          if (embeds.length === 0) {
            embedForBatch.setDescription(`Found ${recentMatches.length} duel${recentMatches.length === 1 ? '' : 's'} in the last ${days} day${days === 1 ? '' : 's'}`);
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

      // Send the first embed as a reply, then send additional embeds as follow-up messages
      let firstEmbed = embedsToSend[0];
      let replyContent = {};
      
      if (usedDefault) {
        replyContent.content = `💡 **Tip**: You can specify the number of days to look back by using \`!recentduels [days]\` (e.g., \`!recentduels 20\`) - up to 30 days max.`;
        replyContent.embeds = [firstEmbed];
      } else {
        replyContent.embeds = [firstEmbed];
      }
      
      await interaction.editReply({ ...replyContent, ephemeral: true });
      
      // Send additional embeds as follow-up messages if there are any
      if (embedsToSend.length > 1) {
        for (let i = 1; i < embedsToSend.length; i++) {
          await interaction.followUp({ embeds: [embedsToSend[i]], ephemeral: true });
        }
      }
      console.log(`[${timestamp}] Recent duels command completed successfully for ${user.tag} (${user.id}) - found ${recentMatches.length} matches in ${days} days`);
    } catch (error) {
      const errorMessage = `[${timestamp}] Error fetching recent duels for ${user.tag} (${user.id})`;
      console.error(errorMessage, error);
      await interaction.editReply({ content: 'There was an error while retrieving recent duels.', ephemeral: true });
    }
  },
};