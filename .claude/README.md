# DFC Data Bot - Architecture & Development Guide

## Overview
DFC Data Bot is a Discord bot for managing Diablo 2 PvP duel tracking, player registrations, rankings, and match reporting. It integrates with Google Sheets for data persistence and uses Redis for caching and session management.

**Deployment**: Heroku Basic Dyno
**Node Version**: 20.x
**Primary Language**: JavaScript (Node.js)

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Environment Configuration](#environment-configuration)
3. [Core Systems](#core-systems)
4. [Commands Reference](#commands-reference)
5. [Caching Strategy](#caching-strategy)
6. [Testing & Development](#testing--development)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Tech Stack
- **Discord.js v14**: Discord API interactions
- **Google APIs**: Google Sheets integration for data persistence
- **Redis v5**: Session management and data caching (Redis Cloud)
- **Node-cron**: Scheduled cache refreshes
- **Heroku**: Cloud hosting platform

### Directory Structure
```
DFC-Data/
├── commands/           # Slash command handlers
├── utils/              # Utility modules (auth, cache, redis)
├── docs/               # Documentation
├── .claude/            # Claude Code configuration & docs
├── config/             # Google service account credentials
├── index.js            # Main bot entry point
├── .env                # Environment variables (gitignored)
└── package.json        # Dependencies
```

### Data Flow
```
Discord User
    ↓
Discord.js Bot (Slash Commands)
    ↓
Command Handler (commands/*.js)
    ↓
┌─────────────┬─────────────┐
│   Redis     │   Google    │
│   Cache     │   Sheets    │
│  (5-60min)  │  (SSOT)     │
└─────────────┴─────────────┘
```

---

## Environment Configuration

### Required Environment Variables

#### Discord Configuration
```bash
BOT_TOKEN=                    # Discord bot token
CLIENT_ID=                    # Discord application client ID
GUILD_ID=                     # Test Discord server ID
PROD_GUILD_ID=                # Production Discord server ID
```

#### Google Sheets Configuration
```bash
SPREADSHEET_ID=               # Main query spreadsheet
QUERY_SPREADSHEET_ID=         # Secondary query spreadsheet

# Google Service Account
GOOGLE_CLIENT_EMAIL=          # Service account email
GOOGLE_PRIVATE_KEY=           # Service account private key (keep newlines!)
```

#### Environment Mode (Test vs Production)
```bash
TEST_MODE=true                # true=test, false=production

# Test Environment
TEST_SSOT_ID=                 # Test Single Source of Truth spreadsheet
TEST_FORM_ID=                 # Test Google Form (response ID)
TEST_SPREADSHEET_ID=          # Test legacy spreadsheet

# Production Environment
PROD_SSOT_ID=                 # Production SSOT spreadsheet
PROD_FORM_ID=                 # Production Google Form (response ID)
```

#### Redis Configuration
```bash
REDISCLOUD_URL=redis://default:PASSWORD@HOST:PORT
```

### TEST_MODE Behavior

When `TEST_MODE=true`:
- Bot uses `TEST_SSOT_ID`, `TEST_FORM_ID`
- Form submissions use test form entry IDs
- Safe to test without affecting production data

When `TEST_MODE=false`:
- Bot uses `PROD_SSOT_ID`, `PROD_FORM_ID`
- Form submissions use production form entry IDs
- All data is permanent in production sheets

**Important**: Each Google Form copy has unique entry IDs. Test and production forms require separate entry ID mappings in `commands/reportwin.js`.

---

## Core Systems

### 1. Redis Client (`utils/redisClient.js`)

**Purpose**: Singleton Redis connection manager

**Features**:
- Auto-reconnection on disconnect
- Connection state tracking
- Error handling with fallback to Google Sheets

**Usage**:
```javascript
const redisClient = require('./utils/redisClient');
await redisClient.connect();
const client = redisClient.getClient();
```

**Health Checks**:
- `isReady()`: Returns connection status
- `isConnected`: Boolean flag for connection state

**Deployment Note**: Heroku Basic Dyno restarts daily. Redis connection is re-established on restart.

### 2. Google Sheets Authentication (`utils/googleAuth.js`)

**Purpose**: Service account authentication for Google Sheets API

**Configuration**:
- Uses `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` from `.env`
- Grants read/write access to specified spreadsheets
- Service account must be added as Editor to all sheets

**Scopes**:
```javascript
https://www.googleapis.com/auth/spreadsheets
```

### 3. Caching System

#### Roster Cache (`utils/rosterCache.js`)
- **Purpose**: Player roster data (Discord UUID → Data Name mapping)
- **TTL**: 7 days
- **Key**: `dfc-data:roster`
- **Refresh**: On-demand via `/refreshcache` or auto-fallback
- **Critical Fields**:
  - `uuid`: Discord user ID
  - `dataName`: Player name in sheets
  - `discordName`: Discord username
  - `leaveStatus`: Empty string = active, non-empty = inactive

**Usage**:
```javascript
const rosterCache = require('./utils/rosterCache');
const player = await rosterCache.getUserByUUID(discordUserId);
```

#### Duel Data Cache (`utils/duelDataCache.js`)
- **Purpose**: Duel history and match data
- **TTL**: 5 minutes
- **Key**: `dfc-data:duel-data`
- **Auto-refresh**: Every 5 minutes via cron job

#### Rankings Cache (`utils/rankingsCache.js`)
- **Purpose**: Player rankings by match type
- **TTL**: 60 minutes
- **Key**: `dfc-data:rankings-{matchType}`
- **Match Types**: HLD, LLD, Melee

#### Player List Cache (`utils/playerListCache.js`)
- **Purpose**: Active player list for fightcard generation
- **TTL**: 60 minutes
- **Key**: `dfc-data:player-list`

### 4. Scheduled Jobs (Cron)

Configured in `index.js`:

```javascript
// Refresh duel data cache every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    await duelDataCache.refreshCache();
});

// Refresh roster cache daily at 3 AM
cron.schedule('0 3 * * *', async () => {
    await rosterCache.refreshCache();
});
```

**Heroku Consideration**: Cron jobs only run when dyno is awake. If dyno sleeps (free/hobby tier), jobs won't execute until next request.

---

## Commands Reference

### User Registration & Management

#### `/register`
**Purpose**: Register a new user in the Roster sheet
**Role**: DFC Dueler
**Flow**:
1. Validates user not already registered
2. Shows modal for data name input
3. Validates data name uniqueness
4. Appends to Roster sheet
5. Refreshes Roster cache

**Sheet**: `{SSOT_ID}/Roster`

#### `/signup` & `/signup-multi`
**Purpose**: Sign up for upcoming duel events
**Role**: DFC Dueler
**Sheets**:
- `{QUERY_SPREADSHEET_ID}/Player List`
- `{QUERY_SPREADSHEET_ID}/Signup Tracker`

**Validation**:
- Checks Roster for active status (empty `leaveStatus`)
- Prevents duplicate signups

### Match Reporting

#### `/reportwin`
**Purpose**: Report match results via Google Form submission
**Role**: DFC Dueler
**Flow**:
1. Select winner/loser via @mentions
2. Validates both players in Roster (active status)
3. Multi-step wizard (6 steps):
   - Match type (HLD/LLD/Melee)
   - Mirror match? (Yes/No)
   - Winner class selection
   - Loser class selection
   - Builds & date entry (modal)
   - Mirror type (if applicable)
   - Match details (title, rounds, notes)
4. Submits to Google Form
5. Form → Sheet trigger → Apps Script transforms data

**Critical Implementation Details**:

**Redis Session Management**:
- Stores user session data in `reportwin_{userId}` key
- TTL: 10 minutes
- Must preserve data between button interactions

**Entry ID Mapping**:
```javascript
// reportwin.js lines 22-95
const PROD_FORM_ENTRIES = { ... };  // Production form entry IDs
const TEST_FORM_ENTRIES = { ... };  // Test form entry IDs
const FORM_ENTRIES = TEST_MODE ? TEST_FORM_ENTRIES : PROD_FORM_ENTRIES;
```

**Important**: Each Google Form has unique entry IDs (e.g., `entry.666586256`). When copying a form for testing, you MUST extract new entry IDs using:
1. Open form preview
2. DevTools → Network tab
3. Submit test data
4. Inspect POST payload to `formResponse`
5. Update entry IDs in `commands/reportwin.js`

**Form Response Flow**:
```
Discord Bot → Google Form (POST /formResponse)
    ↓
Google Sheets (Raw "Duel Data" tab)
    ↓
Apps Script Trigger (onFormSubmit)
    ↓
DUEL_DATA_OUTPUT tab (19 clean columns)
    ↓
ETL OUTPUT tab (per-dueler fact table)
```

**Known Issues**:
- ⚠️ Button interaction must preserve Redis data (see commit e55cd2d)
- ⚠️ Winner/loser names must be stored as `winnerName`/`loserName` in Redis, then mapped to `winner`/`loser` for form submission

### Stats & Analytics

#### `/stats`
**Purpose**: Display player statistics
**Cache**: Duel Data Cache (5 min TTL)
**Source**: `{SSOT_ID}/DUEL_DATA_OUTPUT`

#### `/rankings`
**Purpose**: Show player rankings by match type
**Cache**: Rankings Cache (60 min TTL)
**Parameters**: `matchtype` (hld/lld/melee)

#### `/elo`
**Purpose**: Display player ELO ratings
**Source**: `{SPREADSHEET_ID}/ELO Ratings`

#### `/matchup`
**Purpose**: Head-to-head statistics between two players
**Parameters**: `player1`, `player2`

#### `/recentduels`
**Purpose**: Recent match history
**Limit**: Last 20 duels
**Cache**: Duel Data Cache

#### `/dueltrends`
**Purpose**: Historical duel activity over time

### Administrative

#### `/refreshcache`
**Purpose**: Manually refresh all caches
**Role**: Admin
**Refreshes**:
- Roster Cache
- Duel Data Cache
- Rankings Cache (HLD, LLD, Melee)
- Player List Cache

**Use Case**: After manual sheet edits or when cache is stale

#### `/fightcard`
**Purpose**: Generate randomized tournament matchups
**Role**: Admin
**Source**: Player List Cache

---

## Caching Strategy

### Cache Priority System

1. **Try Redis** (fastest)
   - If connection fails → fallback to Google Sheets
   - If key missing → refresh from Google Sheets → cache result

2. **Fallback to Google Sheets** (slower but reliable)
   - Direct API call
   - No caching on failure

3. **Auto-refresh via Cron** (proactive)
   - Duel Data: Every 5 minutes
   - Roster: Daily at 3 AM
   - Rankings: On-demand (60 min TTL)

### Cache Keys Pattern
```
dfc-data:roster                  # Roster lookup map
dfc-data:roster-timestamp        # Last refresh time
dfc-data:duel-data               # Duel history
dfc-data:rankings-hld            # HLD rankings
dfc-data:rankings-lld            # LLD rankings
dfc-data:rankings-melee          # Melee rankings
dfc-data:player-list             # Active players
reportwin_{userId}               # Reportwin session (10 min TTL)
```

### TTL Strategy
- **Roster**: 7 days (changes infrequently)
- **Duel Data**: 5 minutes (updated frequently)
- **Rankings**: 60 minutes (computationally expensive)
- **Player List**: 60 minutes (event signups)
- **Reportwin Sessions**: 10 minutes (temporary workflow state)

---

## Testing & Development

### Test Environment Setup

1. **Enable Test Mode**:
   ```bash
   # .env
   TEST_MODE=true
   ```

2. **Configure Test Sheets**:
   - Copy production SSOT sheet
   - Copy production Google Form
   - Update Apps Script IDs in both
   - Set response destination in form

3. **Extract Test Form Entry IDs**:
   ```bash
   # See docs/reportwin-test-form-fix.md for detailed guide
   ```

4. **Update Test IDs in Code**:
   - `commands/reportwin.js`: Update `TEST_FORM_ENTRIES`
   - Ensure all 26 entry IDs are mapped (7 classes × 2 sides + core fields)

### Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# View logs
tail -f heroku-logs.txt  # if logging to file
```

### Testing Checklist

- [ ] `/register` creates Roster entry
- [ ] `/signup` validates Roster status
- [ ] `/reportwin` submits to test form
- [ ] Test form writes to test SSOT
- [ ] Apps Script transforms data correctly
- [ ] All 7 classes work in reportwin
- [ ] Redis session preserved through all steps
- [ ] Winner/loser names not undefined

---

## Deployment

### Heroku Basic Dyno

**Platform**: Heroku
**Dyno Type**: Basic ($7/month)
**Region**: US
**Node Version**: 20.x (specified in `package.json`)

### Deployment Steps

```bash
# First time setup
heroku login
heroku git:remote -a your-app-name

# Deploy
git push heroku main

# Set environment variables
heroku config:set BOT_TOKEN=your_token
heroku config:set GOOGLE_CLIENT_EMAIL=your_email
# ... etc for all .env vars

# View logs
heroku logs --tail

# Restart dyno
heroku restart
```

### Environment Variables on Heroku

⚠️ **IMPORTANT**: When setting `GOOGLE_PRIVATE_KEY`:
```bash
# Use quotes and preserve \n characters
heroku config:set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### Dyno Behavior

**Basic Dyno Characteristics**:
- Never sleeps (unlike free/hobby tiers)
- Restarts daily (automatically)
- Loses in-memory state on restart
- Redis persists across restarts
- Cron jobs run continuously

**On Restart**:
1. Redis reconnects automatically
2. Caches are populated on first request
3. Cron jobs resume immediately

### Redis Cloud Setup

1. **Get Redis Cloud Instance**:
   - RedisLabs free tier (30MB sufficient for this bot)
   - Or Heroku Redis add-on

2. **Set Connection URL**:
   ```bash
   heroku config:set REDISCLOUD_URL=redis://default:password@host:port
   ```

3. **Verify Connection**:
   ```bash
   heroku logs --tail | grep "Connected to Redis"
   ```

---

## Troubleshooting

### Common Issues

#### 1. Redis Connection Failures

**Symptom**: Logs show "Redis Client Error" or "Failed to connect to Redis"

**Solution**:
- Verify `REDISCLOUD_URL` is correct
- Check Redis Cloud instance is active
- Bot auto-falls back to Google Sheets (slower but functional)

#### 2. Reportwin 400 Errors

**Symptom**: "WARNING: Unexpected form response status 400"

**Root Causes**:
- **Wrong entry IDs**: Test form uses different IDs than production
  - Solution: Extract entry IDs from test form, update `TEST_FORM_ENTRIES`
- **Undefined winner/loser**: Session data not preserved
  - Solution: Check Redis session management in button handlers
- **Wrong form ID**: Using edit ID instead of response ID
  - Solution: Use `1FAIpQLSe...` format, not `1C3H4e069...` format

**Debug**:
```javascript
// Check logs for:
console.log('Form data being submitted:', data);

// Verify winner/loser are not undefined
winner: undefined,  // ❌ BUG
loser: undefined,   // ❌ BUG
```

#### 3. Cache Not Updating

**Symptom**: `/stats` shows stale data after sheet edits

**Solutions**:
- Run `/refreshcache` to manually refresh
- Check cron job logs for errors
- Verify Google Sheets API quota not exceeded
- Check service account has Editor access to sheet

#### 4. Command Not Responding

**Symptom**: Slash command doesn't appear or fails silently

**Solutions**:
- Check `GUILD_ID` matches Discord server ID
- Verify bot has `applications.commands` scope
- Run command registration (done automatically on bot start)
- Check role requirements (some commands need "DFC Dueler" role)

#### 5. Google Sheets API Errors

**Symptom**: "The caller does not have permission"

**Solutions**:
- Add service account email to sheet as Editor
- Verify `GOOGLE_CLIENT_EMAIL` matches service account
- Check `GOOGLE_PRIVATE_KEY` formatting (must include `\n`)
- Confirm sheet IDs are correct in `.env`

### Debug Logging

Add temporary debug logs:

```javascript
// In any command file
console.log('[DEBUG] Variable name:', variableValue);
console.log('[DEBUG] Redis data:', JSON.stringify(data, null, 2));
```

View logs:
```bash
heroku logs --tail --source app
```

### Health Check Endpoints

The bot exposes HTTP endpoints for monitoring:

```javascript
// index.js
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);
```

**Check**: `https://your-app.herokuapp.com/`

---

## Important Files Reference

### Configuration
- `.env` - Environment variables (gitignored)
- `package.json` - Dependencies and scripts
- `.claude/settings.local.json` - Claude Code settings (gitignored)

### Core
- `index.js` - Main entry point, command loader, cron jobs
- `utils/googleAuth.js` - Google Sheets authentication
- `utils/redisClient.js` - Redis connection manager

### Cache Utilities
- `utils/rosterCache.js` - Player roster cache
- `utils/duelDataCache.js` - Duel history cache
- `utils/rankingsCache.js` - Rankings cache
- `utils/playerListCache.js` - Signup list cache

### Critical Commands
- `commands/reportwin.js` - Match reporting (most complex)
- `commands/register.js` - New player registration
- `commands/refreshcache.js` - Manual cache refresh

### Documentation
- `docs/test-environment-setup.md` - Test environment guide
- `docs/reportwin-test-form-fix.md` - Reportwin troubleshooting
- `.claude/README.md` - This file

### Google Apps Scripts (in root, for reference)
- `duel data.gs` - SSOT sheet transformation script
- `Duel Data Forms.gs` - Form roster dropdown updater

**Note**: These `.gs` files are gitignored but kept in root for easy copy-paste to Google Apps Script editor.

---

## Maintenance Checklist

### Daily
- [ ] Check Heroku logs for errors
- [ ] Verify Redis connection in logs
- [ ] Monitor Google Sheets API quota

### Weekly
- [ ] Review cache hit rates
- [ ] Check for stale data issues
- [ ] Verify cron jobs executing

### Monthly
- [ ] Update dependencies (`npm update`)
- [ ] Review and archive old duel data
- [ ] Check Redis memory usage

### When Switching Test ↔ Production
- [ ] Update `TEST_MODE` in `.env`
- [ ] Restart Heroku dyno
- [ ] Verify correct form/sheet IDs in use
- [ ] Run test submission to confirm

---

## Additional Resources

- **Discord.js Docs**: https://discord.js.org/
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Redis Cloud**: https://redis.com/redis-enterprise-cloud/
- **Heroku Node.js**: https://devcenter.heroku.com/articles/getting-started-with-nodejs

---

## Support & Contribution

For issues, see:
- Heroku logs: `heroku logs --tail`
- Redis logs: Check Redis Cloud dashboard
- Google Sheets API errors: Check service account permissions

This bot was developed with assistance from Claude (Anthropic).

Last Updated: 2025-11-03
