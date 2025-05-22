require('dotenv').config(); // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const { createGoogleAuth } = require('./utils/googleAuth');

// Define the prefix for message commands
const PREFIX = '!';

// Initialize the Discord client with the necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
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

// Create a separate collection for command name aliases (for case insensitivity)
client.commandAliases = new Collection();

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Store the command with its original name
    client.commands.set(command.data.name, command);
    
    // Store lowercase version for case-insensitive lookup
    const lowercaseName = command.data.name.toLowerCase();
    client.commandAliases.set(lowercaseName, command.data.name);
    
    console.log(`Command loaded: ${command.data.name}`);
}

// Event listener for when the bot becomes ready and online
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

/**
 * Creates a simplified interaction-like object from a message for prefix commands
 * This adapter allows message commands to use the same execute function as slash commands
 */
function createMessageAdapter(message, commandName, args = []) {
    return {
        // Basic properties needed by most commands
        commandName,
        user: message.author,
        member: message.member,
        guild: message.guild,
        channel: message.channel,
        client: message.client,
        createdTimestamp: message.createdTimestamp,
        
        // Methods needed for responses
        async deferReply(options = {}) {
            // For message commands, we'll just acknowledge receipt
            const response = await message.channel.send({ 
                content: 'Processing your request...'
            });
            this.deferredReply = response;
            this.ephemeralOptions = options.ephemeral || false;
            return response;
        },
        
        async editReply(options = {}) {
            // Handle ephemeral responses for deferred replies
            if (this.deferredReply && this.ephemeralOptions) {
                try {
                    // Delete the original deferred reply in the channel
                    await this.deferredReply.delete().catch(e => console.error('Failed to delete deferred reply:', e));
                    
                    // Send the updated content as a DM
                    this.deferredReply = await message.author.send(options);
                    return this.deferredReply;
                } catch (error) {
                    console.error('Failed to send DM or delete deferred message:', error);
                    // Fallback to editing in channel
                    options.content = `[Ephemeral] ${options.content || ''}`;
                    return this.deferredReply.edit(options);
                }
            } 
            // Handle non-ephemeral replies normally
            else if (this.deferredReply) {
                return this.deferredReply.edit(options);
            } else {
                return message.channel.send(options);
            }
        },
        
        async reply(options = {}) {
            // For ephemeral messages, send the response as a DM to avoid channel bloat
            if (options.ephemeral) {
                try {
                    // Delete the original command message to reduce bloat
                    await message.delete().catch(e => console.error('Failed to delete command message:', e));
                    
                    // Send the response as a DM
                    return message.author.send(options);
                } catch (error) {
                    console.error('Failed to send DM or delete message:', error);
                    // Fallback: send in channel with a note that it's ephemeral
                    options.content = `[Ephemeral] ${options.content || ''}`;
                    return message.channel.send(options);
                }
            }
            
            // For non-ephemeral messages, just send normally
            return message.channel.send(options);
        },
        
        // Mock function to identify as a command
        isCommand() {
            return true;
        },
        
        // Simple options mock for commands that use them
        options: {
            getString(name) { return args[0] || null; },
            getUser(name) { return null; },
            getMember(name) { return null; },
            getInteger(name) { return args[0] ? parseInt(args[0]) : null; },
            getNumber(name) { return args[0] ? parseFloat(args[0]) : null; },
            getBoolean(name) { return args[0] === 'true'; },
            getChannel(name) { return null; },
            getRole(name) { return null; },
            getAttachment(name) { return null; },
            get data() { return []; } // Empty options data
        }
    };
}

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

// Event listener for handling message commands with "!" prefix
client.on('messageCreate', async message => {
    // Ignore messages from bots or messages that don't start with the prefix
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    
    // Extract command name and arguments from the message
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase(); // Get the command name and remove it from args
    
    // Log the command attempt
    const timestamp = new Date().toISOString();
    const user = message.author;
    const guildName = message.guild ? message.guild.name : 'DM';
    const channelName = message.channel ? message.channel.name : 'Unknown';
    
    console.log(`[${timestamp}] Prefix command invoked: ${commandName} 
    User: ${user.tag} (${user.id})
    Server: ${guildName} (${message.guild?.id || 'N/A'})
    Channel: ${channelName} (${message.channel.id})
    Args: ${args.join(', ')}`);
    
    // Find the command in our collection using case-insensitive lookup
    const originalCommandName = client.commandAliases.get(commandName.toLowerCase());
    const command = originalCommandName ? client.commands.get(originalCommandName) : null;
    
    if (!command) {
        console.log(`[${timestamp}] Prefix command not found: ${commandName}`);
        return; // Command not found
    }
    
    try {
        // Create an interaction-like object from the message
        const fakeInteraction = createMessageAdapter(message, command.data.name, args);
        
        // Check if the command is restricted by role
        if (command.role && !message.member.roles.cache.some(role => role.name === command.role)) {
            return message.reply(`You do not have the required ${command.role} role to use this command.`);
        }
        
        // Execute the command with our adapter and required params
        await command.execute(fakeInteraction, sheets, auth);
        console.log(`[${timestamp}] Prefix command ${commandName} executed successfully.`);
    } catch (error) {
        console.error(`[${timestamp}] Error executing prefix command ${commandName}:`, error);
        message.reply('There was an error while executing this command!');
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
