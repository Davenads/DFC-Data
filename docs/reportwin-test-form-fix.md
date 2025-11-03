# Reportwin Test Form Entry ID Fix

## Problem Summary
The `reportwin` command was failing with a 400 Bad Request error when `TEST_MODE=true` because:

1. **Root Cause**: Each Google Form has unique entry IDs for its fields (e.g., `entry.666586256` for duelDate)
2. **The Issue**: The code was hardcoded to use **production form entry IDs** only
3. **What Happened**: When switching to the test form via `TEST_FORM_ID`, the bot submitted data using wrong entry IDs, causing Google Forms to reject the submission

## Solution Implemented

### 1. Updated `reportwin.js` (lines 22-95)
Created separate entry ID constants for production and test environments:

```javascript
// Production Form entry IDs (original, unchanged)
const PROD_FORM_ENTRIES = { ... };

// Test Form entry IDs (extracted from test form)
const TEST_FORM_ENTRIES = { ... };

// Auto-select based on TEST_MODE environment variable
const FORM_ENTRIES = process.env.TEST_MODE === 'true' ? TEST_FORM_ENTRIES : PROD_FORM_ENTRIES;
```

### 2. Fixed Documentation
Updated `docs/test-environment-setup.md` to clarify:
- Test Form Response ID: `1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A` (for bot submissions)
- Test Form Edit ID: `1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg` (for manual editing)

## Entry IDs Extracted from Test Form

### ✅ Confirmed Entry IDs
```javascript
duelDate: 'entry.1895335701'
matchType: 'entry.1592134870'
title: 'entry.510006768'
roundWins: 'entry.526540015'
roundLosses: 'entry.1002526413'
mirror: 'entry.1320054110'
winner: 'entry.2115916997'
winnerClass: 'entry.935484935'
loser: 'entry.1212393589'
loserClass: 'entry.1151669949'
notes: 'entry.1312255002'

// Partial class builds
winnerBuilds.Barbarian: 'entry.526101734'
loserBuilds.Sorceress: 'entry.545772854'
```

### ⚠️ TODO: Missing Entry IDs
The following entry IDs still need to be extracted from the test form:

#### Winner Builds (6 missing):
- Amazon
- Assassin
- Druid
- Necromancer
- Paladin
- Sorceress

#### Loser Builds (6 missing):
- Amazon
- Assassin
- Barbarian
- Druid
- Necromancer
- Paladin

#### Mirror Type
- Checkbox field for mirror type options

## How to Complete the Missing Entry IDs

### Method 1: Use Browser DevTools (Recommended)
1. Open test form: https://docs.google.com/forms/d/e/1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A/viewform
2. Open DevTools (F12) → Network tab
3. Fill out the form completely, selecting each class
4. Click Submit (don't worry, you can delete the test data)
5. Look at the POST request to `formResponse` in the Network tab
6. View the "Payload" tab to see all `entry.XXXXXXX` values
7. Map each entry ID to its corresponding field

### Method 2: Inspect Form HTML
1. Open the test form preview
2. Right-click → View Page Source
3. Search for `entry.` to find all entry IDs
4. Match them to field names by looking at nearby HTML context

### Method 3: Use the Script in the Repo
```bash
# Run the extraction script (if created)
node scripts/extract-form-entries.js test-form.html
```

## Updating the Code

Once you have the missing entry IDs, update `commands/reportwin.js` lines 73-91:

Replace `'entry.TODO'` with the actual entry IDs you found.

Example:
```javascript
winnerBuilds: {
    Amazon: 'entry.1234567',       // Replace TODO with actual ID
    Assassin: 'entry.7654321',     // Replace TODO with actual ID
    Barbarian: 'entry.526101734',  // Already filled in
    // ...
}
```

## Testing After Completion

1. Set `TEST_MODE=true` in `.env`
2. Restart the bot: `npm start`
3. Run `/reportwin` in test Discord server
4. Complete the full flow with a class that was previously TODO
5. Check the test SSOT sheet "Duel Data" tab for the submission
6. Verify no 400 errors in console logs

## Temporary Workaround

If you need to test immediately before completing all entry IDs:

**Option A:** Only test with Barbarian winner / Sorceress loser (the two classes we have)

**Option B:** Temporarily use production form for testing:
```bash
# In .env, temporarily set:
TEST_FORM_ID=1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg  # prod form
TEST_SSOT_ID=137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms  # test sheet
```

This will use production entry IDs (which work) but write to test sheet (safe to delete).

⚠️ **Risk**: Production form submissions will appear in test sheet, which might be confusing.

## Key Learnings

1. **Google Forms entry IDs are unique per form** - copying a form generates new entry IDs
2. **Entry IDs != Form IDs** - The form ID remains constant, but entry IDs change on copy
3. **Test and prod must have separate entry ID mappings** when using copied forms
4. **Always validate with a test submission** after switching forms

## Files Modified
- `commands/reportwin.js` (lines 22-95)
- `docs/test-environment-setup.md` (lines 7-9, 15, 33)
- `.env` (already correct, no changes needed)
