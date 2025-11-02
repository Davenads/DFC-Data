# Reportwin Command - Future Implementation

## Current Status
Paused - need to identify the correct Google Form for match result reporting.

## Context
- **Target Tab**: `Duel Data` tab in production spreadsheet
- **Current Issue**: The signup form (https://docs.google.com/forms/d/e/1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/viewform) is for event signups, NOT match results
- **Need**: Find/identify the Google Form that moderators use to submit match results to the `Duel Data` tab

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

## Next Steps (When Resuming)
1. Ask moderator for the match reporting form URL
2. Extract form field IDs using WebFetch
3. Implement modal-based Discord command that:
   - Collects all required fields
   - Submits to Google Form
   - Confirms submission to user
4. Test with TEST_SPREADSHEET_ID first

## Environment Variables
- `SPREADSHEET_ID`: Production spreadsheet (1ApQkP-EqC77MK1udc2BNF5eTMpa95pp14Xmtbd20RPA)
- `TEST_SPREADSHEET_ID`: Test environment (1PYqFqOuIF3NOchuyLsIBjVd8DDMM7OSrpHneZkbpJT0)
