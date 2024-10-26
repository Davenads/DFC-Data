# DFC-Data Bot

DFC-Data is a Discord bot built to manage and facilitate the Diablo Fighting Championship (DFC) events, hosted by content creator Coooley. The bot is designed to automate the registration process, matchups, and results reporting for weekly PvP events, all while utilizing Google Sheets as the central database.

## Features

- **Registration**: Players can register themselves for the DFC event using the `/register` command, which adds them to the roster stored in Google Sheets.
- **Signup for Events**: Players can sign up for weekly events using the `/signup` command, specifying their class and build.
- **Matchup Creation**: Managers can create matchups for weekly events using the `/matchup` command, populating the fight card in Google Sheets.
- **Win Reporting**: Players can report the results of matches using the `/reportwin` command, which updates the duel data accordingly.

## Folder Structure

```
DFC-DATA/
├── commands/            # Contains individual command files
│   ├── matchup.js
│   ├── register.js
│   ├── reportwin.js
│   └── signup.js
├── handlers/            # Handlers to load commands
│   └── commandHandler.js
├── config/              # Configuration files for credentials and settings
│   └── googleConfig.js
├── .env                 # Environment variables (API keys, tokens)
├── .gitignore           # To exclude node_modules, .env, etc.
├── index.js             # Main entry point of the bot
├── LICENSE              # License information
├── package.json         # Node.js dependencies
└── README.md            # Information about the bot
```

## Setup

### Prerequisites

- **Node.js**: Ensure Node.js is installed on your system.
- **Discord Developer Application**: Create a Discord application and bot token at [Discord Developer Portal](https://discord.com/developers/applications).
- **Google API Credentials**: Set up a Google Cloud project and create credentials for accessing Google Sheets.

### Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd DFC-DATA
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` File**
   Create a `.env` file in the root directory and add the following environment variables:
   ```
   BOT_TOKEN=your-discord-bot-token
   CLIENT_ID=your-discord-client-id
   GUILD_ID=your-discord-guild-id
   GOOGLE_CLIENT_EMAIL=your-google-client-email
   GOOGLE_PRIVATE_KEY=your-google-private-key
   SHEET_ID=your-google-sheet-id
   ```

### Running the Bot

To start the bot, run the following command:
```bash
node index.js
```

## Commands

- **/register**: Registers a player for the DFC roster.
- **/signup**: Signs up a player for the weekly event, with class and build options.
- **/matchup**: Creates matchups for the weekly fight card (requires manager role).
- **/reportwin**: Reports the result of a match and updates standings.

## Google Sheets Integration

The bot uses Google Sheets to store player data, matchups, and results. The `googleConfig.js` file handles Google Sheets API authentication and provides an interface for commands to interact with the Sheets.

## Deployment

- **Deploying Commands**: Use `deploy-commands.js` to register the slash commands for your bot in the Discord guild.
- **Clearing Commands**: Use `clear-commands.js` to clear registered commands when necessary.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- **Coooley**: For hosting and organizing the Diablo Fighting Championship.
- **Discord.js**: For providing a great library to interact with the Discord API.
- **Google Cloud**: For enabling easy integration with Google Sheets.

