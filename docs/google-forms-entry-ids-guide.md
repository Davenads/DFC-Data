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
