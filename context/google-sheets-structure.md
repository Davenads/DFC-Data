# Google Sheets Structure for DFC-Data Bot

**Last Updated**: November 2025
**Status**: Updated with full SSoT access

---

## Overview

The DFC-Data bot uses **two primary Google Sheets** with a **distributed SSoT (Single Source of Truth) architecture**. Each sheet is authoritative for different data domains:

### 1. **[DFC] Official Rankings** (QUERY_SPREADSHEET_ID)
**SSoT Domains:**
- ⭐ **Roster** - Player registration (Arena Name ↔ Discord mapping)
- ⭐ **Signups** - Weekly tournament signups (via Google Forms)

**Additional Functions:**
- Display/query sheet for bot commands
- Mirrors Duel Data from [DFC] Data Input via IMPORTRANGE

### 2. **[DFC] Data Input** (PROD_SSOT_ID)
**SSoT Domains:**
- ⭐ **Duel Data** - Match results, ETL transformations, statistics

**Additional Functions:**
- Raw data processing and ETL transformations
- Mirrors Roster and Signups from [DFC] Official Rankings via IMPORTRANGE

**⚠️ Important**: The sheet naming is confusing! "[DFC] Data Input" suggests it's the main SSoT, but it's ONLY authoritative for **duel/match data**. Roster and signup data originate in "[DFC] Official Rankings".

---

### Data Domain Authority (Quick Reference):

| Data Domain | SSoT Sheet | SSoT Tab | Mirror Sheet | Mirror Tab | Data Flow Direction |
|-------------|------------|----------|--------------|------------|---------------------|
| **Roster** | [DFC] Official Rankings | Roster | [DFC] Data Input | Roster | Official Rankings → Data Input |
| **Signups** | [DFC] Official Rankings | DFC Signups / DFC Recent Signups | [DFC] Data Input | Recent Signups | Official Rankings → Data Input |
| **Duel Data** | [DFC] Data Input | Duel Data / DUEL_DATA_OUTPUT | [DFC] Official Rankings | Duel Data | Data Input → Official Rankings |

**Key Principles:**
- Each domain has ONE authoritative source (SSoT)
- Mirror copies exist for redundancy and cross-sheet analytics
- IMPORTRANGE formulas keep mirrors synchronized
- Bot write operations ONLY target SSoT tabs
- Bot read operations can use either SSoT or cache

This architecture provides data redundancy, enables external analytics, and allows different teams to manage different data domains.

---

## Environment Variables & Sheet IDs

### Production Environment (`TEST_MODE=false`)

| Variable | Sheet ID | Sheet Name | Purpose |
|----------|----------|------------|---------|
| `PROD_SSOT_ID` | `19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw` | [DFC] Data Input | SSoT with raw data and transformations |
| `QUERY_SPREADSHEET_ID` | `17PlXUTm83d8YjtKfG9hl0Y6gpzBhKwa7iYLjN0mi4Cg` | [DFC] Official Rankings | Display sheet for bot queries |
| `SPREADSHEET_ID` | `1ApQkP-EqC77MK1udc2BNF5eTMpa95pp14Xmtbd20RPA` | Legacy ELO Sheet | Legacy ELO ratings (deprecated) |
| `PROD_FORM_ID` | `1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg` | Google Form | Match results and signup submissions |

### Test Environment (`TEST_MODE=true`)

| Variable | Sheet ID | Sheet Name | Purpose |
|----------|----------|------------|---------|
| `TEST_SSOT_ID` | `137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms` | [DFC] Data Input (Test) | Test environment SSoT |
| `TEST_FORM_ID` | `1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A` | Google Form (Test) | Test form submissions |
| `TEST_SPREADSHEET_ID` | `1PYqFqOuIF3NOchuyLsIBjVd8DDMM7OSrpHneZkbpJT0` | Legacy Test Sheet | Legacy test environment |

---

## Sheet 1: [DFC] Official Rankings (Roster + Signup SSoT)

**Sheet ID**: `17PlXUTm83d8YjtKfG9hl0Y6gpzBhKwa7iYLjN0mi4Cg`
**Environment Variable**: `QUERY_SPREADSHEET_ID`

**SSoT Responsibilities** (Authoritative Data):
- ⭐ **Roster** - Player registration and Discord mapping
- ⭐ **DFC Signups** - Raw signup form responses (all-time)
- ⭐ **DFC Recent Signups** - Processed signups (last 10 days)

**Additional Functions**:
- Display/query sheet for bot commands
- IMPORTRANGE formulas pull **Duel Data** from [DFC] Data Input for analytics

### Tabs (SSoT Tabs ⭐ | Mirror Tabs)

#### 1. Roster (SSoT) ⭐ **ROSTER SSoT**
**Purpose**: Master roster of all registered DFC players
**Location**: [DFC] Official Rankings (QUERY_SPREADSHEET_ID)
**Note**: This is the SOURCE OF TRUTH for roster data

**Columns** (A-K):
- **A**: Arena Name (in-game Diablo 2 character name)
- **B**: Data Name (display name for rankings)
- **C**: Discord Name (current Discord username) ← **Update target for handle changes**
- **D**: UUID (Discord user ID - unique identifier) ← **Stable identifier**
- **E**: DFC Role (role status)
- **F**: Champion (champion status)
- **G**: Current Champ (current champion flag)
- **H**: Title (player title)
- **I**: Notes (additional notes)
- **J**: Leave Status (AFK/Leave/Banned flags)
- **K**: Additional metadata

**Bot Access**:
- **Read**: `rosterCache.js` (range: `Roster!A2:J500`)
- **Write**: `register.js` command (appends new players)
- **Used By**: `/register`, `/signup`, `/reportwin`, `/namesync`, `/stats`
- **IMPORTRANGE'd into**: '[DFC] Data Input' "Roster" tab (mirror)

**Data Flow**:
- `/register` command → Appends to this tab
- Cache reads from this tab → Redis
- `namesync` validates against this tab
- **Roster reconciliation script updates Column C here**

#### 2. Duel Data (IMPORTRANGE)
**Formula**: `=IMPORTRANGE("https://docs.google.com/spreadsheets/d/19KLEQ3MDKHbDH9898E2zYtEBdzzTViWNMMQLJQB6swM", "QUELL_DATA_OUTPUT!J2:Y")`

**Note**: This pulls from the **DUEL_DATA_OUTPUT** tab (19 columns) of the SSoT sheet after ETL transformation.

