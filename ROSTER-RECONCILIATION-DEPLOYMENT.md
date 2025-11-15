# DFC Roster Reconciliation - Deployment Guide

## Overview

This script automatically detects Discord username changes by comparing the Roster against recent signup submissions, preventing duplicate user entries in analytics.

---

## Prerequisites

- Access to `[DFC] Official Rankings` Google Sheet (QUERY_SPREADSHEET_ID)
- Editor permissions on the sheet
- Understanding that this will modify Roster data (Column C: Discord Name)

---

## Deployment Steps

### 1. Open [DFC] Official Rankings Sheet

Navigate to: `https://docs.google.com/spreadsheets/d/17PlXUTm83d8YjtKfG9hl0Y6gpzBhKwa7iYLjN0mi4Cg`

### 2. Open Apps Script Editor

- Click **Extensions** → **Apps Script**
- You'll see the Apps Script editor open in a new tab

### 3. Create New Script File

- Delete any default code in `Code.gs` (if present)
- Copy the entire contents of `roster-reconciliation.gs` from this repo
- Paste into the Apps Script editor
- **File** → **Save** (or Ctrl+S)
- Name the project: **"DFC Roster Reconciliation"**

### 4. Authorize the Script

- Click **Run** → Select **`onOpen`** function
- Click the **Run** button (▶️)
- You'll be prompted to authorize:
  1. Click **Review permissions**
  2. Choose your Google account
  3. Click **Advanced** → **Go to DFC Roster Reconciliation (unsafe)**
  4. Click **Allow**

### 5. Refresh the Google Sheet

- Go back to the `[DFC] Official Rankings` spreadsheet tab
- Refresh the page (F5 or Ctrl+R)
- You should now see a new menu: **🔄 DFC Roster Tools**

### 6. Test the Script (Manual Run)

- Click **🔄 DFC Roster Tools** → **Check for Discord Handle Changes**
- The script will:
  1. Read last 90 days of signups from "DFC Signups" tab
  2. Compare against "Roster" tab
  3. Create a review sheet (e.g., "Handle Changes 2025-11-20")
  4. Show a summary dialog

### 7. Review the Output

- Open the newly created "Handle Changes YYYY-MM-DD" sheet
- Review suggested matches:
  - 🟢 **Green rows** (80%+): High confidence - likely correct
  - 🟡 **Yellow rows** (50-79%): Medium confidence - review carefully
  - 🔴 **Red rows** (<50%): Low confidence - likely new users

### 8. Approve Updates

- For matches you want to apply:
  1. Change **Status** column from `REVIEW` to `APPROVED`
  2. Verify **Action** column is `UPDATE`
- Click **🔄 DFC Roster Tools** → **Apply Approved Updates to Roster**
- The script will update Roster Column C with new Discord handles

### 9. Invalidate Cache (IMPORTANT!)

After applying updates, you MUST refresh the cached roster data:

**In Discord**, run:
```
/refreshcache
```

This ensures the bot picks up the updated Discord names.

### 10. Set Up Weekly Trigger (Optional but Recommended)

For automatic weekly checks:

- Click **🔄 DFC Roster Tools** → **⚙️ Setup Weekly Trigger**
- This creates a trigger that runs **every Wednesday at 9:00am ET**
- You can manage triggers in: **Extensions** → **Apps Script** → **Triggers** (clock icon ⏰)

---

## Configuration Options

Edit the `CONFIG` object at the top of the script to customize:

```javascript
const CONFIG = {
  ROSTER_SHEET: 'Roster',                    // Sheet containing roster data
  SIGNUP_SOURCE_SHEET: 'DFC Signups',        // Sheet containing signup data
  DAYS_TO_CHECK: 90,                         // How many days back to check signups
  AUTO_UPDATE_ROSTER: false,                 // Set true for auto-update (risky!)

  NOTIFY_EMAIL: '',                          // Your email for notifications

  HIGH_CONFIDENCE: 80,     // Green threshold
  MEDIUM_CONFIDENCE: 50,   // Yellow threshold
};
```

