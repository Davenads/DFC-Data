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

### 8. Recent Duels Command
**File:** `commands/recentduels.js`
**Purpose:** Display recent duels from the last X days
- Shows duels from the last 1-30 days (defaults to 7 days)
- Displays match details including winner/loser, classes, builds, and dates
- Uses cached data for improved performance
- Supports multiple embeds for large result sets
- Ephemeral responses to reduce channel spam

### 9. Recent Signups Command
**File:** `commands/recentsignups.js`
**Purpose:** View recent tournament signups
- Shows signups since the most recent Thursday 6:00 PM ET cutoff
- Displays Discord handle, division, character class, and build type
- Includes pagination with navigation buttons for large lists
- Uses class-specific emojis for visual enhancement
- Ephemeral responses with interactive pagination

### 10. Refresh Cache Command
**File:** `commands/refreshcache.js`
**Purpose:** Manually refresh the Duel Data cache
- Restricted to users with @Moderator role
- Forces a manual refresh of the cached duel data
- Shows before/after cache timestamps and row counts
- Useful for immediate data updates without waiting for scheduled refresh
- Provides detailed success/error feedback

### 11. Changelog Command
**File:** `commands/changelog.js`
**Purpose:** View the history of DFC rule changes
- Displays rule changes from changelog.json data file
- Shows changes sorted by date (newest first)
- Includes match type indicators (HLD, Melee, All) with emojis
- Splits long changelogs into multiple messages to avoid Discord limits
- For slash commands: ephemeral responses, for prefix: sends via DM

### 12. Duel Trends Command
**File:** `commands/dueltrends.js`
**Purpose:** Analyze duel trends and statistics over a specified time period
- Takes optional days parameter (1-90, defaults to 30 days)
- Displays 2-3 embeds with comprehensive trend analysis:
  - **Build & Class Trends**: Most popular builds and class distribution
  - **Matchup Analysis**: Common class matchups with win rate breakdowns  
  - **General Statistics**: Total duels, active players, most active participants
- Uses cached duel data for fast analysis
- Calculates percentages, win rates, and usage statistics
- Ephemeral responses with tip for parameter usage