**Columns** (J-Y from source):
1. Duel_ID (e.g., `D0001`, `D0002`)
2. Timestamp
3. Email Address
4. Duel Date
5. Match Type (HLD/LLD/Melee)
6. Mirror (Yes/No)
7. Mirror Type (Class/Build)
8. Title (Title match flag)
9. Notes
10. Winner (Arena Name)
11. Winner Class
12. Winner Build
13. Loser (Arena Name)
14. Loser Class
15. Loser Build
16. Round Wins (Winner)
17. Round Losses (Winner)
18. Class Matchup (e.g., "Pal vs Nec")
19. Build Matchup

**Bot Access**:
- **Read**: `duelDataCache.js` (directly from SSoT, not this IMPORTRANGE)
- **Used By**: `/stats`, `/recentduels`, `/rankings` (for match history analysis)

#### 3. DFC Signups (Embedded Form Response) ⭐ **SIGNUP SSoT**
**Data Source**: Google Forms embedded response table (dual submission system)
**Form ID**: `PROD_FORM_ID` / `TEST_FORM_ID`
**Location**: **[DFC] Official Rankings** sheet (QUERY_SPREADSHEET_ID), NOT in SSoT sheet

**Note**: The deprecated "DFC bot signups" tab is **NO LONGER USED**. Signups now use a dual-system approach.

**Dual Signup System**:
1. **Voxel Google Form** (External)
   - Uses Voxel technology with Discord OAuth
   - Automatically populates Discord handle via Discord authentication
   - Submits directly to embedded form response table
   - Users access this form independently (not via bot)
   - URL structure: `https://voxelfox.co.uk/gforms?f=...&u=2092238618&i=`
     - `u=2092238618`: Maps to Discord Handle entry field
     - `i=`: Empty (potential for Discord UUID capture if configured)

2. **Bot Command** (`/signup`)
   - Discord bot command with interactive UI
   - Captures `interaction.user.username` from Discord API
   - Submits via Google Forms POST (same destination as Voxel form)
   - See `signup.js:465` for form entry mapping

**Columns** (A-E):
- **A**: Timestamp
- **B**: Discord Handle (populated via Voxel OAuth or bot `user.username`)
- **C**: Division (Check All that apply) - Raw multi-select: "Unlimited (HLD), Melee, Teams"
- **D**: Class (Check All that apply) - Raw multi-select: "Assassin, Barbarian", "Paladin"
- **E**: Build Type / Notes - Free-form text for build details

**Data Characteristics**:
- **Raw form responses** (one row per form submission)
- **Multi-division signups** are comma-separated in Column C (e.g., "Unlimited (HLD), Melee")
- **All-time data** (not filtered by date)
- **No data transformation** applied

**Bot Access**:
- **Write**:
  - Automatic via Voxel Google Form (Discord OAuth)
  - Automatic via Google Forms POST from `/signup` command
- **Read**: Generally not read directly by bot (see "DFC Recent Signups" below)
- **Used By**: `/signup` (write), source for "DFC Recent Signups" processing

#### 4. DFC Recent Signups (Processed/Flattened)
**Purpose**: Processed signup data for bot consumption (last 10 days only)
**Data Source**: Derived from "DFC Signups" tab via complex ARRAYFORMULA

**Formula**:
```
=ARRAYFORMULA(
  QUERY(
    SPLIT(
      FLATTEN(
        IF(
          ('DFC Signups'!A2:A >= TODAY()-10) * LEN('DFC Signups'!C2:C),
          'DFC Signups'!A2:A & "♦" &
          'DFC Signups'!B2:B & "♦" &
          TRIM(
            SPLIT(
              REGEXREPLACE(
                SUBSTITUTE(
                  SUBSTITUTE('DFC Signups'!C2:C,"Low Level Dueling (LLD)","LLD"),
                  "Unlimited (HLD)","HLD"
                ),
                "\s*,\s*",","
              ),
              ","
            )
          ) & "♦" &
          'DFC Signups'!D2:D & "♦" &
          'DFC Signups'!E2:E,
          ""
        )
      ),
      "♦", FALSE, FALSE
    ),
    "select Col1,Col2,Col3,Col4,Col5 "&
    "where Col3 <> '' "&
    "order by Col3 asc, Col1 desc "&
    "label Col1 'Timestamp', Col2 'Discord Handle', Col3 'Division', Col4 'Class', Col5 'Build Type / Notes'",
    0
  )
)
```

**What This Formula Does**:
1. **Filters** last 10 days only: `'DFC Signups'!A2:A >= TODAY()-10`
2. **Abbreviates** division names:
   - "Unlimited (HLD)" → "HLD"
   - "Low Level Dueling (LLD)" → "LLD"
3. **Flattens** multi-division signups:
   - If user signs up for "HLD, Melee" → Creates 2 separate rows (one per division)
4. **Sorts** by Division ASC, then Timestamp DESC
5. **Outputs** 5 columns: Timestamp, Discord Handle, Division, Class, Build Type/Notes

**Data Characteristics**:
- **One row per division signup** (multi-division signups are exploded into multiple rows)
- **Last 10 days only** (rolling window)
- **Abbreviated division names** (HLD, LLD, Melee, Teams)
- **Same Discord Handle appears multiple times** if signed up for multiple divisions

**Example Transformation**:

**Input** ('DFC Signups' tab):
```
Timestamp: 2025-11-14 12:00:00
Discord Handle: bruno
Division: Unlimited (HLD), Melee
Class: Assassin, Barbarian
Build: Trap sin, WW barb
```

**Output** ('DFC Recent Signups' tab):
```
Row 1:
Timestamp: 2025-11-14 12:00:00
Discord Handle: bruno
Division: HLD
Class: Assassin, Barbarian
Build: Trap sin, WW barb

Row 2:
Timestamp: 2025-11-14 12:00:00
Discord Handle: bruno
Division: Melee
Class: Assassin, Barbarian
Build: Trap sin, WW barb
```

**Bot Access**:
- **Read**: `signupsCache.js` (range: `DFC Recent Signups!A:E`)
- **Used By**: `/recentsignups` command
- **IMPORTRANGE'd into**: '[DFC] Data Input' "Recent Signups" tab

**Important for Roster Reconciliation**:
- When checking for Discord handle changes, **deduplicate by Discord Handle** since multi-division signups create multiple rows
- Use raw 'DFC Signups' tab instead of this processed view for comprehensive handle change detection

