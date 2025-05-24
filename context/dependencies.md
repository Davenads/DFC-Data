# DFC-Data Bot Dependencies

## Core Dependencies

### Discord.js (v14.16.3)
- Main library for interacting with the Discord API
- Handles WebSocket connections, command interactions, and message formatting
- [Documentation](https://discord.js.org/)

### Google APIs (googleapis v144.0.0)
- Library for interacting with Google Services
- Used specifically for Google Sheets integration
- [Documentation](https://github.com/googleapis/google-api-nodejs-client)

### Dotenv (v16.4.5)
- Loads environment variables from a .env file
- Used to securely store credentials and configuration
- [Documentation](https://github.com/motdotla/dotenv)

### Node-Cache (v5.1.2)
- In-memory caching to reduce API calls to Google Sheets
- Used primarily for caching player data and UUIDs
- [Documentation](https://github.com/node-cache/node-cache)

### @discordjs/rest (v2.4.0)
- REST API client for Discord
- Used for registering and managing slash commands
- [Documentation](https://github.com/discordjs/discord.js/tree/main/packages/rest)

## API Interactions

### Discord API
- Used for bot authentication and slash command interactions
- Requires bot token and permissions
- Command registration is done via REST API

### Google Sheets API
- Used for reading/writing player data and match results
- Authentication via service account credentials
- Requires read/write access to the specific spreadsheet

## Project Structure Dependencies

### Command Handler
- Loads commands from the commands/ directory
- Registers event listeners for interactions
- Provides a modular way to add new commands

### Command Deployment
- deploy-commands.js registers slash commands with Discord
- clear-commands.js removes registered commands
- Both scripts use the Discord REST API