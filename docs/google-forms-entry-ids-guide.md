# Google Forms Entry IDs - Complete Guide

## Problem Summary

The `/reportwin` command was failing with 400 errors when submitting to the test Google Form. Root cause: **Entry ID mismatch** between code and actual form fields.

## Key Concepts

### 1. Google Form IDs (Two Types)

Google Forms have **TWO different ID formats**:

1. **Edit/Management ID** (~44 characters):
   - Example: `1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg`
   - Used in: `/d/{ID}/edit` and `/d/{ID}/preview`

2. **Public/Submission ID** (~56 characters, starts with `1FAIpQL`):
   - Example: `1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A`
   - Used in: `/d/e/{ID}/viewform` and `/d/e/{ID}/formResponse`

**Both IDs refer to the SAME form.**

### 2. Form Entry IDs

Each **question/field** in a Google Form has a unique **entry ID** like `entry.1592134870`.

- These IDs are used when submitting form data programmatically
- Format: `entry.XXXXXXXXX` where X is a number
- **Entry IDs DO NOT change** when you copy a form (usually)
- Entry IDs CAN be different between forms even if questions are identical

## Our Forms

### Production Form
- **Form ID (public):** `1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg`
- **SSOT Sheet ID:** `19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw`
- **Entry IDs:** See `PROD_FORM_ENTRIES` in `commands/reportwin.js` lines 23-56

### Test Form
- **Form ID (edit):** `1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg`
- **Form ID (public):** `1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A`
- **SSOT Sheet ID:** `137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms`
- **Entry IDs:** See `TEST_FORM_ENTRIES` in `commands/reportwin.js` lines 59-94
- **IMPORTANT:** Test form currently uses the **SAME** entry IDs as production! (Verified 2025-11-05)

## How to Extract Entry IDs from a Form

### Method 1: Chrome DevTools Console (Fastest)

1. Open form in **public view mode**: `https://docs.google.com/forms/d/e/{PUBLIC_FORM_ID}/viewform`
   - **NOT preview mode** (`/preview`)
   - **NOT edit mode** (`/edit`)

2. Open Chrome DevTools (F12) → Console tab

3. Paste and run this script:

```javascript
const entries = {};
document.querySelectorAll('[name^="entry."]').forEach(el => {
    const name = el.getAttribute('name');
    const label = el.closest('[role="listitem"]')?.querySelector('[role="heading"]')?.textContent ||
                  el.closest('.freebirdFormviewerComponentsQuestionBaseRoot')?.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle')?.textContent ||
                  'Unknown';
    entries[label.trim()] = name;
});
console.table(entries);
```

4. Copy the entry IDs from the table output

### Method 2: Inspect Individual Fields

1. Open form in public view mode
2. Right-click on any input field → "Inspect"
3. Look for `name="entry.XXXXXXXXX"` attribute
4. That's your entry ID!

### Method 3: View Page Source

1. Open form in public view mode
2. Press Ctrl+U (View Page Source)
3. Search (Ctrl+F) for: `entry.`
4. All entry IDs will be visible in the source

## Common Mistakes to Avoid

### ❌ WRONG: Using Edit/Preview Mode
```javascript
// DON'T extract entry IDs from these URLs:
https://docs.google.com/forms/d/{EDIT_ID}/edit
https://docs.google.com/forms/d/{EDIT_ID}/preview
```

**Why:** Preview/edit mode adds `_sentinel` suffixes and may show cached/incorrect data.

### ✅ CORRECT: Use Public View Mode
```javascript
// DO extract entry IDs from this URL:
https://docs.google.com/forms/d/e/{PUBLIC_ID}/viewform
```

### ❌ WRONG: Assuming Copied Forms Have Same Entry IDs
Even though copying a form often preserves entry IDs, **always verify** after copying.

### ❌ WRONG: Using WebFetch Without Verification
The WebFetch tool can return stale/cached results. **Always verify with browser console.**

## Troubleshooting Form Submission 400 Errors

### Symptoms
- Form submission returns HTTP 400
- Google returns "Something went wrong" error page
- Heroku logs show form submission failure

### Diagnosis Steps

1. **Verify TEST_MODE environment variable:**
   ```bash
   # In Heroku Dashboard → Settings → Config Vars
   TEST_MODE = true   # ✅ lowercase, no quotes
   ```

2. **Verify form IDs match:**
   - `.env` (local): `TEST_FORM_ID=1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A`
   - Heroku Config Vars: Same value

3. **Extract entry IDs from actual form** (Method 1 above)

4. **Compare with `TEST_FORM_ENTRIES` in reportwin.js**
   - If they don't match → Update the code
   - If they match → Check other environment variables

### Fix Process

1. Extract correct entry IDs using Method 1 above
2. Update `TEST_FORM_ENTRIES` in `commands/reportwin.js`
3. Commit and push changes
4. Verify deployment completes in Heroku
5. Test `/reportwin` command in Discord

## Current Entry IDs (as of 2025-11-05)

