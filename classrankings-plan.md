# Implementation Plan: `/classrankings` Command

## Overview
Create a new Discord bot command `/classrankings` that shows class performance statistics and matchup win percentages for a specific division (HLD/LLD/Melee) over a customizable time period. This command addresses Coooley's request for focused competitive data: "best classes ranked by win %" and "matchup win percentages by X class."

## Command Specification

### Command Name
`/classrankings`

### Arguments
1. **division** (required, string choice)
   - HLD - High Level Duel
   - LLD - Low Level Duel
   - Melee

2. **days** (optional, integer)
   - Number of days to analyze
   - Default: 30 days
   - Minimum: 1 day
   - No maximum (users can request all-time stats with large numbers)

### Example Usage
- `/classrankings division:HLD days:30`
- `/classrankings division:LLD days:90`
- `/classrankings division:Melee` (uses default 30 days)

### Prefix Command Support
- `!classrankings hld 30`
- `!classrankings lld`
- `!classrankings melee 90`

## Output Design

### Two-Embed Output Structure
Command returns exactly 2 embeds that directly address Coooley's two requests:

#### Embed 1: Class Rankings by Win %
**Title**: `🏆 Class Rankings by Win % - [Division] - Last X Days`

**Purpose**: Answers "See best classes (ranked by win %) over the last x days"

**Content**:
- Clean ranked list of all 7 classes sorted by win percentage (descending)
- Each line shows: Rank, Class emoji, Class name, W-L record, Win %
- Footer with total duels analyzed and date range

**Format Example**:
```
🏆 Class Rankings by Win % - HLD - Last 30 Days

1. 🔮 Sorceress: 45-30 (60.0%)
2. 🏹 Amazon: 38-28 (57.6%)
3. 💀 Necromancer: 28-26 (51.9%)
4. 🛡️ Paladin: 25-25 (50.0%)
5. 🐻 Druid: 20-22 (47.6%)
6. ⚔️ Barbarian: 18-24 (42.9%)
7. 🗡️ Assassin: 15-25 (37.5%)

📊 156 total duels analyzed • Oct 29 - Nov 28, 2025
```

**Design Notes**:
- Simple, scannable format for quick reference
- One line per class for mobile-friendly viewing
- Shows W-L record AND win % for full context

#### Embed 2: Head-to-Head Matchup Win Rates
**Title**: `🎯 Head-to-Head Matchup Win Rates - [Division]`

**Purpose**: Answers "See matchup win percentages by X class in the last x days"

**Content**:
- Compact matchup breakdown for each class
- Each line shows one class with all its matchup win rates in a single row
- Format: `Class: vs Opp1 X% | vs Opp2 Y% | vs Opp3 Z%`
- Only shows matchups that have occurred (skips 0-0 matchups)

**Format Example**:
```
🎯 Head-to-Head Matchup Win Rates - HLD

🔮 Sorceress: vs Amz 60% | vs Nec 60% | vs Pal 67% | vs Barb 53% | vs Dru 58%
🏹 Amazon: vs Sor 40% | vs Nec 61% | vs Pal 71% | vs Barb 55% | vs Dru 67%
💀 Necromancer: vs Sor 40% | vs Amz 39% | vs Pal 55% | vs Barb 48% | vs Asn 65%
🛡️ Paladin: vs Sor 33% | vs Amz 29% | vs Nec 45% | vs Barb 60% | vs Dru 52%
🐻 Druid: vs Sor 42% | vs Amz 33% | vs Pal 48% | vs Barb 70%
⚔️ Barbarian: vs Sor 47% | vs Amz 45% | vs Nec 52% | vs Pal 40% | vs Dru 30%
🗡️ Assassin: vs Nec 35% | vs Pal 50%
```

**Design Notes**:
- Compact format keeps all matchup data visible without scrolling
- Abbreviated opponent names (3-4 chars) for space efficiency
- Only displays matchups with >0 games played
- Percentages rounded to whole numbers for readability

## Technical Implementation

### File Creation
**New file**: `/home/davenads/Projects/DFC-Data/commands/classrankings.js`

### Data Flow

1. **Fetch Data from Cache**
   ```javascript
   const duelRows = await duelDataCache.getCachedData();
   ```
   - Use existing `duelDataCache` module (follows pattern from dueltrends.js:86)
   - Automatic Redis → Google Sheets fallback

2. **Filter by Date Range**
   ```javascript
   const cutoffDate = new Date();
   cutoffDate.setDate(cutoffDate.getDate() - actualDays);
   const filteredMatches = duelRows.filter(row => {
     const matchDate = new Date(row[0]); // Event Date column
     return matchDate >= cutoffDate && row[8] === division; // row[8] = Match Type
   });
   ```

