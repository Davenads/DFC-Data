# Test Environment Setup Guide

## Overview
This guide explains how to configure your copied test form and SSOT sheet for safe reportwin testing.

## Test Environment IDs
- **Test SSOT Sheet**: `137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms`
- **Test Form**: `1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg`

---

## Step 1: Configure Test Form Response Destination

1. Open your test form: https://docs.google.com/forms/d/1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg/edit
2. Click the **"Responses"** tab at the top
3. Click the **three-dot menu** (⋮) → **"Select response destination"**
4. Choose **"Select existing spreadsheet"**
5. Select your test SSOT sheet: `137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms`
6. The form will create a new tab called **"Form Responses 1"** with 28 columns matching the raw structure

**Important**: Keep this tab - it's the raw data source. The transformation script will read from it.

---

## Step 2: Update Form's Roster Script

1. In your test form editor, go to **Extensions** → **Apps Script**
2. Find the script file (likely named `Duel Data Forms.gs`)
3. Update lines 2-3 with your test IDs:

```javascript
const FORM_ID = '1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg';  // your TEST Form
const SHEET_ID = '137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms'; // your TEST SSOT Sheet
```

4. Save the script (Ctrl+S or Cmd+S)
5. **Optional**: Set up triggers:
   - Click **Triggers** (clock icon in left sidebar)
   - Add trigger: `updateWinnerLoserChoices` → **On form open**
   - This keeps the Winner/Loser dropdowns synced with Roster

---

## Step 3: Update SSOT Sheet's Transformation Script

1. Open your test SSOT sheet: https://docs.google.com/spreadsheets/d/137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms/edit
2. Go to **Extensions** → **Apps Script**
3. Find the script (likely named `duel data.gs`)
4. Update line 2 with your test SSOT ID:

```javascript
const SHEET_ID = '137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms';
```

5. **Verify the source sheet name** (line 3):
```javascript
const SOURCE_SHEET = 'Duel Data';  // Should match the tab name in your test sheet
```

**Note**: If the form created a tab named "Form Responses 1", either:
- Rename it to "Duel Data", OR
- Change line 3 to: `const SOURCE_SHEET = 'Form Responses 1';`

6. Save the script (Ctrl+S or Cmd+S)

---

## Step 4: Set Up Transformation Trigger

This makes the script automatically process form responses:

1. In the SSOT sheet's Apps Script editor, click **Triggers** (clock icon)
2. Click **"+ Add Trigger"** (bottom right)
3. Configure:
   - **Function**: `buildDuelLog`
   - **Deployment**: Head
   - **Event source**: From spreadsheet
   - **Event type**: On form submit
4. Save the trigger

**What this does**: Every time the bot submits to the form, the script will:
- Read raw "Duel Data" (28 cols)
- Consolidate 7 Winner build columns → 1 "Winner Build"
- Consolidate 7 Loser build columns → 1 "Loser Build"
- Generate Duel_ID (e.g., D0001)
- Compute "Class Matchup" and "Build Matchup"
- Write to "DUEL_DATA_OUTPUT" (19 cols)

---

## Step 5: Initial Manual Run (One-Time Setup)

Before testing the bot, manually run the script once to set up the output tab:

1. In SSOT sheet's Apps Script editor
2. Select function: **`buildDuelLog`** (dropdown at top)
3. Click **Run** (▶️ play button)
4. Grant permissions when prompted
5. Check your test SSOT sheet - you should now see:
   - **"DUEL_DATA_OUTPUT"** tab (19 columns)
   - **"ETL OUTPUT"** tab (per-dueler fact table)

---

## Step 6: Bot Configuration (Already Done)

The bot has been configured in `.env`:
```
# Production Environment (TEST_MODE=false)
PROD_SSOT_ID=19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw
PROD_FORM_ID=1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg

# Test Environment (TEST_MODE=true)
TEST_SSOT_ID=137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms
TEST_FORM_ID=1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A

# Mode: true=test environment, false=production environment
TEST_MODE=true
```

**How it works:**
- `TEST_MODE=true` → Bot submits to test form + test SSOT
- `TEST_MODE=false` → Bot submits to production form + production SSOT

---

## Testing Flow

### Test Environment (TEST_MODE=true):
1. Bot submits to **test form** (1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A)
2. Form writes to test SSOT "Duel Data" tab (28 cols)
3. Trigger runs → script transforms data
4. Check test SSOT "DUEL_DATA_OUTPUT" tab for clean 19-col output
5. Safe to delete test data freely

### Production Environment (TEST_MODE=false):
1. Bot submits to **production form** (1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg)
2. Form writes to production SSOT "Duel Data" tab (28 cols)
3. Trigger runs → script transforms data
4. Data appears in production SSOT "DUEL_DATA_OUTPUT" tab
5. ⚠️ **Permanent data** - coordinate deletions with sound if needed

---

## Verification Checklist

Before testing with the bot:

- [ ] Test form responses point to test SSOT sheet
- [ ] Form script updated with test IDs
- [ ] SSOT script updated with test ID
- [ ] Source sheet name matches (line 3 in script)
- [ ] Trigger set up (On form submit → buildDuelLog)
- [ ] Manual script run successful (DUEL_DATA_OUTPUT exists)
- [ ] Bot .env configured with test IDs

---

## Troubleshooting

**Problem**: Form submissions don't appear in SSOT sheet
- Check Responses tab in form - verify destination is correct
- Try test submission via form UI to verify connection

**Problem**: DUEL_DATA_OUTPUT is empty after form submission
- Check Apps Script **Executions** (left sidebar)
- Look for errors in recent runs
- Verify trigger is active (Triggers page)
- Manually run `buildDuelLog()` to see errors

**Problem**: Script error "Source sheet not found"
- Verify line 3 matches actual tab name
- Check if form created "Form Responses 1" instead of "Duel Data"

**Problem**: Build consolidation not working
- Script looks for columns matching regex: `/^winner .* build$/` and `/^loser .* build$/`
- Verify form column headers include "Winner [Class] Build"

---

## Switch to Production

When ready to go live:

1. **Change one line in `.env`:**
   ```
   TEST_MODE=false
   ```

2. **That's it!** The bot will now:
   - Submit to production form
   - Write to production SSOT
   - Data becomes permanent

3. **To switch back to testing:**
   ```
   TEST_MODE=true
   ```

No need to change any other configuration - the bot automatically switches between test and production environments based on TEST_MODE.