### TEST_FORM_ENTRIES
**Note:** Test form currently uses the same entry IDs as production.

```javascript
const TEST_FORM_ENTRIES = {
    duelDate: 'entry.666586256',
    matchType: 'entry.781478868',
    title: 'entry.2023271252',
    roundWins: 'entry.163517227',
    roundLosses: 'entry.1181419043',
    mirror: 'entry.609831919',
    mirrorType: 'entry.609696423',
    winner: 'entry.1277410118',
    winnerClass: 'entry.680532683',
    loser: 'entry.163644941',
    loserClass: 'entry.1258194465',
    notes: 'entry.1405294917',
    winnerBuilds: {
        Amazon: 'entry.1213271713',
        Assassin: 'entry.1581661749',
        Barbarian: 'entry.431357945',
        Druid: 'entry.589644688',
        Necromancer: 'entry.1267787377',
        Paladin: 'entry.706357155',
        Sorceress: 'entry.835898849'
    },
    loserBuilds: {
        Amazon: 'entry.1175026707',
        Assassin: 'entry.1900276267',
        Barbarian: 'entry.385883979',
        Druid: 'entry.1436103576',
        Necromancer: 'entry.1513417734',
        Paladin: 'entry.1927282053',
        Sorceress: 'entry.1431447468'
    }
};
```

### PROD_FORM_ENTRIES
```javascript
const PROD_FORM_ENTRIES = {
    duelDate: 'entry.666586256',
    matchType: 'entry.781478868',
    title: 'entry.2023271252',
    roundWins: 'entry.163517227',
    roundLosses: 'entry.1181419043',
    mirror: 'entry.609831919',
    mirrorType: 'entry.609696423',
    winner: 'entry.1277410118',
    winnerClass: 'entry.680532683',
    loser: 'entry.163644941',
    loserClass: 'entry.1258194465',
    notes: 'entry.1405294917',
    winnerBuilds: {
        Amazon: 'entry.1213271713',
        Assassin: 'entry.1581661749',
        Barbarian: 'entry.431357945',
        Druid: 'entry.589644688',
        Necromancer: 'entry.1267787377',
        Paladin: 'entry.706357155',
        Sorceress: 'entry.835898849'
    },
    loserBuilds: {
        Amazon: 'entry.1175026707',
        Assassin: 'entry.1900276267',
        Barbarian: 'entry.385883979',
        Druid: 'entry.1436103576',
        Necromancer: 'entry.1513417734',
        Paladin: 'entry.1927282053',
        Sorceress: 'entry.1431447468'
    }
};
```

## Quick Reference

| Environment | Form ID (Public) | SSOT Sheet ID |
|-------------|------------------|---------------|
| Production | `1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg` | `19kLTnQCXMQkXbQw90G9QQcrYtxDszTtVMWM0JLq0aaw` |
| Test | `1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A` | `137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms` |

## Related Files

- **Environment Config:** `.env` (local), Heroku Config Vars (production)
- **Form Entry IDs:** `commands/reportwin.js` lines 23-92
- **Form Submission Logic:** `commands/reportwin.js` lines 899-1015

---

## Advanced Troubleshooting: Persistent 400 Errors (November 2025)

### Issue Summary

**Date:** November 6, 2025
**Symptom:** `/reportwin` command with `test-mode=true` returns 400 error from Google Forms
**Status:** UNDER INVESTIGATION

### Verified Working Components ✅

1. **Entry IDs are correct** - Verified via WebFetch extraction on 2025-11-06:
   - All entry IDs in `TEST_FORM_ENTRIES` match the actual test form
   - No mismatches found

2. **Form is properly configured:**
   - Form is accepting responses (no "closed" message)
   - Form is linked to correct TEST SSOT sheet (137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms)
   - Verified via form edit → Responses tab → shows correct destination

3. **Environment variables in Heroku are correct:**
   - `TEST_MODE=true`
   - `TEST_FORM_ID=1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A`
   - `TEST_SSOT_ID=137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms`

### Troubleshooting Attempts

#### Attempt 1: Mirror Type Field Required Issue
**Discovery:** Mirror Type field had red asterisk (required) in form
**Theory:** When Mirror=No, the field is empty but required, causing 400
**Fix Applied (Commit e583278):**
```javascript
// Added else clause to send empty string for Mirror Type
if (data.mirrorTypes && data.mirrorTypes.length > 0) {
    data.mirrorTypes.forEach(type => {
        formData.append(FORM_ENTRIES.mirrorType, type);
    });
} else {
    formData.append(FORM_ENTRIES.mirrorType, '');
}
```
**Result:** Still 400 error. POST body showed `entry.609696423=` (empty value sent)

---

#### Attempt 2: Don't Send Mirror Type When Mirror=No
**Theory:** Sending empty string still triggers validation. Skip field entirely.
**Fix Applied (Commit a1535ea):**
```javascript
// Only send Mirror Type if isMirror is true
if (data.isMirror && data.mirrorTypes && data.mirrorTypes.length > 0) {
    data.mirrorTypes.forEach(type => {
        formData.append(FORM_ENTRIES.mirrorType, type);
    });
}
```
**Result:** Still 400 error. POST body no longer includes `entry.609696423`