3. **Build Class Statistics**

   Create data structures to track:

   **Overall Class Stats**:
   ```javascript
   const classStats = {
     'amazon': { wins: 0, losses: 0, totalMatches: 0 },
     'sorceress': { wins: 0, losses: 0, totalMatches: 0 },
     // ... for all 7 classes
   };
   ```

   **Head-to-Head Matchup Stats**:
   ```javascript
   const matchupStats = {
     'amazon': {
       'sorceress': { wins: 0, losses: 0 },
       'necromancer': { wins: 0, losses: 0 },
       // ... vs each opponent
     },
     // ... for all classes
   };
   ```

4. **Process Each Match**
   ```javascript
   for (const match of filteredMatches) {
     const winnerClass = (match[2] || '').toLowerCase(); // row[2] = Winner Class
     const loserClass = (match[5] || '').toLowerCase();  // row[5] = Loser Class

     if (!winnerClass || !loserClass) continue;

     // Update overall stats
     classStats[winnerClass].wins += 1;
     classStats[winnerClass].totalMatches += 1;
     classStats[loserClass].losses += 1;
     classStats[loserClass].totalMatches += 1;

     // Update head-to-head stats
     matchupStats[winnerClass][loserClass].wins += 1;
     matchupStats[loserClass][winnerClass].losses += 1;
   }
   ```

5. **Calculate Win Percentages**
   ```javascript
   const classRankings = Object.entries(classStats)
     .map(([className, stats]) => {
       const totalGames = stats.wins + stats.losses;
       const winRate = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : '0.0';
       return {
         className,
         wins: stats.wins,
         losses: stats.losses,
         totalMatches: stats.totalMatches,
         winRate: parseFloat(winRate)
       };
     })
     .sort((a, b) => b.winRate - a.winRate); // Sort by win rate descending
   ```

6. **Build Embeds**
   - Use `EmbedBuilder` from discord.js
   - Apply class emojis using `getClassEmoji()` from utils/emojis.js
   - Format percentages to 1 decimal place
   - Include timestamps and footers

7. **Build Matchup Display Strings**
   ```javascript
   // For each class, build compact matchup string
   const matchupStrings = {};
   for (const [className, opponents] of Object.entries(matchupStats)) {
     const matchupParts = [];
     for (const [oppClass, record] of Object.entries(opponents)) {
       const totalGames = record.wins + record.losses;
       if (totalGames > 0) {
         const winRate = Math.round((record.wins / totalGames) * 100);
         const oppAbbrev = oppClass.substring(0, 3).charAt(0).toUpperCase() + oppClass.substring(1, 3);
         matchupParts.push(`vs ${oppAbbrev} ${winRate}%`);
       }
     }
     matchupStrings[className] = matchupParts.join(' | ');
   }
   ```

8. **Send Response (2 Embeds)**
   ```javascript
   await interaction.editReply({ embeds: [embed1], ephemeral: true });
   await interaction.followUp({ embeds: [embed2], ephemeral: true });
   ```

### Key Column References (Duel Data Sheet)
- `row[0]` - Event Date (for time filtering)
- `row[1]` - Winner Name
- `row[2]` - Winner Class (PRIMARY DATA SOURCE)
- `row[4]` - Loser Name
- `row[5]` - Loser Class (PRIMARY DATA SOURCE)
- `row[8]` - Match Type (HLD/LLD/Melee filter)

### Validation & Edge Cases

1. **Empty Dataset**: If no matches found in time range/division
   ```
   "No duels found for [Division] in the last X days."
   ```

2. **Date Range Limitation**: If requested days exceeds available data
   ```
   "Showing all available data (X days) - requested Y days but data only goes back to [date]"
   ```

3. **Class Name Normalization**: Convert to lowercase for consistent comparison
   ```javascript
   const normalizedClass = (match[2] || '').toLowerCase();
   ```

4. **Missing Data**: Skip matches with missing class or match type data
   ```javascript
   if (!winnerClass || !loserClass || !matchType) continue;
   ```

5. **Zero-Match Classes**: Display all 7 classes even if some have 0 matches
   ```
   "Druid: 0W-0L (N/A) • 0 total matches"
   ```

## Code Structure

### Module Exports
```javascript
module.exports = {
  data: SlashCommandBuilder,
  async execute(interaction, sheets, auth, prefixArgs = []) {
    // Implementation
  }
};
```

### Execution Flow
1. Parse arguments (slash vs prefix command detection)
2. Log command execution details
3. Defer reply (`ephemeral: true`)
4. Fetch cached duel data
5. Filter by date range and division
6. Build class statistics objects
7. Calculate win percentages and rankings
8. Create embeds with formatted data
9. Send initial reply + follow-up embeds
10. Log completion

