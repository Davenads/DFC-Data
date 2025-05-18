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
        if (!interaction.isCommand()) return;

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
    });
};