#### 5. Official Rankings
**Purpose**: Champion and top 20 ranked players

**Columns**:
- Rank
- Player Name
- Wins
- Losses
- Win Rate
- Additional ranking metrics

**Bot Access**:
- **Read**: `rankingsCache.js`
- **Used By**: `/rankings` command

#### 6. Player List
**Purpose**: Player autocomplete data

**Bot Access**:
- **Read**: `playerListCache.js`
- **Used By**: Autocomplete in `/stats`, `/reportwin`

#### 7. Signup Tracker
**Purpose**: Signup tracking and analytics

**Bot Access**:
- **Read**: Various analytics queries

---

## Sheet 2: [DFC] Data Input (Duel Data SSoT)

**Sheet ID**: `19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw`
**Environment Variable**: `PROD_SSOT_ID`

**SSoT Responsibilities** (Authoritative Data):
- ⭐ **Duel Data** - Raw match result form responses
- ⭐ **DUEL_DATA_OUTPUT** - ETL-transformed duel log (19 columns)
- ⭐ **ETL OUTPUT** - Per-dueler statistics and title streaks

**Additional Functions**:
- ETL transformations via `duel data.gs` Apps Script
- IMPORTRANGE formulas pull **Roster** and **Signups** from [DFC] Official Rankings for cross-referencing

### Tabs (Mirror Tabs | SSoT Tabs ⭐)

#### 1. Roster (IMPORTRANGE Mirror - NOT SSoT)
**Purpose**: Read-only mirror of roster data from [DFC] Official Rankings
**Formula**: `=SORT(IMPORTRANGE("https://docs.google.com/spreadsheets/d/17PlXUTm83d8YjtKfG9hl0Y6gpzBhKwa7iYLjN0mi4Cg","'Roster'!A2:K"),1, TRUE)`
**Data Flow**: [DFC] Official Rankings "Roster" (SSoT) → IMPORTRANGE → [DFC] Data Input "Roster" (Mirror)
**Note**: This is NOT the source of truth - it's a read-only mirror for convenience

**Columns** (A-K):
- **A**: Arena Name
- **B**: Data Name
- **C**: Discord Name
- **D**: UUID
- **E**: DFC Role
- **F**: Champion
- **G**: Current Champ
- **H**: Title
- **I**: Notes
- **J**: Leave Status
- **K**: Additional metadata

**Data Characteristics**:
- Sorted by Arena Name ASC (Column A)
- Auto-updates when IMPORTRANGE refreshes
- Same data as "Roster" in [DFC] Official Rankings

**Bot Access**:
- **Read**: `rosterCache.js` reads from **[DFC] Official Rankings**, not this mirror
- **Write**: None (read-only IMPORTRANGE formula)
- **Purpose**: Convenience for viewing roster data alongside duel data in SSoT sheet

**Data Flow**: IMPORTRANGE from [DFC] Official Rankings "Roster" tab (actual SSoT)

#### 2. Duel Data (Raw Form Responses) ⭐ **DUEL DATA SSoT**
**Purpose**: Raw match result submissions from Google Forms
**Location**: [DFC] Data Input (PROD_SSOT_ID)
**Note**: This is the SOURCE OF TRUTH for all match/duel data

**Columns** (A-AB, 28 columns):

**Match Metadata (10 columns):**
1. Timestamp (A)
2. Email Address (B)
3. Duel Date (C)
4. Round Wins (D)
5. Round Losses (E)
6. Match Type (F) - HLD/LLD/Melee
7. Mirror (G) - Yes/No
8. Mirror Type (H) - Class/Build
9. Title (I) - Yes/No
10. Notes (J)

**Winner Data (9 columns):**
11. Winner (K) - Player Arena Name
12. Winner Class (L) - Amazon/Assassin/Barbarian/Druid/Necromancer/Paladin/Sorceress
13. Winner Amazon Build (M)
14. Winner Assassin Build (N)
15. Winner Barbarian Build (O)
16. Winner Druid Build (P)
17. Winner Necromancer Build (Q)
18. Winner Paladin Build (R)
19. Winner Sorceress Build (S)

**Loser Data (9 columns):**
20. Loser (T) - Player Arena Name
21. Loser Class (U) - Amazon/Assassin/Barbarian/Druid/Necromancer/Paladin/Sorceress
22. Loser Amazon Build (V)
23. Loser Assassin Build (W)
24. Loser Barbarian Build (X)
25. Loser Druid Build (Y)
26. Loser Necromancer Build (Z)
27. Loser Paladin Build (AA)
28. Loser Sorceress Build (AB)

**Note**: Class-specific build columns allow the Google Form to conditionally show the relevant build field based on selected class. Only the column matching the selected class will be populated; others remain empty.

**Bot Access**:
- **Read**: `duel data.gs` Apps Script for ETL processing
- **Write**: Google Forms POST from `/reportwin` command
- **Direct Bot Read**: `duelDataCache.js` (range: `Duel Data!A2:AB`)
- **Cache**: Redis (TTL: 5 minutes)

**Important**: This is the **raw source data** with 28 columns. The Apps Script ETL process consolidates the class-specific build columns into single "Winner Build" and "Loser Build" fields in DUEL_DATA_OUTPUT.

#### 3. DUEL_DATA_OUTPUT (Transformed - 19 Columns) ⭐ **ETL DUEL LOG SSoT**
**Purpose**: Clean duel log with one row per duel (ETL output from Apps Script)
**Location**: [DFC] Data Input (PROD_SSOT_ID)
**Note**: This is the AUTHORITATIVE transformed duel log used by all analytics

**Generated By**: `duel data.gs` script via `saveDuelMapToLog_()` function

**Columns** (19 columns):
1. Duel_ID (e.g., `D0001`)
2. Timestamp
3. Email Address
4. Duel Date
5. Match Type
6. Mirror (Yes/No)
7. Mirror Type
8. Title (Title match flag)
9. Notes
10. Winner
11. Winner Class
12. Winner Build
13. Loser
14. Loser Class
15. Loser Build
16. Round Wins (Winner)
17. Round Losses (Winner)
18. Class Matchup
19. Build Matchup

**Key Features**:
- Unique Duel_ID assigned chronologically (base-36 encoding)
- Stable duel keys prevent duplicate IDs
- Chronological ordering by Duel Date → Timestamp → Duel_ID
- **Case-insensitive name normalization** via `normName_()` function

