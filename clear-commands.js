require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// Function to clear commands for a specific guild
async function clearCommands(guildId, guildType) {
    try {
        console.log(`Started clearing application (/) commands for ${guildType} guild: ${guildId}`);

        // Fetch all registered guild-specific commands
        const commands = await rest.get(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
        );
        
        for (const command of commands) {
            console.log(`Deleting command: ${command.name}`);
            await rest.delete(
                Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, command.id)
            );
        }

        console.log(`Successfully cleared all application (/) commands for the ${guildType} guild.`);
    } catch (error) {
        console.error(`Error clearing commands for ${guildType} guild:`, error);
    }
}

(async () => {
    // Clear commands from test server
    await clearCommands(process.env.GUILD_ID, 'TEST');
    
    // Clear commands from production server if PROD_GUILD_ID is defined
    if (process.env.PROD_GUILD_ID) {
        await clearCommands(process.env.PROD_GUILD_ID, 'PRODUCTION');
    } else {
        console.log('PROD_GUILD_ID not defined. Skipping production command clearing.');
    }
})();
