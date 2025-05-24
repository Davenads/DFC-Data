# Google Sheets Structure for DFC-Data Bot

## Overview
The bot interacts with a Google Spreadsheet to store and manage all data related to the Diablo Fighting Championship events. The spreadsheet serves as the database for the application.

## Spreadsheet Tabs

### Roster Tab
**Purpose**: Stores all registered players
**Key Columns**:
- **A**: Dueler Name (in-game name)
- **B**: Display Name (name shown in rankings) 
- **C**: Discord Name (username from Discord)
- **D**: Discord UUID (unique user ID from Discord)

**Access Pattern**:
- Read: Check if a user is registered
- Write: Add new user registrations

### DFC Bot Signups Tab
**Purpose**: Tracks player signups for weekly events
**Key Columns**:
- Player Name
- Class
- Build
- Signup Time
- Discord UUID

**Access Pattern**:
- Read: Get list of signed-up players
- Write: Add new signups

### Match Results Tab
**Purpose**: Stores fight results
**Key Columns**:
- Winner
- Loser
- Date/Time
- Match ID/Reference

**Access Pattern**:
- Read: Check match history
- Write: Record match outcomes

### Rankings Tab
**Purpose**: Shows current player standings
**Key Columns**:
- Rank
- Player Name
- Wins
- Losses
- Win Rate
- ELO Rating (if implemented)

**Access Pattern**:
- Read: Display rankings to users
- Write: Update after matches

## API Interactions

### Reading Data
```js
// Example for reading roster data
const res = await sheets.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'Roster!A:D',
});
const roster = res.data.values || [];
```

### Writing Data
```js
// Example for adding a new player registration
await sheets.spreadsheets.values.update({
    auth: authClient,
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `Roster!A${nextRow}:D${nextRow}`,
    valueInputOption: 'RAW',
    requestBody: {
        values: [[duelerName, duelerName, discordName, userId]],
    },
});
```

### Appending Data
```js
// Example for adding a new signup
await sheets.spreadsheets.values.append({
    auth: authClient,
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'DFC Bot Signups!A:E',
    valueInputOption: 'RAW',
    requestBody: {
        values: [[playerName, playerClass, playerBuild, new Date().toISOString(), userId]],
    },
});
```

## Data Formats

### Player Data
- Discord UUIDs are used as unique identifiers
- Names are stored as plain text
- Timestamps are stored in ISO format

### Match Data
- Match IDs may be generated for reference
- Results stored with explicit winner/loser information