### Error Handling
```javascript
try {
  // Main logic
} catch (error) {
  console.error(`[${timestamp}] Error in classrankings:`, error);
  await interaction.editReply({
    content: 'There was an error analyzing class rankings. Please try again later.',
    ephemeral: true
  });
}
```

## Dependencies

### Existing Modules (No Changes Required)
- `discord.js` (SlashCommandBuilder, EmbedBuilder)
- `utils/duelDataCache.js` - Data fetching with Redis fallback
- `utils/emojis.js` - Class emoji rendering
- `handlers/commandHandler.js` - Automatic command loading

### Reference Patterns From Existing Files
| Pattern | Reference File | Lines |
|---------|---------------|-------|
| Command structure | `/commands/dueltrends.js` | 6-22 |
| Date filtering | `/commands/dueltrends.js` | 115-135 |
| Slash/prefix detection | `/commands/dueltrends.js` | 24-65 |
| Match type filtering | `/commands/dueltrends.js` | 129-131 |
| Win rate calculation | `/commands/stats.js` | 405-416 |
| Embed creation | `/commands/stats.js` | 341-425 |
| Multi-embed sending | `/commands/dueltrends.js` | 358-366 |
| Error handling | `/commands/stats.js` | 633-663 |
| Logging format | `/commands/dueltrends.js` | 75-80 |

## Testing Checklist

### Functional Tests
- [ ] Slash command with required division argument
- [ ] Slash command with optional days argument
- [ ] Prefix command variants (!classrankings hld, !classrankings lld 90)
- [ ] Default days value (30) when not specified
- [ ] All three divisions (HLD, LLD, Melee)
- [ ] Large days value for all-time analysis (e.g., 5000)
- [ ] Small days value (1 day)

### Edge Cases
- [ ] Date range exceeds available data
- [ ] No matches found for division/timeframe
- [ ] Division with very few matches
- [ ] Class with zero matches in timeframe
- [ ] Redis unavailable (fallback to Google Sheets)
- [ ] Invalid date formats in dataset

### Output Validation
- [ ] Class rankings sorted by win % correctly
- [ ] Win/loss counts match expected totals
- [ ] Percentages calculate correctly (wins/total)
- [ ] Matchup breakdown shows both sides of matchup
- [ ] Emojis render correctly for all classes
- [ ] Timestamps and footers display properly
- [ ] Ephemeral responses (only visible to user)

### Permissions & Roles
- [ ] No special role requirements (available to all users)
- [ ] Works in both test and production environments
- [ ] Prefix command messages auto-delete after 10 seconds

## Deployment Steps

1. Create `/commands/classrankings.js` with full implementation
2. Test locally in development environment
3. Deploy command to Discord:
   ```bash
   node deploy-commands.js
   ```
4. Test in test server (TEST_MODE=true)
5. Verify against production data
6. Push to GitHub main branch (triggers Heroku auto-deploy)
7. Verify command appears in production Discord server

## Future Considerations

### Potential Enhancements (Not in Initial Scope)
- Build-level breakdowns (e.g., "Javazon vs Nova Sorc")
- Statistical significance indicators (sample size warnings)
- Win rate trend over time (e.g., "up 5% from last month")
- Export to CSV/image functionality
- Interactive filtering via buttons/dropdowns
- Comparison view (e.g., "HLD vs LLD meta differences")

### Relationship to `/dueltrends`
- **dueltrends**: Shows **popularity** (what's being played most)
- **classrankings**: Shows **performance** (what's winning most)
- Decision pending with Coooley: deploy both or replace one

### Command Naming Alternatives (If Needed Later)
- `/winrates`
- `/classwinrates`
- `/performance`
- `/classperformance`
- `/competitivestats`

## Success Criteria

The command is complete when:
1. Command deploys successfully to Discord
2. Takes division (required) and days (optional) arguments
3. Shows class performance rankings with W/L and win %
4. Shows per-class matchup breakdown with head-to-head stats
5. Filters data correctly by division and time range
6. Handles edge cases gracefully (no data, date limits, etc.)
7. Follows existing code patterns and style
8. Works for both slash and prefix command invocations
9. Outputs are ephemeral and properly formatted
10. Tested in both test and production environments

## Implementation Notes

- Use lowercase class name comparison for consistency
- Follow existing logging patterns for debugging
- Maintain ephemeral responses for user privacy
- Support both slash and prefix command styles
- No role restrictions (available to all users)
- Cache-first approach with automatic fallback
- Clean, readable embed formatting
- Comprehensive error handling
