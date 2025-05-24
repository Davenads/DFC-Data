# DFC-Data Bot Deployment Guide

## Environment Setup

### Required Environment Variables
Create a `.env` file in the root directory with the following variables:
```
BOT_TOKEN=your-discord-bot-token
CLIENT_ID=your-discord-client-id
GUILD_ID=your-discord-guild-id
GOOGLE_CLIENT_EMAIL=your-google-client-email
GOOGLE_PRIVATE_KEY=your-google-private-key
SPREADSHEET_ID=your-google-sheet-id
FORCE_CACHE_REFRESH=false
```

## Command Deployment

### Deploying Commands
The bot uses Discord's slash commands system. Commands need to be registered with the Discord API before they can be used.

```bash
# Deploy all slash commands to the Discord server
node deploy-commands.js
```

### Clearing Commands
If you need to remove commands from the Discord server:

```bash
# Clear all registered slash commands
node clear-commands.js
```

## Running the Bot

### Local Development
```bash
# Start the bot
node index.js
```

### Production Deployment
For production, consider using a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start the bot with PM2
pm2 start index.js --name dfc-data-bot

# View logs
pm2 logs dfc-data-bot

# Restart the bot
pm2 restart dfc-data-bot
```

## Google Sheets Setup

1. Create a Google Cloud project
2. Enable the Google Sheets API
3. Create a Service Account
4. Download the credentials as JSON
5. Share the target Google Spreadsheet with the service account email
6. Add the service account details to your .env file