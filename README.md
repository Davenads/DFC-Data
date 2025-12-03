# DFC-Data Bot

DFC-Data is a Discord bot built to manage and facilitate the Diablo Fighting Championship (DFC) events, hosted by content creator Coooley. The bot is designed to automate the registration process, matchups, and results reporting for weekly PvP events, all while utilizing Google Sheets as the central database.

## Features

- **Player Registration**: Players can register for the DFC using the `/register` command, linking their Discord account with an arena name in the Google Sheets database
- **Tournament Signups**: Registered players can sign up for weekly tournaments using `/signup`, specifying their character class and build preferences
- **Results Tracking**: Players can report match outcomes using `/reportwin`, automatically updating player statistics and tournament standings
- **Official Rankings**: View current DFC rankings based on tournament performance with `/rankings`, including champion status and top 20 players
- **Player Statistics**: Access detailed player stats including W/L records, winrates, recent matches, and ranking positions using `/stats`
- **Duel Trends Analysis**: Analyze match trends over custom time periods with `/dueltrends`, including build popularity, class matchups, and win rates
- **Interactive Help System**: Comprehensive help menu with `/help` showing all available commands and their usage
- **Recent Activity Tracking**: Monitor recent tournament signups and duels with `/recentsignups` and `/recentduels`
- **Historical Data**: Access rule change history and tournament evolution with `/changelog`
- **Discord Sync**: Moderators can check for roster username mismatches with `/namesync` to maintain data accuracy

## Folder Structure

