require('dotenv').config(); // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const { createGoogleAuth } = require('./utils/googleAuth');

// Initialize the Discord client with the necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Google Sheets API setup
const sheets = google.sheets('v4');
const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

// Create a collection to store commands
client.commands = new Collection();

// Load the command handler
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Event listener for when the bot becomes ready and online
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Event listener for handling interactions (slash commands and autocomplete)
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        // Slash Command Handling
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            // Check if the command is restricted by role
            if (command.role && !interaction.member.roles.cache.some(role => role.name === command.role)) {
                return interaction.reply({
                    content: `You do not have the required ${command.role} role to use this command.`,
                    ephemeral: true
                });
            }

            // Execute the command
            await command.execute(interaction, sheets, auth);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    } else if (interaction.isAutocomplete()) {
        // Autocomplete Handling
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }
});

// Login to Discord with your bot token
client.login(process.env.BOT_TOKEN);

// Create a basic HTTP server to satisfy Heroku's port binding requirement
// Only create an HTTP server if we're in a production environment or PORT is explicitly set
if (process.env.PORT || process.env.NODE_ENV === 'production') {
    const PORT = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Discord bot is running!\n');
    });

    server.listen(PORT, () => {
        console.log(`HTTP server running on port ${PORT} (environment: ${process.env.NODE_ENV || 'development'})`);
    });
} else {
    console.log('Running in development mode without HTTP server');
}
