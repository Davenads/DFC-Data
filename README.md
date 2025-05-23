# DFC-Data Bot

DFC-Data is a Discord bot built to manage and facilitate the Diablo Fighting Championship (DFC) events, hosted by content creator Coooley. The bot is designed to automate the registration process, matchups, and results reporting for weekly PvP events, all while utilizing Google Sheets as the central database.

## Features

- **Player Registration**: Players can register for the DFC using the `/register` command, linking their Discord account with an arena name in the Google Sheets database
- **Tournament Signups**: Registered players can sign up for weekly tournaments using `/signup`, specifying their character class and build preferences
- **Automated Matchmaking**: Tournament managers can generate matchups using the `/matchup` command, creating balanced fight cards based on player signups
- **Results Tracking**: Players can report match outcomes using `/reportwin`, automatically updating player statistics, ELO ratings, and tournament standings
- **Official Rankings**: View current DFC rankings based on tournament performance with `/rankings`, including champion status and top 20 players
- **Player Statistics**: Access detailed player stats including W/L records, winrates, recent matches, and ranking positions using `/stats`
- **Interactive Help System**: Comprehensive help menu with `/help` showing all available commands and their usage
- **Recent Activity Tracking**: Monitor recent tournament signups and player activity with `/recentsignups`
- **Historical Data**: Access rule change history and tournament evolution with `/changelog`

## Folder Structure

```
DFC-DATA/
├── commands/                  # Individual Discord slash command files
│   ├── help.js               # Interactive help menu command
│   ├── register.js           # Player registration command
│   ├── signup.js             # Tournament signup command
│   ├── matchup.js            # Matchmaking command (manager only)
│   ├── reportwin.js          # Match result reporting command
│   ├── rankings.js           # Official DFC rankings command
│   ├── stats.js              # Player statistics command
│   ├── recentsignups.js      # Recent signup tracking command
│   ├── changelog.js          # Rule change history command
│   ├── elo.js                # Legacy ELO rating command (deprecated)
│   ├── rankings-legacy.js    # Legacy rankings command (deprecated)
│   └── stats-legacy.js       # Legacy statistics command (deprecated)
├── handlers/                  # Command loading and management
│   └── commandHandler.js     # Loads and registers all slash commands
├── context/                   # Project documentation and context
│   ├── project-overview.md   # High-level project description
│   ├── architecture.md       # System architecture documentation
│   ├── commands.md           # Detailed command specifications
│   ├── data-flow.md          # Data flow and processing logic
│   ├── dependencies.md       # Dependencies and external services
│   ├── deployment.md         # Deployment instructions and configuration
│   ├── development-guidelines.md # Development standards and practices
│   ├── discord-integration.md # Discord API integration details
│   └── google-sheets-structure.md # Google Sheets schema and structure
├── utils/                     # Utility functions and helpers
│   └── googleAuth.js         # Google Sheets API authentication utilities
├── config/                    # Configuration files (gitignored)
├── .env                       # Environment variables (API keys, tokens)
├── .gitignore                # Git ignore patterns
├── index.js                  # Main bot entry point and Discord client setup
├── deploy-commands.js        # Script to register slash commands with Discord
├── clear-commands.js         # Script to clear registered slash commands
├── LICENSE                   # MIT License
├── package.json              # Node.js dependencies and scripts
├── package-lock.json         # Locked dependency versions
├── Procfile                  # Heroku deployment configuration
├── announcement.md           # Project announcements and updates
└── README.md                 # Project documentation (this file)
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

   **Important Note for Google Private Key:**
   When setting the `GOOGLE_PRIVATE_KEY` in environment variables, especially for hosting platforms like Heroku, you must ensure the private key is properly formatted:

   - **Local Development**: In your `.env` file, surround the private key with double quotes and use `\\n` for newlines:
     ```
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----"
     ```

   - **Heroku Deployment**: Set the private key using the Heroku CLI with the following command:
     ```bash
     heroku config:set GOOGLE_PRIVATE_KEY="$(cat your-key-file.json | jq -r '.private_key')"
     ```
     Alternatively, in the Heroku dashboard, paste the private key exactly as it appears in your JSON file, with actual newlines, not `\n` characters.

   - **Node.js Version**: Ensure your Heroku app uses Node.js 18 or later, as the application requires more recent crypto libraries to work properly with Google authentication.
     ```bash
     heroku stack:set heroku-22
     ```

### Running the Bot

To start the bot, run the following command:
```bash
node index.js
```

## Commands

### Core DFC Commands
- **/help**: Displays an interactive help menu with all available commands and their descriptions
- **/register**: Registers a player for the DFC roster with their Discord account and arena name
- **/signup**: Signs up a registered player for weekly tournaments, specifying class and build details
- **/matchup**: Creates matchups for weekly fight cards (requires manager role permissions)
- **/reportwin**: Reports match results and updates player standings and ELO ratings

### Statistics & Rankings Commands
- **/rankings**: Displays official DFC rankings based on tournament performance with interactive recent matches view
- **/stats**: Shows simplified player statistics including W/L record, winrate, rank, and recent match history
- **/recentsignups**: Views recent tournament signups with pagination, filtered by tournament cutoff dates

### Legacy/Deprecated Commands
These commands are being phased out and are not endorsed by the DFC:
- **/elo**: Views player ELO ratings (deprecated - use `/stats` or `/rankings` instead)
- **/rankings-legacy**: Old rankings system based on ELO metrics (deprecated - use `/rankings` instead)  
- **/stats-legacy**: Legacy player statistics with detailed ELO and Efficiency Index (deprecated - use `/stats` instead)

### Additional Commands
- **/changelog**: Views the history of DFC rule changes with match type filtering

## Google Sheets Integration

The bot uses Google Sheets to store player data, matchups, and results. The `googleConfig.js` file handles Google Sheets API authentication and provides an interface for commands to interact with the Sheets.

### Google Authentication Utilities

The `utils/googleAuth.js` provides utility functions for Google API authentication:

- `getPrivateKey()`: Formats the Google API private key from environment variables by handling various possible formats (escaped newlines, base64 encoded)
- `createGoogleAuth(scopes)`: Creates a Google Auth instance with the necessary credentials and scopes, properly handling the private key format

## Deployment

- **Deploying Commands**: Use `deploy-commands.js` to register the slash commands for your bot in the Discord guild.
- **Clearing Commands**: Use `clear-commands.js` to clear registered commands when necessary.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- **Coooley**: For hosting and organizing the Diablo Fighting Championship.
- **Discord.js**: For providing a great library to interact with the Discord API.
- **Google Cloud**: For enabling easy integration with Google Sheets.

