# 🤖 DFC Bot Command Updates

Hey DFC fighters! We've got some exciting new and improved commands to announce. Here are **3 slash commands** that have been enhanced or added to make your DFC experience even better:

## 🆕 `/fightcard` - View Upcoming Matches
**What it does:** Displays the current fight card with all upcoming duels in order
**How it works:** 
- Shows matches exactly as they appear in the Fight Card spreadsheet
- Each match displays: Player1 vs Player2 (Division) with match type
- Divisions shown as HLD (High Level Duels), LLD (Low Level Duels), or Melee
- Sequential numbering from spreadsheet order (row 3 = match #1, etc.)

**Example:**
```
**1.** Muchez vs Polytheist (HLD)
*Zon v Druid*

**2.** Nimrod vs JaggerSwagger (Melee)  
*Din v Din*
```

## ⚔️ `/recentduels` - Track Recent Match Activity
**What it does:** Shows recent duels from the last X days with detailed match information
**How it works:**
- Default shows last 7 days, or specify 1-30 days
- Displays winner/loser, character classes, builds, and match types
- Uses class emojis (🏹 Amazon, 🥷 Assassin, ⚔️ Barbarian, etc.)
- Pulls data from Redis cache for fast performance

**Usage:**
- `/recentduels` - Shows last 7 days
- `/recentduels days:14` - Shows last 14 days (up to 30 max)

## 🔄 `/refreshcache` - Update Match Data (Moderators Only)
**What it does:** Manually refreshes the Redis cache with latest duel data from Google Sheets
**How it works:**
- Requires @Moderator role to use
- Updates cached data for faster command performance
- Automatically runs on scheduled intervals (Thursday 5:30pm ET, Friday 2:00am ET)
- Shows cache timestamp before/after refresh

**When to use:** If you notice commands showing outdated match data

---

## 💡 Command Tips
- **Slash commands** (`/command`) show results privately to you
- **Prefix commands** (`!command`) send results as a DM from the bot
- All three commands support both formats!

Try them out and let us know what you think! 🥊

*Bot updates powered by the DFC development team*