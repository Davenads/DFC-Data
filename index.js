require('dotenv').config(); // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const cron = require('node-cron');
const { createGoogleAuth } = require('./utils/googleAuth');
const { logCommandExecution } = require('./utils/auditLogger');
const redisClient = require('./utils/redisClient');
const duelDataCache = require('./utils/duelDataCache');
const rosterCache = require('./utils/rosterCache');
const signupsCache = require('./utils/signupsCache');
const rulesCache = require('./utils/rulesCache');
const rankingsCache = require('./utils/rankingsCache');

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

// Button Routing Map - Centralized O(1) button-to-command routing
// Maps button customId prefixes to their command handler names
// This provides fast, explicit routing without iterating through all commands
const BUTTON_ROUTING = {
    // Signup command handles multiple prefixes
    'signup': 'signup',
    'signupmulti': 'signup',
    'signupclass': 'signup',
    'signupback': 'signup',
    'signupcontinue': 'signup',
    'signupcontinuemodal': 'signup',
    'signupproceed': 'signup',
    'signupmodal': 'signup',

    // Rankings command
    'rankings': 'rankings',

    // Report win command
    'reportwin': 'reportwin',
    'reportmirror': 'reportwin',
    'reportwinclass': 'reportwin',
    'reportloseclass': 'reportwin',
    'mirrortoggle': 'reportwin',
    'reportcontinue': 'reportwin',
    'reportdetails': 'reportwin',
    'reportplayers': 'reportwin',

    // Namesync command
    'namesync': 'namesync',

    // Recent signups command
    'recentsignups': 'recentsignups',

    // Help command (handles specific button IDs)
    'show': 'help',  // show_deprecated
    'back': 'help'   // back_to_help
};

