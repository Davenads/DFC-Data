# Discord Integration for DFC-Data Bot

## Bot Setup

### Application Configuration
The DFC-Data bot requires a Discord application with the following settings:
- Bot user enabled
- Required intents:
  - GUILDS
  - GUILD_MEMBERS
  - GUILD_MESSAGES
  - MESSAGE_CONTENT
- Privileged Gateway Intents enabled as needed
- OAuth2 URL generated with proper permissions

### Required Permissions
- Read Messages/View Channels
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands

### Discord Authentication
Authentication is handled via the BOT_TOKEN environment variable:

```js
client.login(process.env.BOT_TOKEN);
```

## Slash Commands Integration

### Command Registration
Commands are registered using the deploy-commands.js script:

```js
const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);
await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
);
```

### Command Structure
Each command is defined using the SlashCommandBuilder:

```js
new SlashCommandBuilder()
    .setName('command-name')
    .setDescription('Command description')
    // Additional options
```

### Command Handling
Commands are processed in the interactionCreate event:

```js
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        
        try {
            await command.execute(interaction, sheets, auth);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error executing command', ephemeral: true });
        }
    }
});
```

## Rich Embeddings

Many commands use Discord's EmbedBuilder to create rich, formatted responses:

```js
const embed = new EmbedBuilder()
    .setTitle('Title')
    .setColor('#FF4500')
    .setDescription('Description')
    .addFields(
        { name: 'Field Name', value: 'Field Value', inline: true }
    )
    .setFooter({ text: 'Footer Text' });

await interaction.reply({ embeds: [embed] });
```

## Role-Based Command Access

Some commands are restricted to specific roles:

```js
if (command.role && !interaction.member.roles.cache.some(role => role.name === command.role)) {
    return interaction.reply({
        content: `You do not have the required ${command.role} role to use this command.`,
        ephemeral: true
    });
}
```

## Autocomplete Support

The bot supports Discord's autocomplete feature for command options:

```js
client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }
});
```