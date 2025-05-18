const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Helper function to check if a signup is between now and the most recent past Thursday at 6:00pm ET
const isWithinRange = (timestamp) => {
    // Current date and signup date
    const currentDate = new Date();
    const signupDate = new Date(timestamp);
    
    // Find the most recent Thursday at 6:00pm ET (either past Thursday or upcoming if we're before Thursday)
    const mostRecentThursday = new Date();
    
    // Current day of week (0 = Sunday, 4 = Thursday)
    const currentDay = mostRecentThursday.getDay();
    
    // If today is Thursday
    if (currentDay === 4) {
        const currentHour = mostRecentThursday.getHours();
        
        // If it's before 6pm on Thursday, use last week's Thursday
        if (currentHour < 18) {
            mostRecentThursday.setDate(mostRecentThursday.getDate() - 7);
        }
    } 
    // If we're after Thursday (Friday, Saturday, Sunday)
    else if (currentDay > 4) {
        // Roll back to this week's Thursday
        mostRecentThursday.setDate(mostRecentThursday.getDate() - (currentDay - 4));
    } 
    // If we're before Thursday (Monday, Tuesday, Wednesday)
    else {
        // Roll back to last week's Thursday
        mostRecentThursday.setDate(mostRecentThursday.getDate() - (currentDay + 3));
    }
    
    // Set to 6:00 PM ET
    mostRecentThursday.setHours(18, 0, 0, 0);
    
    // Get the upcoming Thursday at 6:00pm ET
    const upcomingThursday = new Date(mostRecentThursday);
    upcomingThursday.setDate(upcomingThursday.getDate() + 7);
    
    // Check if signup is after the most recent Thursday cutoff and before or equal to now
    return signupDate >= mostRecentThursday && signupDate <= currentDate;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('recentsignups')
        .setDescription('View recent tournament signups'),
    
    async execute(interaction, sheets, auth) {
        try {
            await interaction.deferReply();
            const authClient = await auth.getClient();

            // Fetch signups from the "DFC Recent Signups" tab
            const res = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'DFC Recent Signups!A:E',
            });
            
            const signups = res.data.values || [];
            
            // Skip header row and filter for signups in the last 7 days but before cutoff
            const recentSignups = signups.slice(1).filter(row => {
                if (!row[0]) return false; // Skip if no timestamp
                return isWithinRange(row[0]);
            });
            
            if (recentSignups.length === 0) {
                return interaction.editReply('No recent signups found for the upcoming tournament.');
            }

            // Sort by timestamp (newest first)
            recentSignups.sort((a, b) => new Date(b[0]) - new Date(a[0]));
            
            // Pagination setup
            const signupsPerPage = 5;
            const totalPages = Math.ceil(recentSignups.length / signupsPerPage);
            let currentPage = 1;
            
            // Create the embed for the current page
            const createEmbed = (page) => {
                const startIdx = (page - 1) * signupsPerPage;
                const endIdx = Math.min(startIdx + signupsPerPage, recentSignups.length);
                const currentSignups = recentSignups.slice(startIdx, endIdx);
                
                // Get the most recent Thursday date for display
                const mostRecentThursday = new Date();
                const currentDay = mostRecentThursday.getDay();
                
                // Calculate the most recent Thursday (same logic as in isWithinRange function)
                if (currentDay === 4) {
                    const currentHour = mostRecentThursday.getHours();
                    if (currentHour < 18) {
                        mostRecentThursday.setDate(mostRecentThursday.getDate() - 7);
                    }
                } else if (currentDay > 4) {
                    mostRecentThursday.setDate(mostRecentThursday.getDate() - (currentDay - 4));
                } else {
                    mostRecentThursday.setDate(mostRecentThursday.getDate() - (currentDay + 3));
                }
                mostRecentThursday.setHours(18, 0, 0, 0);
                
                // Format date for display
                const formattedDate = mostRecentThursday.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🏆 Recent Tournament Signups')
                    .setDescription(`Signups since ${formattedDate} at 6:00 PM ET`)
                    .setFooter({ text: `Page ${page}/${totalPages} · ${recentSignups.length} total signups` });
                
                // Add each signup as a field
                currentSignups.forEach(signup => {
                    // Parse the data from the row
                    const timestamp = new Date(signup[0]).toLocaleString('en-US', {
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    const discordHandle = signup[1] || 'Unknown';
                    const division = signup[2] || 'Unknown';
                    const characterClass = signup[3] || 'Unknown';
                    const buildType = signup[4] || 'Unknown';
                    
                    // Determine emoji for class
                    let classEmoji = '⚔️'; // Default
                    if (characterClass.includes('Paladin')) classEmoji = '⚔️';
                    else if (characterClass.includes('Necromancer')) classEmoji = '💀';
                    else if (characterClass.includes('Assassin')) classEmoji = '🗡️';
                    else if (characterClass.includes('Druid')) classEmoji = '🐺';
                    else if (characterClass.includes('Amazon')) classEmoji = '🏹';
                    else if (characterClass.includes('Sorceress')) classEmoji = '🔮';
                    else if (characterClass.includes('Barbarian')) classEmoji = '🛡️';
                    
                    embed.addFields({
                        name: `${classEmoji} ${discordHandle}`,
                        value: `📅 ${timestamp}\n🏆 Division: **${division}**\n📋 Class: **${characterClass}**\n🔧 Build: **${buildType}**`,
                        inline: false
                    });
                });
                
                return embed;
            };
            
            // Create navigation buttons
            const createButtons = (page) => {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages)
                    );
                return row;
            };
            
            // Send initial response
            const initialEmbed = createEmbed(currentPage);
            const initialButtons = createButtons(currentPage);
            
            const response = await interaction.editReply({
                embeds: [initialEmbed],
                components: totalPages > 1 ? [initialButtons] : []
            });
            
            // Handle pagination with button interactions
            if (totalPages > 1) {
                const collector = response.createMessageComponentCollector({ 
                    time: 60000 // Collect for 1 minute
                });
                
                collector.on('collect', async i => {
                    if (i.customId === 'previous') {
                        currentPage--;
                    } else if (i.customId === 'next') {
                        currentPage++;
                    }
                    
                    await i.update({
                        embeds: [createEmbed(currentPage)],
                        components: [createButtons(currentPage)]
                    });
                });
                
                collector.on('end', async () => {
                    // Remove buttons when collector expires
                    await interaction.editReply({
                        embeds: [createEmbed(currentPage)],
                        components: []
                    }).catch(() => {});
                });
            }
            
        } catch (error) {
            console.error('Error fetching recent signups:', error);
            await interaction.editReply('An error occurred while fetching recent signups. Please try again later.');
        }
    }
};