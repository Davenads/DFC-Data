const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('node:fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// Load all command files
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        // Deploy to test server (GUILD_ID)
        console.log(`Started refreshing application (/) commands for TEST guild: ${process.env.GUILD_ID}`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands for the TEST guild.');

        // Deploy to production server if PROD_GUILD_ID is defined
        if (process.env.PROD_GUILD_ID) {
            console.log(`Started refreshing application (/) commands for PRODUCTION guild: ${process.env.PROD_GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.PROD_GUILD_ID),
                { body: commands }
            );
            console.log('Successfully reloaded application (/) commands for the PRODUCTION guild.');
        } else {
            console.log('PROD_GUILD_ID not defined. Skipping production deployment.');
        }
    } catch (error) {
        console.error('Error while updating commands:', error);
    }
})();