---

#### Attempt 3: Made Mirror Type NOT Required in Form
**Action:** Removed "Required" toggle from Mirror Type field in Google Form settings
**Verified:** Red asterisk removed from Mirror Type field
**Note:** Mirror (Yes/No) remains required, but Mirror Type (checkbox options) is NOT required
**Result:** Still 400 error (as of 2025-11-06 05:23 UTC)

---

#### Attempt 4: Enhanced Error Logging (Commit cfc14a1)
**Added detailed logging to diagnose exact failure:**
```javascript
// New logging added:
console.error(`[${timestamp}] ❌ FORM SUBMISSION FAILED - STATUS ${formResponse.status}`);
console.error(`[${timestamp}] 📝 FULL POST BODY:`, postBody);
// Extract error from Google Forms HTML response
const titleMatch = responseText.match(/<title>([^<]+)<\/title>/);
// Check for "required question" messages
if (responseText.includes('required question') || responseText.includes('Required')) {
    console.error(`[${timestamp}] ⚠️  Google Forms says a REQUIRED field is missing`);
}
```
**Status:** Deployed, awaiting next test run

### Sample Error Logs

**Most Recent Test (2025-11-06 03:52:48 UTC):**
```
[2025-11-06T03:52:48.890Z] TEST MODE: Submitting to Google Form...
[2025-11-06T03:52:48.890Z] Form ID: 1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A
[2025-11-06T03:52:48.890Z] POST body: entry.666586256=11%2F06%2F2025&entry.781478868=HLD&entry.2023271252=No&entry.163517227=6&entry.1181419043=4&entry.609831919=No&entry.609696423=&entry.1277410118=Mantrayana&entry.680532683=Amazon&entry.1213271713=t1&entry.163644941=Foozerman&entry.1258194465=Assassin&entry.1900276267=t2
[2025-11-06T03:52:48.890Z] Form submission status: 400
```

### Data Being Submitted (Example)
```javascript
{
  duelDate: '11/06/2025',
  matchType: 'HLD',
  title: 'No',
  roundWins: '6',
  roundLosses: '4',
  mirror: 'No',
  mirrorTypes: [],
  winner: 'Mantrayana',
  winnerClass: 'Amazon',
  winnerBuild: 't1',
  loser: 'Foozerman',
  loserClass: 'Assassin',
  loserBuild: 't2',
  notes: ''
}
```

### Outstanding Questions

1. **Manual form submission test needed:**
   - Does submitting the form manually through browser with Mirror=No work?
   - What values does a successful browser submission send?
   - Is there a hidden field or token we're missing?

2. **Possible hidden validation rules:**
   - Are there conditional validation rules in the form?
   - Does the form use sections that affect field visibility?
   - Are there any Google Apps Script triggers on form submission?

3. **Date format validation:**
   - Is `11/06/2025` (MM/DD/YYYY) accepted by the form?
   - Does the form expect a different date format for future dates?

4. **Player name validation:**
   - Are "Mantrayana" and "Foozerman" in the dropdown list?
   - Does the form validate player names against the roster?

5. **Build name validation:**
   - Are "t1", "t2", "t3" valid options for build names?
   - Does the form expect different build name formats?

### Next Debugging Steps

1. **Analyze enhanced error logs** from next test run (commit cfc14a1)
2. **Manual browser test:** Submit form manually with identical data
3. **Inspect browser network traffic:** Use DevTools to see what a successful submission sends
4. **Check for form scripts:** Verify no Google Apps Script is blocking submissions
5. **Test with minimal data:** Try submitting with just required fields
6. **Compare production vs test:** Does production form work with same data?

### Commits Related to This Investigation

- `e583278` - Fix 400 error by sending empty string for Mirror Type
- `a1535ea` - Don't send Mirror Type field when Mirror=No
- `cfc14a1` - Add detailed error logging for form submission failures

### Form Configuration Snapshots

**Test Form Settings (as of 2025-11-06):**
- Edit URL: https://docs.google.com/forms/d/1C3H4e069VL8qvR3JC3QsXG3LbHZ3s94HG1Q2NhbPAzg/edit
- Public URL: https://docs.google.com/forms/d/e/1FAIpQLSe5Vx_8h4PCn46JzJ_WVohVIGkQwy6HZ4eGXrjKAqO8_o8d3A/viewform
- Response Destination: Confirmed linked to TEST SSOT (137CZt90ZNoL66n0UohpD9y7m7nqQTk-b5UmMjfaJVms)
- Accepting Responses: Yes
- Require Sign-In: No
- Limit to 1 Response: No
- Mirror (Yes/No): REQUIRED ✓
- Mirror Type (checkboxes): NOT REQUIRED ✓

**Debug Screenshots Location:** `debug-ss/` folder (latest screenshots show form configuration)