**Data Flow**: IMPORTRANGE'd into [DFC] Official Rankings "Duel Data" tab

#### 4. ETL OUTPUT (Per-Dueler Fact Table) ⭐ **DUELER STATS SSoT**
**Purpose**: Per-dueler statistics with title streak tracking
**Location**: [DFC] Data Input (PROD_SSOT_ID)
**Note**: This is the AUTHORITATIVE per-dueler statistics table

**Generated By**: `duel data.gs` script via `buildETL()` function

**Columns** (10 columns):
1. Log_ID (unique row identifier)
2. Duel_ID (links to DUEL_DATA_OUTPUT)
3. Round Wins
4. Round Losses
5. Dueler (Arena Name)
6. Class
7. Build
8. Result (W/L)
9. Dueler_ID (normalized unique ID)
10. Title Streak (champion title defense count per lane)

**Key Features**:
- One row per dueler per duel (each duel creates 2 rows - winner + loser)
- Title Streak calculation tracks consecutive title defenses per Match Type
- Used for statistical queries and player performance analysis

#### 5. Recent Signups (IMPORTRANGE Mirror - NOT SSoT)
**Formula**: `=SORT(IMPORTRANGE("https://docs.google.com/spreadsheets/d/17PlXUTm83d8YjtKfG9hl0Y6gpzBhKwa7iYLjN0mi4Cg","'DFC Recent Signups'!A2:E"),1, TRUE)`

**Purpose**: Read-only mirror of processed signup data from [DFC] Official Rankings
**Data Flow**: [DFC] Official Rankings "DFC Recent Signups" (SSoT) → IMPORTRANGE → [DFC] Data Input "Recent Signups" (Mirror)
**Note**: This is NOT the source of truth for signups - it's a mirror for convenience

**Columns** (A-F):
- **A**: Timestamp
- **B**: Discord Handle
- **C**: Division (abbreviated: HLD, LLD, Melee, Teams)
- **D**: Class
- **E**: Build Type / Notes
- **F**: Roster Presence (calculated validation column)

**Column F: "Roster Presence" Validation Formula**

**Purpose**: Validates signup Discord Handle against Roster and returns Data Name for match reporting dropdowns

**Current Formula** (case-sensitive, username-based):
```excel
=MAP(B2:B, LAMBDA(b,
  IF(b="","",
    IFERROR(
      INDEX(FILTER(Roster!B:B, (Roster!A:A=b) + (Roster!B:B=b) + (Roster!C:C=b)), 1),
      "Not Found"
    )
  )
))
```

**How It Works**:
1. Takes Discord Handle from Column B (signup)
2. Searches Roster tab for match in ANY of:
   - Roster!A:A (Arena Name)
   - Roster!B:B (Data Name)
   - Roster!C:C (Discord Name)
3. If match found: Returns Data Name (Roster Column B)
4. If no match: Returns "Not Found"

**Critical Issues**:
- **Case-sensitive matching**: "bruno" ≠ "Bruno" → returns "Not Found"
- **Username changes**: When user changes Discord handle (e.g., "Bruno" → "xXDarkLord420Xx"), lookup fails
- **"Not Found" pollution**: Failed matches appear as "Not Found" in match reporting form dropdowns

**Integration with Match Reporting**:
- `Duel Data Forms.gs` reads Column F values
- Updates "Winner" and "Loser" dropdown choices in match reporting Google Form
- See `Duel Data Forms.gs` section for details

**Proposed Enhancement** (UUID-based hybrid lookup):
```excel
=MAP(B2:B, F2:F, LAMBDA(handle, uuid,
  IF(handle="","",
    IFERROR(
      INDEX(FILTER(Roster!B:B, Roster!D:D=TEXT(uuid,"0")), 1),
      IFERROR(
        INDEX(FILTER(Roster!B:B, LOWER(Roster!C:C)=LOWER(handle)), 1),
        "Not Found"
      )
    )
  )
))
```
- Requires UUID capture in signup form (Column F)
- See `voxel-uuid-integration.md` for implementation details

**Data Characteristics**:
- Sorted by Timestamp DESC (most recent first)
- IMPORTRANGE data (A-E) updates automatically
- Roster Presence (Column F) recalculates when Roster or signup data changes
- Last 10 days only (inherited from source formula)

**Bot Access**:
- **Read**: None (bot reads from original source in Official Rankings)
- **Purpose**: Convenience for viewing signup data alongside other SSoT tabs
- **Match Reporting**: Duel Data Forms.gs reads Column F for form dropdown population

#### 6. Builds
**Purpose**: Build reference data

**Bot Access**:
- Referenced in various commands for build validation

#### 7. Signup Responses
**Purpose**: Weekly tournament signup submissions from Google Forms

**Columns**:
- Timestamp
- Discord Username
- Match Type (HLD/LLD/Melee)
- Class Selection
- Build Details

**Bot Access**:
- **Write**: Google Forms POST from `/signup` command
- **Read**: Analytics and signup tracking queries

---

## ETL Transformation Flow

The **`duel data.gs`** Google Apps Script performs Extract-Transform-Load operations on duel data:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ETL TRANSFORMATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. Raw Form Submissions
   ↓
   [Duel Data] tab (28 columns, raw Google Forms responses)
   ↓
   ┌────────────────────────────────────────┐
   │  duel data.gs - buildDuelLog()         │
   │  - Assigns unique Duel_IDs (D0001...)  │
   │  - Normalizes player names (lowercase) │
   │  - Consolidates class-specific builds  │
   │  - Chronological ordering              │
   │  - Stable duel key generation          │
   └────────────────────────────────────────┘
   ↓
   [DUEL_DATA_OUTPUT] tab (19 columns, one row per duel)
   ↓ ↓
   │ └─→ IMPORTRANGE to [DFC] Official Rankings
   │
   ┌────────────────────────────────────────┐
   │  duel data.gs - buildETL()             │
   │  - Creates per-dueler fact table       │
   │  - Calculates Title Streaks            │
   │  - Generates dueler-level metrics      │
   └────────────────────────────────────────┘
   ↓
   [ETL OUTPUT] tab (10 columns, one row per dueler per duel)
