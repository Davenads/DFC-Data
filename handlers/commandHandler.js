const fs = require('fs');

module.exports = (client) => {
    client.commands = new Map();

    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`../commands/${file}`);

        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            console.log(`Command loaded: ${command.data.name}`);
        } else {
            console.warn(`Skipping invalid command file: ${file}`);
        }
    }

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand()) {
            await handleSlashCommand(interaction, client);
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction, client);
        } else if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction, client);
        }
    });

    async function handleSlashCommand(interaction, client) {
        const command = client.commands.get(interaction.commandName);

        const timestamp = new Date().toISOString();
        const user = interaction.user;
        const guildName = interaction.guild ? interaction.guild.name : 'DM';
        const channelName = interaction.channel ? interaction.channel.name : 'Unknown';
        
        console.log(`[${timestamp}] Command invoked: ${interaction.commandName} 
        User: ${user.tag} (${user.id})
        Server: ${guildName} (${interaction.guildId || 'N/A'})
        Channel: ${channelName} (${interaction.channelId})
        Options: ${JSON.stringify(interaction.options?.data || {})}`);

        if (!command) {
            console.warn(`[${timestamp}] No command found for: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
            console.log(`[${timestamp}] Command ${interaction.commandName} executed successfully.`);
        } catch (error) {
            console.error(`[${timestamp}] Error executing command ${interaction.commandName}:`, error);
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }

    async function handleButtonInteraction(interaction, client) {
        const timestamp = new Date().toISOString();
        const user = interaction.user;
        
        console.log(`[${timestamp}] Button interaction: ${interaction.customId} from ${user.tag} (${user.id})`);

        // Find the command that handles this button
        let handled = false;
        for (const command of client.commands.values()) {
            if (command.handleButton && typeof command.handleButton === 'function') {
                try {
                    await command.handleButton(interaction);
                    if (interaction.replied || interaction.deferred) {
                        console.log(`[${timestamp}] Button interaction handled by ${command.data?.name || 'unknown'}`);
                        handled = true;
                        break;
                    }
                } catch (error) {
                    console.error(`[${timestamp}] Error handling button interaction in ${command.data?.name || 'unknown'}:`, error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'There was an error handling this interaction!', ephemeral: true });
                    }
                    handled = true;
                    break;
                }
            }
        }
        
        if (!handled) {
            console.warn(`[${timestamp}] No handler found for button: ${interaction.customId}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'This interaction is no longer available.', ephemeral: true });
            }
        }
    }

    async function handleAutocomplete(interaction, client) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error('Error handling autocomplete:', error);
        }
    }
};
