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

        if (commands.length === 0) {
            console.log(`No commands found for ${guildType} guild.`);
            return;
        }

        console.log(`Found ${commands.length} commands to delete.`);

        let deletedCount = 0;
        for (const command of commands) {
            try {
                console.log(`Deleting command: ${command.name} (${deletedCount + 1}/${commands.length})`);
                await rest.delete(
                    Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, command.id)
                );
                deletedCount++;
                console.log(`✓ Deleted: ${command.name}`);

                // Add small delay to avoid rate limiting
                if (deletedCount < commands.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`✗ Failed to delete command ${command.name}:`, error.message);
                // Continue with other commands even if one fails
            }
        }

        console.log(`Successfully cleared ${deletedCount}/${commands.length} application (/) commands for the ${guildType} guild.`);
    } catch (error) {
        console.error(`Error clearing commands for ${guildType} guild:`, error);
        throw error;
    }
}

(async () => {
    try {
        // Clear commands from test server
        await clearCommands(process.env.GUILD_ID, 'TEST');

        // Clear commands from production server if PROD_GUILD_ID is defined
        if (process.env.PROD_GUILD_ID) {
            await clearCommands(process.env.PROD_GUILD_ID, 'PRODUCTION');
        } else {
            console.log('PROD_GUILD_ID not defined. Skipping production command clearing.');
        }
    } catch (error) {
        console.error('Fatal error during command clearing:', error);
        process.exit(1);
    }
})();