```

### Key ETL Functions (`duel data.gs`):

**1. `buildETL()` (lines 16-84)**
- Reads from "Duel Data" tab (raw responses)
- Generates per-dueler fact table in "ETL OUTPUT"
- Calculates Title Streak (consecutive title defenses per Match Type)
- Assigns missing Duel_IDs chronologically
- Always rewrites "DUEL_DATA_OUTPUT" to ensure deletions/edits propagate

**2. `buildDuelLog()` (lines 87-94)**
- Rebuilds duel-level log in strict chronological order
- Ensures DUEL_DATA_OUTPUT is always up-to-date

**3. `normName_()` (lines 420-427)**
- **Case-insensitive name normalization**
- Converts to lowercase
- Removes special characters except alphanumeric and spaces
- Ensures consistent player matching across datasets

---

## Google Apps Scripts Integration

### Duel Data Forms.gs

**Purpose**: Dynamically populates "Winner" and "Loser" dropdown choices in the match reporting Google Form

**Location**: [DFC] Data Input sheet (attached as Apps Script)
**Form ID**: `1saTsDIxQF227oNx7jkhLHvXd5CkDOygEkiU2oNXMlkQ` (match reporting form)

**Source Code** (`Duel Data Forms.gs` lines 1-67):
```javascript
function updateWinnerLoserChoices() {
  const FORM_ID = '1saTsDIxQF227oNx7jkhLHvXd5CkDOygEkiU2oNXMlkQ';
  const SHEET_ID = '19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw';
  const TAB_NAME = 'Recent Signups';
  const HANDLE_HEADER = 'Roster Presence';
  const TARGET_TITLES = ['Winner', 'Loser'];

  // Read from "Roster Presence" column (Column F)
  // Deduplicate (case-insensitive)
  // Sort alphabetically
  // Update form dropdown choices
}
```

**How It Works**:
1. Reads from `[DFC] Data Input` → "Recent Signups" tab → Column F "Roster Presence"
2. Deduplicates handles (case-insensitive via `toLowerCase()`)
3. Sorts alphabetically (case-insensitive)
4. Updates "Winner" and "Loser" dropdown lists in match reporting form

**Data Flow**:
```
Recent Signups Column F ("Roster Presence")
   ↓ (Contains Data Names or "Not Found")
Duel Data Forms.gs reads values
   ↓ (Deduplicates, sorts)
Match Reporting Form (Form ID: 1saTsDIxQF227oNx7jkhLHvXd5CkDOygEkiU2oNXMlkQ)
   ↓ (Winner/Loser dropdowns)
User selects from dropdown when reporting match
```

**Critical Dependency**:
- Dropdown accuracy depends on "Roster Presence" formula accuracy
- If Roster Presence returns "Not Found", users see "Not Found" in dropdowns
- Username changes causing "Not Found" break the match reporting workflow

**Trigger**: Presumably scheduled or manual trigger (not documented in source)

---

## Voxel Integration (Signup Form OAuth)

**Purpose**: Third-party Discord OAuth service that pre-fills Google Form fields with Discord user data

**Source Code**: [Voxel-Fox-Ltd/Website](https://github.com/Voxel-Fox-Ltd/Website/blob/master/website/frontend.py#L68-L104)

**Voxel URL Structure**:
```
https://voxelfox.co.uk/gforms?f={FORM_ID}&u={USERNAME_ENTRY_ID}&i={USER_ID_ENTRY_ID}
```

**Current DFC Signup URL**:
```
https://voxelfox.co.uk/gforms?f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/&u=2092238618&i=
```

**Parameters**:
- `f=` - Google Form ID
- `u=` - Entry field ID(s) to populate with Discord username (supports multiple)
- `i=` - Entry field ID(s) to populate with Discord user ID/UUID (supports multiple)

**Voxel Implementation** (frontend.py lines 68-104):
```python
@routes.get("/gforms")
@requires_login()
async def gforms(request: Request):
    # Get Discord OAuth session
    uif = session["discord"]

    # Build pre-fill parameters
    params = {
        **{
            f"entry.{i}": f"{uif['id']}"  # Discord user ID
            for i in user_id
        },
    }
    if "username" in uif:
        params.update({
            f"entry.{u}": uif['username']  # Discord username
            for u in username
        })

    # Redirect to Google Form with pre-filled data
    return HTTPFound(
        f"https://docs.google.com/forms/d/e/{form_id}"
        f"/viewform?{urlencode(params)}"
    )
```

**How It Works**:
1. User clicks Voxel URL
2. Redirects to Discord OAuth login (if not already authenticated)
3. Voxel extracts `session["discord"]` containing `id` and `username`
4. Constructs Google Forms URL with pre-fill parameters:
   - `entry.{u}` = Discord username
   - `entry.{i}` = Discord user ID (numeric, permanent)
5. Redirects user to Google Form with fields pre-populated

**Current State**:
- `u=2092238618` - Populates Discord Handle (Column B) - **Working**
- `i=` - Empty (no UUID field in form yet) - **Not implemented**

**UUID Capture Capability**:
- Voxel ALREADY supports UUID capture via `uif['id']`
- Implementation blocked only by missing form field
- See `voxel-uuid-integration.md` for implementation guide

**Form Fields** (current):
- Column A: Timestamp (auto)
- Column B: Discord Handle (entry.2092238618 via `u=` parameter)
- Column C: Division
- Column D: Class
- Column E: Build Type / Notes

**Form Fields** (with UUID):
- Column A: Timestamp (auto)
- Column B: Discord Handle (entry.2092238618 via `u=` parameter)
- Column C: Division
- Column D: Class
- Column E: Build Type / Notes
- Column F: Discord UUID (entry.XXXXXXXXX via `i=` parameter) - **Requires Surely to add field**

---

## Data Flow Diagrams

### Complete Bot Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      DISCORD BOT OPERATIONS                     │
└─────────────────────────────────────────────────────────────────┘

/register Command
   ↓
   Append to → [Official Rankings] Roster tab (SSoT)
   ↓
   IMPORTRANGE → [Data Input] Roster tab (mirror)
   ↓
   rosterCache.js → Redis (1 week TTL) → /namesync validates

/signup Command (or Voxel Form)
   ↓
   Google Form POST → PROD_FORM_ID
   ↓
   Form writes to → [Official Rankings] "DFC Signups" tab (embedded response table)
   ↓
   ARRAYFORMULA processes → "DFC Recent Signups" tab (last 10 days, flattened)
   ↓
   IMPORTRANGE → [SSoT] "Recent Signups" tab (mirror)
   ↓
   signupsCache.js → Redis → /recentsignups displays

/reportwin Command
   ↓
   Google Form POST → PROD_FORM_ID
   ↓
   Form writes to → [SSoT] Duel Data tab (raw, 17 cols)
   ↓
   Apps Script trigger → duel data.gs processes
   ↓
   Writes to → [SSoT] DUEL_DATA_OUTPUT (19 cols, one row per duel)
   ↓
   Processes to → [SSoT] ETL OUTPUT (10 cols, per-dueler stats)
   ↓
   IMPORTRANGE → [Official Rankings] Duel Data tab
   ↓
   duelDataCache.js → Redis (5 min TTL) → /stats, /recentduels

/stats, /rankings Commands
   ↓
   Read from Redis cache (if available)
   ↓
   Fallback to Google Sheets if Redis unavailable
```

