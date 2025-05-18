# DFC-Data Bot Commands

## Command Structure
Each command file in the `commands/` directory follows a consistent structure:
```js
module.exports = {
    data: new SlashCommandBuilder()
        .setName('command-name')
        .setDescription('Command description')
        // Additional options defined here
    async execute(interaction, sheets, auth) {
        // Command logic
    },
    // Optional autocomplete handler
    async autocomplete(interaction) {
        // Autocomplete logic
    }
};
```

## Available Commands

### 1. Register Command
**File:** `commands/register.js`
**Purpose:** Register a player for the DFC roster
- Takes a dueler name as input
- Checks if the user is already registered (caches UUID data)
- Adds the player to the Roster sheet
- Returns a confirmation embed

### 2. Signup Command
**File:** `commands/signup.js`
**Purpose:** Sign up a player for the weekly event
- Allows players to sign up for upcoming events
- Players provide their class and build information
- Data is written to the "DFC Bot Signups" tab

### 3. Matchup Command
**File:** `commands/matchup.js`
**Purpose:** Create matchups for weekly events
- Restricted to users with manager role
- Creates match pairings from signed up players
- Updates the fight card in Google Sheets

### 4. ReportWin Command
**File:** `commands/reportwin.js`
**Purpose:** Report match results
- Players report wins for their matches
- Updates match results and player standings

### 5. Rankings Command
**File:** `commands/rankings.js`
**Purpose:** Display player rankings
- Shows current player rankings based on performance
- Data is displayed with pagination (10 players per page)
- Special emojis for top 10 players

### 6. Stats Command
**File:** `commands/stats.js`
**Purpose:** Show player statistics
- Displays individual player performance stats
- Formatted in embeds for clean presentation

### 7. Elo Command
**File:** `commands/elo.js`
**Purpose:** Display or update player ELO ratings
- Shows ELO ratings for players
- May include functionality to recalculate ELO after matches