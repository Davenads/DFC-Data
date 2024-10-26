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

        console.log(`Command invoked: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id})`);

        if (!command) {
            console.warn(`No command found for: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
            console.log(`Command ${interaction.commandName} executed successfully.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error executing command ${interaction.commandName}:`, error);
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    });
};