### Cache Refresh Schedule

**Redis Cache Layers**:
- **Roster Cache**: 1 week TTL (`rosterCache.js`)
- **Duel Data Cache**: 5 minute TTL (`duelDataCache.js`)
- **Rankings Cache**: 60 minute TTL (`rankingsCache.js`)
- **Player List Cache**: On-demand refresh (`playerListCache.js`)

**Scheduled Refresh** (America/New_York timezone):
- Thursday 5:30pm ET (22:30 UTC)
- Friday 2:00am ET (07:00 UTC)
- Friday 11:00pm ET (04:00 UTC Saturday)

**Manual Refresh**: `/refreshcache` command (Moderator role only)

---

## IMPORTRANGE Relationships

```
[DFC] Official Rankings (Query/Display)    [DFC] Data Input (Duel SSoT)
┌──────────────────────────────────┐      ┌──────────────────────────┐
│ ⭐ ROSTER SSOT                   │      │                          │
│ ⭐ SIGNUP SSOT                   │      │                          │
│                                  │      │                          │
│  Roster (SSoT)              ────────────→  Roster (IMPORTRANGE)    │
│  - Arena Name, Discord Name      │      │  - Mirror only           │
│  - UUID (stable ID)              │      │                          │
│                                  │      │                          │
│  DFC Signups (Form SSoT)         │      │  ⭐ DUEL DATA SSOT       │
│  - Raw signups (all-time)        │      │                          │
│         ↓                        │      │  Duel Data (Raw)         │
│  DFC Recent Signups      ────────┼─────→  - Form responses         │
│  - ARRAYFORMULA (10 days) ───────┼─────→  Recent Signups (Mirror)  │
│  - Flattened divisions           │      │                          │
│                                  │      │  DUEL_DATA_OUTPUT   ─────┐
│  Duel Data (IMPORTRANGE) ←───────┼──────┤  - ETL transformed       │
│  - From DUEL_DATA_OUTPUT         │      │  - 19 columns            │
│                                  │      │                          │
└──────────────────────────────────┘      └──────────────────────────┘
                                                      │
                                                      │
                                          ┌───────────┴────────────┐
                                          │   Apps Script          │
                                          │   buildETL()           │
                                          │   4am ET daily         │
                                          └────────────────────────┘

⭐ Data Domain SSoTs:
   • ROSTER: [DFC] Official Rankings "Roster" tab
   • SIGNUPS: [DFC] Official Rankings "DFC Signups" tab
   • DUEL DATA: [DFC] Data Input "Duel Data" tab
```

---

## SSoT (Single Source of Truth) Quick Reference

This section provides a comprehensive lookup table for determining which sheet and tab is authoritative for each data type.

### SSoT Ownership by Data Domain

| Data Domain | SSoT Sheet | SSoT Tab | Bot Write Operations | Bot Read Operations | Cache Module |
|-------------|------------|----------|---------------------|---------------------|--------------|
| **Roster (Player Registration)** | [DFC] Official Rankings | Roster | `/register` appends rows | `rosterCache.js` | 1 week TTL |
| **Signups (Raw Form Data)** | [DFC] Official Rankings | DFC Signups | Google Forms POST (Voxel + `/signup`) | Not directly read | N/A |
| **Signups (Processed, Last 10 Days)** | [DFC] Official Rankings | DFC Recent Signups | N/A (ARRAYFORMULA) | `signupsCache.js` | On-demand |
| **Duel Data (Raw Form Responses)** | [DFC] Data Input | Duel Data | Google Forms POST (`/reportwin`) | `duelDataCache.js` | 5 min TTL |
| **Duel Data (ETL Transformed)** | [DFC] Data Input | DUEL_DATA_OUTPUT | N/A (Apps Script) | Via IMPORTRANGE | N/A |
| **Duel Data (Per-Dueler Stats)** | [DFC] Data Input | ETL OUTPUT | N/A (Apps Script) | Via IMPORTRANGE | N/A |
| **Rankings** | [DFC] Official Rankings | Official Rankings | N/A (calculated) | `rankingsCache.js` | 60 min TTL |
| **Player List** | [DFC] Official Rankings | Player List | N/A (calculated) | `playerListCache.js` | On-demand |

### Write Operation Rules

**CRITICAL**: Bot write operations MUST ONLY target SSoT tabs. Never write to mirror tabs.

| Operation Type | Target Sheet | Target Tab | Method | Command |
|---------------|--------------|------------|--------|---------|
| Player Registration | [DFC] Official Rankings | Roster | `sheets.spreadsheets.values.append()` | `/register` |
| Weekly Signup | Google Forms → [DFC] Official Rankings | DFC Signups | Google Forms POST | `/signup` (bot) or Voxel form |
| Match Result | Google Forms → [DFC] Data Input | Duel Data | Google Forms POST | `/reportwin` |

**Note**: All form submissions use Google Forms as an intermediary, which automatically writes to the respective SSoT tabs.

### Read Operation Rules

Bot commands can read from:
1. **Redis cache** (preferred for performance)
2. **SSoT sheet directly** (fallback if cache miss)
3. **Mirror sheet** (only if SSoT unavailable - rare)

**Best Practice**: Always read from cache when available, fall back to SSoT sheet on cache miss.

### IMPORTRANGE Data Flow Summary