**To enable email notifications**:
1. Set `NOTIFY_EMAIL: 'your-email@example.com'`
2. Save the script
3. You'll receive emails when handle changes are detected

---

## Weekly Workflow

Once the trigger is set up, the weekly workflow is:

**Wednesday 9:00am ET** (Automatic):
- Script runs automatically
- Creates review sheet: "Handle Changes YYYY-MM-DD"
- (Optional) Sends email notification

**Wednesday morning** (Manual - 5 min):
- Open review sheet
- Review suggestions
- Change "REVIEW" to "APPROVED" for confirmed matches
- Click: **🔄 DFC Roster Tools** → **Apply Approved Updates to Roster**

**After updates**:
- Run `/refreshcache` in Discord

---

## Troubleshooting

### "Cannot find 'Roster' sheet"
- Check that the sheet name is exactly `Roster` (case-sensitive)
- Verify you're in the correct spreadsheet (`[DFC] Official Rankings`)

### "Cannot find 'DFC Signups' sheet"
- Check that the sheet name is exactly `DFC Signups` (case-sensitive)
- This should be the raw Google Form response tab

### No changes detected
- Check that there are signups in the last 90 days
- Verify that Discord handles in signups differ from Roster
- Reduce `DAYS_TO_CHECK` if needed

### Script takes too long / times out
- Reduce `DAYS_TO_CHECK` to 30 or 60 days
- Reduce the range in line 78: `signupSheet.getRange('A2:E10000')` to fewer rows

### Updates not appearing in Discord bot
- Make sure you ran `/refreshcache` in Discord after applying updates
- Wait 1-2 minutes for cache to refresh
- Check that Roster SSoT is in `[DFC] Official Rankings` (not Data Input)

---

## Data Flow Summary

```
Google Form (Voxel or /signup)
   ↓
"DFC Signups" tab (raw, all-time)
   ↓
Script runs (Wednesday 9am ET)
   ↓
Compares against "Roster" tab
   ↓
Creates "Handle Changes YYYY-MM-DD" sheet
   ↓
Moderator reviews + approves
   ↓
Script updates "Roster" Column C (Discord Name)
   ↓
/refreshcache in Discord
   ↓
Bot picks up updated names
```

---

## Security Notes

- The script only has access to `[DFC] Official Rankings` spreadsheet
- It can read "DFC Signups" and "Roster" tabs
- It can write to "Roster" Column C (Discord Name) only
- It creates new tabs for review sheets
- All changes are logged in Apps Script execution logs

---

## Support

If you encounter issues:

1. Check **Apps Script Logs**: **View** → **Logs** (or Ctrl+Enter)
2. Check **Executions**: **View** → **Executions** to see recent runs
3. Verify sheet tab names match exactly (case-sensitive)
4. Ensure signup data exists in last 90 days

---

## Maintenance

**Monthly**:
- Review false positives/negatives
- Adjust confidence thresholds if needed
- Clean up old "Handle Changes" sheets (archive after 3 months)

**When Discord allows more frequent username changes**:
- Increase run frequency (e.g., twice per week)
- Or decrease `DAYS_TO_CHECK` to reduce noise

**When Voxel adds UUID capture** (future enhancement):
- Update script to use UUID matching for 100% accuracy
- See "Mitigation Strategy 1" in `google-sheets-structure.md`

---

## Next Steps (Optional Enhancements)

1. **Enable UUID capture in Voxel form** (ask Surely)
   - Would eliminate fuzzy matching entirely
   - 100% accurate handle change detection

2. **Auto-update high confidence matches** (95%+)
   - Set `AUTO_UPDATE_ROSTER: true` (use cautiously!)
   - Requires thorough testing first

3. **Bot integration** (future)
   - Enhance `/signup` to also submit UUID
   - Script can use UUID for definitive matching

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Trigger Status**: ⬜ Not Set Up  |  ⬜ Set Up (Wednesday 9am ET)
**Email Notifications**: ⬜ Disabled  |  ⬜ Enabled (email: _____________)