```
DFC-DATA/
├── commands/                  # Individual Discord slash command files
│   ├── help.js               # Interactive help menu command
│   ├── register.js           # Player registration command
│   ├── signup.js             # Tournament signup command
│   ├── reportwin.js          # Match result reporting command
│   ├── rankings.js           # Official DFC rankings command
│   ├── classrankings.js      # Class-specific rankings with win rate analysis
│   ├── stats.js              # Player statistics command
│   ├── recentsignups.js      # Recent signup tracking command
│   ├── recentduels.js        # Recent duels tracking command
│   ├── dueltrends.js         # Duel trends and statistics analysis command
│   ├── fightcard.js          # Fight card display command
│   ├── rules.js              # DFC tournament rules command
│   ├── namesync.js           # Discord username sync checker command (moderator only)
│   ├── refreshcache.js       # Cache refresh command (moderator only)
│   ├── testnotification.js   # Test signup notification command (moderator only)
│   ├── changelog.js          # Rule change history command
│   ├── rankings-legacy.js    # Legacy rankings command (deprecated)
│   └── archived/             # Archived commands (no longer deployed)
│       ├── matchup.js        # Matchmaking command (archived)
│       ├── elo.js            # ELO rating command (archived)
│       └── stats-legacy.js   # Legacy statistics command (archived)
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
│   ├── googleAuth.js         # Google Sheets API authentication utilities
│   ├── auditLogger.js        # Command execution audit logging
│   ├── signupNotifications.js # Automated tournament signup notifications
│   ├── redisClient.js        # Redis connection and client management
│   ├── duelDataCache.js      # Match history caching layer
│   ├── rosterCache.js        # Player roster caching layer
│   ├── rankingsCache.js      # Official rankings caching layer
│   ├── signupsCache.js       # Tournament signups caching layer
│   ├── rulesCache.js         # Tournament rules caching layer
│   ├── playerListCache.js    # Player autocomplete data caching
│   ├── emojis.js             # Custom Discord emoji mappings
│   ├── rulesParser.js        # Google Docs rules parsing utility
│   └── signupCache.js        # Signup session state management
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
- **/reportwin**: Reports match results and updates player standings and ELO ratings

### Statistics & Rankings Commands
- **/rankings**: Displays official DFC rankings based on tournament performance with interactive recent matches view
- **/classrankings**: Shows class-specific rankings with win rate analysis across match types (HLD/LLD/Melee/Teams)
- **/stats**: Shows simplified player statistics including W/L record, winrate, rank, and recent match history
- **/recentsignups**: Views recent tournament signups with pagination, filtered by tournament cutoff dates
- **/recentduels**: Shows recent duels from the last X days (1-30 days, defaults to 7) with match details and class information
- **/dueltrends**: Analyzes duel trends and statistics over a specified time period, showing build/class trends, matchup analysis, and general statistics
- **/fightcard**: Displays the current fight card with upcoming matches, showing player matchups and divisions (HLD/LLD/Melee)

### Legacy/Deprecated Commands
- **/rankings-legacy**: Old rankings system based on ELO metrics (deprecated - use `/rankings` instead)

### Archived Commands (No Longer Available)
These commands have been archived and are no longer deployed:
- **/matchup**: Matchmaking command (archived - feature discontinued)
- **/elo**: ELO rating command (archived - backend no longer supports logic)
- **/stats-legacy**: Legacy player statistics with detailed ELO and Efficiency Index (archived - use `/stats` instead)

### Additional Commands
- **/rules**: Displays current DFC tournament rules and regulations
- **/changelog**: Views the history of DFC rule changes with match type filtering
- **/namesync**: Checks for Discord username mismatches in the roster (requires Moderator role)
- **/refreshcache**: Manually refreshes the Redis cache for duel data (requires Moderator role)
- **/testnotification**: Manually triggers a test signup notification to verify notification system (requires Moderator role)

## Google Sheets Integration

The bot uses Google Sheets to store player data, matchups, and results. The `googleConfig.js` file handles Google Sheets API authentication and provides an interface for commands to interact with the Sheets.

## Utility Modules

The bot uses several utility modules to handle caching, authentication, and automation:

### Google Authentication (`utils/googleAuth.js`)
- `getPrivateKey()`: Formats the Google API private key from environment variables by handling various possible formats (escaped newlines, base64 encoded)
- `createGoogleAuth(scopes)`: Creates a Google Auth instance with the necessary credentials and scopes, properly handling the private key format

### Caching System
The bot implements a Redis-based caching layer with Google Sheets fallback for optimal performance:

- **`utils/redisClient.js`**: Manages Redis connection and client lifecycle
- **`utils/duelDataCache.js`**: Caches match history data from the "Duel Data" sheet (2100+ rows)
- **`utils/rosterCache.js`**: Caches player roster (Arena Name ↔ Discord ID mapping)
- **`utils/rankingsCache.js`**: Caches official DFC rankings by division
- **`utils/signupsCache.js`**: Caches recent tournament signup submissions
- **`utils/rulesCache.js`**: Caches tournament rules from Google Docs
- **`utils/playerListCache.js`**: Caches player autocomplete data for slash commands
- **`utils/signupCache.js`**: Manages temporary signup session state during multi-step signup flow

**Cache Refresh Schedule:**
- Thursday 5:30 PM ET
- Friday 2:00 AM ET
- Friday 11:00 PM ET
- Manual refresh via `/refreshcache` command

### Automated Notifications (`utils/signupNotifications.js`)
Sends automated Discord notifications for tournament signup windows:
- **Friday 12:00 AM ET**: "Signups Now Open" notification
- **Tuesday 5:00 PM ET**: "Signup Closing Soon" notification
- **Permission-based fallback**: Automatically posts to fallback channel if primary channel is inaccessible
- **Audit logging**: Logs all notification attempts to audit channel for monitoring

### Audit Logging (`utils/auditLogger.js`)
Logs all slash command executions to a dedicated audit channel in production:
- Command name, user, channel, and timestamp
- Execution duration and success/failure status
- Command arguments and error messages
- Production environment only

### Other Utilities
- **`utils/emojis.js`**: Centralized custom Discord emoji mappings for classes and match types
- **`utils/rulesParser.js`**: Parses and formats tournament rules from Google Docs API

## Deployment

- **Deploying Commands**: Use `deploy-commands.js` to register the slash commands for your bot in the Discord guild.
- **Clearing Commands**: Use `clear-commands.js` to clear registered commands when necessary.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- **Coooley**: For hosting and organizing the Diablo Fighting Championship.
- **Discord.js**: For providing a great library to interact with the Discord API.
- **Google Cloud**: For enabling easy integration with Google Sheets.