```
[DFC] Official Rankings                    [DFC] Data Input
========================                   =================

⭐ Roster (SSoT)        -----------------> Roster (Mirror)
   - Bot writes here                        - IMPORTRANGE read-only
   - rosterCache reads                      - For cross-referencing

⭐ DFC Signups (SSoT)
   - Google Forms writes
   - Raw all-time data
         ↓
⭐ DFC Recent Signups (SSoT)
   - ARRAYFORMULA (10 days) ------------> Recent Signups (Mirror)
   - signupsCache reads                    - IMPORTRANGE read-only
                                           - Roster validation

Duel Data (Mirror)     <----------------- ⭐ Duel Data (SSoT)
   - IMPORTRANGE only                        - Google Forms writes
                                             - duelDataCache reads
                                                   ↓
                                           ⭐ DUEL_DATA_OUTPUT (SSoT)
                                             - Apps Script ETL
                                                   ↓
                                           ⭐ ETL OUTPUT (SSoT)
                                             - Per-dueler stats
```

### Mirror Tab Warning

**⚠️ DO NOT WRITE TO MIRROR TABS**

The following tabs are **READ-ONLY mirrors** and must NEVER be written to by bot commands:

**In [DFC] Official Rankings:**
- `Duel Data` (mirrors from [DFC] Data Input → DUEL_DATA_OUTPUT)

**In [DFC] Data Input:**
- `Roster` (mirrors from [DFC] Official Rankings → Roster)
- `Recent Signups` (mirrors from [DFC] Official Rankings → DFC Recent Signups)

Writing to mirror tabs will cause data inconsistencies and will be overwritten by IMPORTRANGE.

---

## Bot Access Patterns

### Read Operations

| Command | Sheet | Tab | Range | Cache Module | TTL |
|---------|-------|-----|-------|--------------|-----|
| `/register` | [DFC] Official Rankings | Roster | A2:J500 | rosterCache.js | 1 week |
| `/signup` | [DFC] Official Rankings | DFC Recent Signups | A:E | signupsCache.js | On-demand |
| `/reportwin` | [DFC] Data Input | Duel Data | A2:AB | duelDataCache.js | 5 min |
| `/stats` | [DFC] Data Input | Duel Data | A2:AB | duelDataCache.js | 5 min |
| `/rankings` | [DFC] Official Rankings | Official Rankings | - | rankingsCache.js | 60 min |
| `/recentduels` | [DFC] Data Input | Duel Data | A2:AB | duelDataCache.js | 5 min |
| `/recentsignups` | [DFC] Official Rankings | DFC Recent Signups | A:E | signupsCache.js | On-demand |
| `/namesync` | [DFC] Official Rankings | Roster | A2:J500 | rosterCache.js | 1 week |

**Note**: All read operations prefer Redis cache, fall back to direct sheet reads on cache miss.

### Write Operations

| Command | Sheet | Tab | Method | Data Format |
|---------|-------|-----|--------|-------------|
| `/register` | [DFC] Official Rankings | Roster | `sheets.values.append()` | [Arena Name, Data Name, Discord Name, UUID, ...] |
| `/signup` | Google Forms → [DFC] Official Rankings | DFC Signups | Google Forms POST | entry fields (handle, division, class, build) |
| `/reportwin` | Google Forms → [DFC] Data Input | Duel Data | Google Forms POST | entry fields (winner, loser, scores, etc.) |

**Note**: All form submissions go through Google Forms POST requests, which automatically populate the respective SSoT tabs.

---

## Important Notes

### Deprecated Features
- **"DFC bot signups" tab**: NO LONGER USED (replaced by "DFC Signups" Google Forms integration)
- **Direct sheet writes for signups**: Now use Google Forms POST → "DFC Signups" tab (SSoT)
- **Old ELO system**: Legacy SPREADSHEET_ID (`1ApQkP-EqC77MK1udc2BNF5eTMpa95pp14Xmtbd20RPA`) - deprecated, no longer SSoT for any domain

### Case Sensitivity
- **Apps Script**: Uses `normName_()` for case-insensitive player name matching
- **Bot Commands**: Some commands (e.g., `/namesync`) use case-sensitive comparison (may cause false positives)

### Data Consistency
- **Distributed SSoT architecture**: Each data domain has ONE authoritative source
  - **Roster SSoT**: [DFC] Official Rankings → "Roster" tab
  - **Signups SSoT**: [DFC] Official Rankings → "DFC Signups" and "DFC Recent Signups" tabs
  - **Duel Data SSoT**: [DFC] Data Input → "Duel Data", "DUEL_DATA_OUTPUT", "ETL OUTPUT" tabs
- **IMPORTRANGE formulas**: Mirror tabs automatically sync from SSoT tabs
- **ETL processing**: Apps Script in [DFC] Data Input ensures DUEL_DATA_OUTPUT and ETL OUTPUT are always up-to-date
- **Write operations**: MUST target SSoT tabs only, never mirror tabs

### Redis Fallback
- All bot commands gracefully fall back to live Google Sheets queries if Redis is unavailable
- Cache misses are automatically repopulated from source sheets

---

## Known Issues & Mitigation Strategies

### Discord Handle Changes Creating Duplicate Users

**Problem**: When Discord users change their handle (e.g., "OldUser123" → "NewUser456"), the system treats them as different users because:
1. **Roster tab** contains old Discord handle (Column C)
2. **New signups** (Voxel form + `/signup`) contain new Discord handle
3. **Historical duel data** references old Discord handle
4. **Result**: Same person appears multiple times in analytics, rankings, and stats

**Why This Happens**:
- Discord usernames are mutable (users can change them at any time)
- UUID (Column D in Roster) is the only stable identifier
- Google Forms (both Voxel and bot submissions) submit Discord handles, not UUIDs
- No automatic mechanism links new Discord handle back to existing Roster entry

**Impact**:
- Inflated unique player counts
- Broken player histories (stats split across multiple "users")
- Rankings show same person under multiple handles
- ETL processing treats old/new handles as separate players

### Mitigation Strategy 1: UUID-Based Roster Sync (Bot-Side)

**When**: Bot signup via `/signup` command

**How**: Enhance `signup.js` to check if user exists in Roster and update Discord handle if changed

**Implementation**:
```javascript
// Before submitting signup form:
1. Get interaction.user.id (Discord UUID)
2. Check Roster cache for matching UUID (Column D)
3. If found:
   a. Compare interaction.user.username vs Roster Discord Name (Column C)
   b. If different, update Roster with new Discord handle
   c. Invalidate roster cache
4. Submit signup form with current Discord handle
```