// Event listener for when the bot becomes ready and online
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Initialize Redis connection and cache
    try {
        await redisClient.connect();
        console.log('Redis connection established');
        
        // Perform initial cache load
        console.log('Performing initial cache load...');
        await Promise.all([
            duelDataCache.refreshCache(),
            rosterCache.refreshCache(),
            signupsCache.refreshCache(),
            rulesCache.refreshCache(),
            rankingsCache.refreshAllDivisions()
        ]);
        console.log('Initial cache load completed (Duel Data + Roster + Signups + Rules + Rankings)');
    } catch (error) {
        console.error('Failed to initialize Redis or cache:', error);
        console.log('Bot will continue running with Google Sheets fallback');
    }
    
    // Schedule cache refresh - Thursday 5:30pm ET (22:30 UTC)
    cron.schedule('30 22 * * 4', async () => {
        console.log('Running scheduled cache refresh (Thursday 5:30pm ET)...');
        try {
            await Promise.all([
                duelDataCache.refreshCache(),
                rosterCache.refreshCache(),
                signupsCache.refreshCache(),
                rulesCache.refreshCache(),
                rankingsCache.refreshAllDivisions()
            ]);
            console.log('Thursday cache refresh completed successfully (Duel Data + Roster + Signups + Rules + Rankings)');
        } catch (error) {
            console.error('Thursday cache refresh failed, will fallback to Google Sheets:', error);
        }
    }, {
        timezone: "America/New_York"
    });
    
    // Schedule cache refresh - Friday 2:00am ET (07:00 UTC)
    cron.schedule('0 7 * * 5', async () => {
        console.log('Running scheduled cache refresh (Friday 2:00am ET)...');
        try {
            await Promise.all([
                duelDataCache.refreshCache(),
                rosterCache.refreshCache(),
                signupsCache.refreshCache(),
                rulesCache.refreshCache(),
                rankingsCache.refreshAllDivisions()
            ]);
            console.log('Friday cache refresh completed successfully (Duel Data + Roster + Signups + Rules + Rankings)');
        } catch (error) {
            console.error('Friday cache refresh failed, will fallback to Google Sheets:', error);
        }
    }, {
        timezone: "America/New_York"
    });
    
    // Schedule cache refresh - Friday 11:00pm ET (04:00 UTC Saturday)
    cron.schedule('0 4 * * 6', async () => {
        console.log('Running scheduled cache refresh (Friday 11:00pm ET)...');
        try {
            await Promise.all([
                duelDataCache.refreshCache(),
                rosterCache.refreshCache(),
                signupsCache.refreshCache(),
                rulesCache.refreshCache(),
                rankingsCache.refreshAllDivisions()
            ]);
            console.log('Friday evening cache refresh completed successfully (Duel Data + Roster + Signups + Rules + Rankings)');
        } catch (error) {
            console.error('Friday evening cache refresh failed, will fallback to Google Sheets:', error);
        }
    }, {
        timezone: "America/New_York"
    });
    
    console.log('Cache refresh scheduled for Thursday 5:30pm ET, Friday 2:00am ET, and Friday 11:00pm ET');
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
        
        async followUp(options = {}) {
            // For ephemeral follow-up messages, send as DM
            if (options.ephemeral) {
                try {
                    return message.author.send(options);
                } catch (error) {
                    console.error('Failed to send follow-up DM:', error);
                    // Fallback: send in channel with a note that it's ephemeral
                    options.content = `[Ephemeral] ${options.content || ''}`;
                    return message.channel.send(options);
                }
            }
            
            // For non-ephemeral follow-up messages, send in channel
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

// Event listener for handling interactions (slash commands, buttons, and autocomplete)
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        // Slash Command Handling
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Check if the command is restricted by role
        if (command.role && !interaction.member.roles.cache.some(role => role.name === command.role)) {
            return interaction.reply({
                content: `You do not have the required ${command.role} role to use this command.`,
                ephemeral: true
            });
        }

        // Wrap command execution with audit logging
        await logCommandExecution(
            client,
            interaction,
            interaction.commandName,
            async () => {
                try {
                    // Execute the command
                    await command.execute(interaction, sheets, auth);
                } catch (error) {
                    console.error(error);
                    const errorMessage = {
                        content: 'There was an error while executing this command!',
                        ephemeral: true
                    };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                    throw error; // Re-throw for audit logging
                }
            }
        );
    } else if (interaction.isButton()) {
        // Button Interaction Handling with Centralized Routing
        const timestamp = new Date().toISOString();
        const user = interaction.user;

        console.log(`[${timestamp}] Button interaction: ${interaction.customId} from ${user.tag} (${user.id})`);

        // O(1) lookup: Extract prefix and find command via routing map
        const prefix = interaction.customId.split('_')[0];
        const commandName = BUTTON_ROUTING[prefix];

        if (commandName) {
            const command = client.commands.get(commandName);

            if (command?.handleButton && typeof command.handleButton === 'function') {
                try {
                    console.log(`[${timestamp}] Routing button to command: ${commandName}`);
                    const result = await command.handleButton(interaction, sheets, auth);

                    if (result || interaction.replied || interaction.deferred) {
                        console.log(`[${timestamp}] Button interaction handled by ${commandName}`);
                    } else {
                        // Command declined the button (returned false)
                        console.warn(`[${timestamp}] Command ${commandName} declined button: ${interaction.customId}`);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: 'This interaction is no longer available.', ephemeral: true });
                        }
                    }
                } catch (error) {
                    console.error(`[${timestamp}] Error handling button interaction in ${commandName}:`, error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'There was an error handling this interaction!', ephemeral: true });
                    }
                }
            } else {
                console.warn(`[${timestamp}] Command ${commandName} found but has no handleButton function`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'This interaction is no longer available.', ephemeral: true });
                }
            }
        } else {
            // No routing entry found for this prefix
            console.warn(`[${timestamp}] No routing entry for button prefix: ${prefix} (full customId: ${interaction.customId})`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'This interaction is no longer available.', ephemeral: true });
            }
        }
    } else if (interaction.isModalSubmit()) {
        // Modal Submission Handling
        const timestamp = new Date().toISOString();
        const user = interaction.user;

        console.log(`[${timestamp}] Modal submission: ${interaction.customId} from ${user.tag} (${user.id})`);

        // Find the command that handles this modal
        let handled = false;
        for (const command of client.commands.values()) {
            if (command.handleModal && typeof command.handleModal === 'function') {
                try {
                    const result = await command.handleModal(interaction, sheets, auth);
                    if (result) {
                        console.log(`[${timestamp}] Modal submission handled by ${command.data?.name || 'unknown'}`);
                        handled = true;
                        break;
                    }
                } catch (error) {
                    console.error(`[${timestamp}] Error handling modal submission in ${command.data?.name || 'unknown'}:`, error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'There was an error handling this submission!', ephemeral: true });
                    }
                    handled = true;
                    break;
                }
            }
        }

        if (!handled) {
            console.warn(`[${timestamp}] No handler found for modal: ${interaction.customId}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'This submission is no longer available.', ephemeral: true });
            }
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
        // Pass args as a fourth parameter for commands that need access to all arguments
        await command.execute(fakeInteraction, sheets, auth, args);
        console.log(`[${timestamp}] Prefix command ${commandName} executed successfully.`);
        
        // React to the message with a checkmark to indicate success
        try {
            await message.react('✅');
        } catch (reactionError) {
            console.error(`[${timestamp}] Failed to add reaction to command message:`, reactionError);
        }
        
        // Delete the command message after 10 seconds to prevent channel bloat
        setTimeout(async () => {
            try {
                await message.delete();
            } catch (deleteError) {
                console.error(`[${timestamp}] Failed to delete command message:`, deleteError);
            }
        }, 10000);
    } catch (error) {
        console.error(`[${timestamp}] Error executing prefix command ${commandName}:`, error);
        
        // React to the message with an X to indicate failure
        try {
            await message.react('❌');
        } catch (reactionError) {
            console.error(`[${timestamp}] Failed to add error reaction to command message:`, reactionError);
        }
        
        // Delete the failed command message after 10 seconds to prevent channel bloat
        setTimeout(async () => {
            try {
                await message.delete();
            } catch (deleteError) {
                console.error(`[${timestamp}] Failed to delete failed command message:`, deleteError);
            }
        }, 10000);
        
        // Provide more detailed error messages for users
        let errorMessage = 'There was an error while executing this command!';
        
        // For stats command specifically, provide more context
        if (commandName === 'stats') {
            // Handle common errors
            if (!args.length) {
                errorMessage = '⚠️ **Error**: Missing player name.\n\nPlease provide a player name. Example: `!stats PlayerName`';
            } else if (error.message?.includes('player not found') || error.message?.includes('not found')) {
                errorMessage = `⚠️ **Error**: Player "${args[0]}" not found.\n\nPlease check the spelling and try again.`;
            } else {
                // Generic error for other cases
                const errorId = `ERR-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                errorMessage = `⚠️ **Error**: There was a problem retrieving player stats.\n\nError ID: ${errorId} - Please report this to an administrator if the issue persists.`;
            }
        }
        
        message.reply(errorMessage);
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
