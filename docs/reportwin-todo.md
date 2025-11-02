# Reportwin Command - Implementation

## Current Status
✅ Google Form identified and analyzed - Ready for implementation

## Context
- **Target Tab**: `Duel Data` tab in production spreadsheet
- **Form URL**: https://docs.google.com/forms/d/e/1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg/formResponse
- **Form Title**: DFC Duel Data
- **Complexity**: High - 19 pages with conditional logic based on Mirror/Class selections

## Duel Data Tab Structure
Based on screenshot (`Screenshot 2025-11-02 125318.png`):

| Column | Field Name | Example Value |
|--------|------------|---------------|
| A | Event Date | 5/27/2022 |
| B | Winner | Zee, Chew30, etc. |
| C | W Class | Druid, Assassin, etc. |
| D | W Build | Wind, Hybrid LS, etc. |
| E | Loser | NecessaryPaper, teH-OwneR, etc. |
| F | L Class | Paladin, Sorceress, etc. |
| G | L Build | V/T, Fire ES, etc. |
| H | # Round Losses | 0, 1, 2, 4, etc. |
| I | Match Type | HLD, LLD, Melee |
| J | Exceptions | (empty or special notes) |
| K | Mirror | (boolean or empty) |
| L | Title | (Defend, etc.) |
| M | Notes | (additional info) |

## Implementation Options

### Option A: Direct Sheet Write (Recommended for now)
- Skip Google Form integration
- Write directly to `Duel Data` tab using Google Sheets API
- Use Discord modal for input collection (similar to signup-multi)
- Pros: Full control, immediate implementation
- Cons: Bypasses any form validation/workflow moderators use

### Option B: Google Form Integration
- Find the correct match reporting form URL
- Submit programmatically to the form
- Pros: Maintains existing workflow
- Cons: Need to identify correct form first

## Form Field Mapping

| Field Name | Entry ID | Type | Notes |
|---|---|---|---|
| Duel Date | entry.666586256 | Date | MM/DD/YYYY format |
| Match Type | entry.781478868 | Multiple Choice | HLD, LLD, Melee |
| Title | entry.2023271252 | Multiple Choice | No, Initial, Defend, Reclaim |
| Round Wins | entry.163517227 | Number | Range: 0-20 |
| Round Losses | entry.1181419043 | Number | Range: 0-20 |
| Mirror | entry.609831919 | Multiple Choice | Yes, No |
| Mirror Type | entry.609696423 | Checkbox | Split Server, Single Mirror, Dual Mirror |
| Winner | entry.1277410118 | Dropdown | 200+ player names |
| Winner Class | entry.680532683 | Multiple Choice | 7 classes + DNP |
| Winner [Class] Build | See table below | Multiple Choice | Conditional on class |
| Loser | entry.163644941 | Dropdown | 200+ player names |
| Loser Class | entry.1258194465 | Multiple Choice | 7 classes + DNP |
| Loser [Class] Build | See table below | Multiple Choice | Conditional on class |
| Notes | entry.1405294917 | Long Text | Optional |

### Build Entry IDs by Class

**Winner Builds:**
- Amazon: entry.1213271713
- Assassin: entry.1581661749
- Barbarian: entry.431357945
- Druid: entry.589644688
- Necromancer: entry.1267787377
- Paladin: entry.706357155
- Sorceress: entry.835898849

**Loser Builds:**
- Amazon: entry.1175026707
- Assassin: entry.1900276267
- Barbarian: entry.385883979
- Druid: entry.1436103576
- Necromancer: entry.1513417734
- Paladin: entry.1927282053
- Sorceress: entry.1431447468

## Recommended Command Flow

**Challenge**: Discord modals limited to 5 text inputs. Form has 14+ fields with conditional logic.

**Proposed Multi-Step Flow:**

### Step 1: Match Type Selection (Buttons)
- HLD, LLD, Melee buttons

### Step 2: Mirror Match? (Buttons)
- "Yes - Mirror Match" → Skip to Step 4
- "No - Regular Match" → Continue to Step 3

### Step 3: Player Selection Modal (5 fields)
- Winner Name (text input)
- Winner Class (text input)
- Winner Build (text input)
- Loser Name (text input)
- Loser Class (text input)

### Step 4: Match Details Modal (5 fields)
- Loser Build (text input, only if not mirror)
- Duel Date (text input, MM/DD/YYYY)
- Title (text input: No/Initial/Defend/Reclaim)
- Round Wins (number)
- Round Losses (number)

### Step 5: Optional Details Modal (if needed)
- Mirror Type (if mirror match)
- Notes (optional, long text)

## Testing Strategy

### Option 1: Manual Cleanup (Recommended for now)
**Pros:**
- Tests against real form
- Verifies form integration works
- See exactly what appears in Duel Data tab

**Cons:**
- Need to manually delete test rows after testing
- Risk of leaving test data in production

**How to cleanup:**
1. Note the timestamp of your test submission
2. Open the 'Duel Data' tab (or wherever form responses go)
3. Find the row with your test data (by timestamp/player name)
4. Right-click row number → Delete row
5. Alternatively: Ask moderator for edit access to form responses

### Option 2: Create Test Form (Requires moderator)
**Pros:**
- Safe testing environment
- No risk to production data
- Can test freely

**Cons:**
- Requires moderator to duplicate form
- Need to configure form to point to TEST_SPREADSHEET_ID
- Entry IDs might change in duplicated form

**How to set up:**
1. Ask moderator to duplicate the form
2. Configure duplicate to submit to TEST_SPREADSHEET_ID
3. Update command to use test form URL during development
4. Switch to production form URL when ready

### Option 3: Conditional Form URL (Development toggle)
Add to `.env`:
```
REPORTWIN_FORM_URL=<test-form-url>
PROD_REPORTWIN_FORM_URL=https://docs.google.com/forms/d/e/1FAIpQLSdDZlB_yrCryvzNXaDloGUSmc_TK8PMca5oDpWzaYbaDDOApg/formResponse
```

Use `REPORTWIN_FORM_URL` during testing, then switch.

## Next Steps
1. ✅ Form structure analyzed and entry IDs extracted
2. ⏳ Implement reportwin command with multi-step flow
3. ⏳ Decide on testing strategy with user
4. ⏳ Test command and verify form submission
5. ⏳ Deploy to production

## Environment Variables
- `SPREADSHEET_ID`: Production spreadsheet (1ApQkP-EqC77MK1udc2BNF5eTMpa95pp14Xmtbd20RPA)
- `TEST_SPREADSHEET_ID`: Test environment (1PYqFqOuIF3NOchuyLsIBjVd8DDMM7OSrpHneZkbpJT0)