**Pros**:
- Automatic for bot signups
- Uses stable UUID for matching
- Keeps Roster current for weekly participants

**Cons**:
- Doesn't cover Voxel form submissions (no UUID in form)
- Requires bot code changes
- Only updates when users use `/signup` command

### Mitigation Strategy 2: Google Apps Script Roster Reconciliation

**When**: Scheduled daily/weekly via Apps Script trigger

**How**: Cross-reference signup submissions against Roster and prompt for manual review

**Implementation**:
```javascript
// Apps Script in [DFC] Data Input sheet:
function reconcileDiscordHandles() {
  // 1. Get unique Discord handles from recent signups (last 30 days)
  // 2. Check each against Roster
  // 3. For handles NOT in Roster:
  //    - Check if Arena Name appears in recent signups
  //    - If Arena Name matches existing Roster entry, flag for review
  // 4. Create "Potential Duplicates" sheet with:
  //    - Old Discord Handle (from Roster)
  //    - New Discord Handle (from Signups)
  //    - Arena Name (if available)
  //    - Match confidence score
  // 5. Manual review + update by moderator
}
```

**Pros**:
- Covers both Voxel and bot signups
- Doesn't require bot code changes
- Can identify patterns (e.g., same Arena Name)

**Cons**:
- Requires manual review/approval
- Lag time between handle change and update
- Can't access Discord UUID from Google Sheets alone

### Mitigation Strategy 3: Enhanced Namesync Command

**When**: Manual trigger via `/namesync` command (Moderator only)

**How**: Detect Discord handle changes and update Roster automatically

**Implementation**:
```javascript
// In namesync.js:
1. For each Roster entry:
   a. Get UUID from Roster (Column D)
   b. Fetch current Discord username from Discord API via UUID
   c. Compare current username vs cached username (Column C)
   d. If different:
      - Update Roster with new Discord handle
      - Log the change
      - Show in namesync output as "Updated Handle"
2. Separate mismatches into:
   - Handle Updates (UUID matches, username changed)
   - True Mismatches (UUID invalid or user left server)
```

**Pros**:
- Uses Discord UUID as source of truth
- Catches all handle changes (not just signups)
- Automated once triggered
- No manual review needed

**Cons**:
- Requires manual trigger (not fully automatic)
- Requires bot code changes
- Discord API rate limits may apply

### Mitigation Strategy 4: Hybrid Approach (Recommended)

**Combine all three strategies**:

1. **Proactive (Bot Signup)**:
   - Enhance `/signup` to auto-update Roster when UUID matches but handle differs
   - Covers ~90% of active weekly participants

2. **Scheduled Reconciliation (Apps Script)**:
   - Weekly script identifies potential duplicates from Voxel form submissions
   - Creates review sheet for moderator approval
   - Covers Voxel form users who don't use bot

3. **Safety Net (Namesync)**:
   - Enhanced `/namesync` command with auto-update capability
   - Moderator runs monthly or when stats look suspicious
   - Catches edge cases and validates overall Roster accuracy

**Result**: Roster stays ~95% accurate with minimal manual intervention

### Short-Term Workaround (No Code Changes)

**For immediate relief without code changes**:

1. **Manual Roster Audit**:
   - Export recent signups (last 90 days) from "DFC Signups" tab
   - Compare Discord handles against Roster
   - Identify handles in signups that don't exist in Roster
   - Cross-reference by checking if they use same Arena Name in chat/matches
   - Manually update Roster entries with new Discord handles

2. **Communication**:
   - Post in Discord: "If you changed your Discord username, please DM a moderator"
   - Moderators manually update Roster tab

3. **Interim Apps Script**:
   - Create simple script that highlights Discord handles appearing in signups but not in Roster
   - Run weekly, review list manually

---

---

## Common Development Tasks

### Adding a New Tab

**CRITICAL**: First determine which sheet should be the SSoT for your new data domain.

**If adding a new Roster or Signup-related tab**:
1. Create tab in **[DFC] Official Rankings** (SSoT for player/signup data)
2. Set up IMPORTRANGE formula in **[DFC] Data Input** if cross-referencing needed
3. Create cache module in `utils/` directory
4. Update bot commands to write to **[DFC] Official Rankings** and read from cache

**If adding a new Duel Data or Match-related tab**:
1. Create tab in **[DFC] Data Input** (SSoT for duel data)
2. Set up IMPORTRANGE formula in **[DFC] Official Rankings** if needed for analytics
3. Create cache module in `utils/` directory
4. Update bot commands to write to **[DFC] Data Input** and read from cache

**General Rules**:
- Never create duplicate SSoT tabs in both sheets for the same data
- Always set up IMPORTRANGE from SSoT → Mirror (one direction only)
- Document which sheet is SSoT in this file

### Modifying Sheet Structure
1. Identify which sheet is SSoT for the data you're modifying
2. Update Google Sheet columns in the SSoT sheet
3. Update IMPORTRANGE formulas if column ranges changed
4. Update Apps Script (`duel data.gs`) if ETL affected
5. Update cache modules with new column ranges
6. Update bot commands to use new column structure
7. Test with `TEST_SSOT_ID` before deploying to production
8. **Never modify mirror tabs directly** - always change SSoT and let IMPORTRANGE sync

### Debugging Data Issues
1. **Identify SSoT location**: Determine which sheet/tab is authoritative for the data in question
2. Check Redis cache first (`/refreshcache` to clear)
3. **Verify data at SSoT source**: Always check SSoT tab first, not mirror tab
4. Verify IMPORTRANGE formulas and permissions (if data missing in mirror)
5. Check Apps Script execution logs for ETL errors
6. Verify Google Forms entry field IDs match bot code
7. **If data is incorrect in mirror but correct in SSoT**: Wait for IMPORTRANGE refresh or trigger manually

---

## File References

- **Google Auth**: `utils/googleAuth.js`
- **Redis Client**: `utils/redisClient.js`
- **Cache Modules**: `utils/duelDataCache.js`, `utils/rosterCache.js`, `utils/rankingsCache.js`, `utils/playerListCache.js`
- **ETL Script**: `duel data.gs` (root directory)
- **Bot Commands**: `commands/register.js`, `commands/signup.js`, `commands/reportwin.js`, `commands/stats.js`, `commands/rankings.js`, `commands/recentduels.js`, `commands/recentsignups.js`, `commands/namesync.js`
