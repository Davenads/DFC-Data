# Voxel UUID Integration - Complete Implementation Guide

**Last Updated**: November 2025
**Status**: Implementation Ready
**Audience**: Internal (Sound/Developer) and External (Surely)

---

## Executive Summary

This document outlines the implementation of Discord UUID (user ID) capture in the DFC signup form via Voxel OAuth integration. UUID capture eliminates duplicate user entries caused by Discord username changes, removing the need for recurring manual reconciliation and achieving 100% accurate user matching.

**Key Benefits**:
- Eliminates duplicate user entries from username changes
- Removes need for weekly manual review process
- Achieves 100% accurate user matching via permanent identifier
- Self-healing system (accuracy improves as users sign up)
- One-time setup with no ongoing maintenance

---

## Problem Statement

### Current Issue

When Discord users change their username (e.g., "Bruno" → "xXDarkLord420Xx"), the roster validation system breaks:

**Root Cause**:
- Roster tab stores Discord username in Column C
- Signup submissions use current Discord username
- "Roster Presence" validation formula does case-sensitive username lookup
- Username changes cause lookup failure → returns "Not Found"

**Impact**:
- 47 out of 251 roster entries (18.7%) affected
- "Not Found" appears in match reporting form dropdowns
- Duplicate user entries in analytics and rankings
- Broken player stat histories
- Requires weekly manual reconciliation process

### Why Username-Based Matching Fails

Discord usernames are mutable. Users can change them at any time:
- "Bruno" → "xXDarkLord420Xx" (complete rename)
- "OldHandle" → "NewHandle123" (rebranding)
- "TestUser" → "ProPlayer" (account maturation)

No amount of fuzzy matching or case-insensitive comparison can reliably track users across arbitrary username changes.

**The only permanent identifier**: Discord user ID (UUID) - a numeric ID that never changes.

---

## Current Architecture

### Data Flow (Username-Based)

```
User signs up via Voxel form
   ↓
Discord OAuth → Voxel captures username only
   ↓
Google Form Column B: Discord Handle (entry.2092238618)
   ↓
[DFC] Official Rankings → "DFC Signups" tab
   ↓
ARRAYFORMULA → "DFC Recent Signups" (flattened, last 10 days)
   ↓
IMPORTRANGE → [DFC] Data Input "Recent Signups" (Columns A-E)
   ↓
Column F "Roster Presence" formula validates username:
   =MAP(B2:B, LAMBDA(b,
     IF(b="","",
       IFERROR(
         INDEX(FILTER(Roster!B:B, Roster!C:C=b), 1),  ← Case-sensitive lookup
         "Not Found"
       )
     )
   ))
   ↓
Duel Data Forms.gs reads Column F
   ↓
Updates match reporting form "Winner"/"Loser" dropdowns
   ↓
User reports match via dropdown selection
```

### Roster Presence Formula (Current)

**Location**: `[DFC] Data Input` → "Recent Signups" → Column F

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

**How it works**:
1. Takes Discord Handle from signup (Column B)
2. Searches Roster for match in Arena Name, Data Name, OR Discord Name
3. Returns Data Name if found
4. Returns "Not Found" if no match

**Critical Flaw**:
- Case-sensitive: "bruno" ≠ "Bruno"
- Username-dependent: fails when username changes completely
- No fallback to permanent identifier

---

## Voxel Technical Analysis

### Source Code Discovery

**Repository**: [Voxel-Fox-Ltd/Website](https://github.com/Voxel-Fox-Ltd/Website/blob/master/website/frontend.py#L68-L104)

**Key Finding**: Voxel ALREADY supports Discord UUID capture via the `i=` parameter.

### Voxel gforms Function

```python
@routes.get("/gforms")
@requires_login()
async def gforms(request: Request):
    """
    Redirect to Google forms with given items filled in with session data.
    """

    # Get our login info
    session = await aiohttp_session.get_session(request)
    if "discord" not in session:
        session["login_message"] = "Discord login is required."
        return HTTPFound("/login")

    # Get the form info
    alias = request.query.get('a')
    form_id = request.query.get('f', None)
    username = request.query.getall('u', list())  ← Username entry IDs
    user_id = request.query.getall('i', list())   ← User ID entry IDs

    # Redirect them
    uif = session["discord"]  ← Discord OAuth session data
    params = {
        **{
            f"entry.{i}": f"{uif['id']}"  ← Discord user ID (UUID)
            for i in user_id
        },
    }
    if "username" in uif:
        params.update({
            f"entry.{u}": uif['username']  ← Discord username
            for u in username
        })
    return HTTPFound(
        f"https://docs.google.com/forms/d/e/{form_id}"
        f"/viewform?{urlencode(params)}"
    )
```

### Parameter Explanation

**`u=` parameter**:
- Accepts one or more Google Form entry IDs
- Populates those fields with `uif['username']` (Discord username)
- Currently: `u=2092238618` populates Column B

**`i=` parameter**:
- Accepts one or more Google Form entry IDs
- Populates those fields with `uif['id']` (Discord user ID/UUID)
- Currently: `i=` (empty - no form field to populate)

**Key Insight**: The `i=` parameter is fully implemented in Voxel. Implementation blocked only by missing form field.

### Current Voxel URL

```
https://voxelfox.co.uk/gforms?f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/&u=2092238618&i=
```

**Parameters**:
- `f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/` - Form ID
- `u=2092238618` - Discord Handle entry field (Column B)
- `i=` - Empty (no UUID field yet)

---

## Proposed Solution

### Architecture (UUID-Based Hybrid Lookup)

```
User signs up via Voxel form
   ↓
Discord OAuth → Voxel captures username AND user ID
   ↓
Google Form:
   - Column B: Discord Handle (entry.2092238618 via u=)
   - Column F: Discord UUID (entry.XXXXXXXXX via i=)  ← NEW
   ↓
[DFC] Official Rankings → "DFC Signups" tab
   ↓
ARRAYFORMULA → "DFC Recent Signups" (flattened, last 10 days)
   ↓
IMPORTRANGE → [DFC] Data Input "Recent Signups" (Columns A-F)  ← Column F now has UUID
   ↓
Column G "Roster Presence" formula (or updated Column F):
   =MAP(B2:B, F2:F, LAMBDA(handle, uuid,
     IF(handle="","",
       IFERROR(
         INDEX(FILTER(Roster!B:B, Roster!D:D=TEXT(uuid,"0")), 1),  ← Try UUID first
         IFERROR(
           INDEX(FILTER(Roster!B:B, LOWER(Roster!C:C)=LOWER(handle)), 1),  ← Fallback
           "Not Found"
         )
       )
     )
   ))
   ↓
Duel Data Forms.gs reads Roster Presence
   ↓
Updates match reporting form dropdowns (no "Not Found" for UUID matches)
   ↓
User reports match via dropdown selection
```

### Hybrid UUID Lookup Formula

**Location**: `[DFC] Data Input` → "Recent Signups" → Column F or G (Roster Presence)

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

**How it works**:
1. Try UUID match first: `Roster!D:D = TEXT(uuid,"0")`
   - 100% accurate, works regardless of username changes
   - `TEXT(uuid,"0")` converts numeric UUID to text for comparison
2. Fallback to case-insensitive username match: `LOWER(Roster!C:C) = LOWER(handle)`
   - For old signups without UUID
   - Case-insensitive handles "bruno" vs "Bruno"
3. Return "Not Found" only if both fail

**Benefits**:
- New signups with UUID: 100% accurate
- Old signups without UUID: Better than current (case-insensitive)
- Backward compatible
- Self-healing (accuracy improves as users sign up again)

---

## Implementation Guide

### Phase 1: Surely Adds Discord ID Field to Form

**Action**: Surely adds new form field

**Steps**:
1. Open Google Form: https://docs.google.com/forms/d/1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/edit
2. Add new question:
   - **Type**: Short answer
   - **Title**: "Discord ID"
   - **Description**: "Auto-filled from Discord. Do not edit."
   - **Required**: No (optional)
   - **Position**: Place at end of form (less visible)

3. Get entry ID:
   - Click 3-dot menu → "Get pre-filled link"
   - Fill "Discord ID" field with test value (e.g., "123456789")
   - Click "Get link"
   - Copy URL, extract entry ID:
     ```
     https://docs.google.com/forms/d/e/.../viewform?entry.XXXXXXXXX=123456789
     ```
   - The `XXXXXXXXX` is the entry ID

4. Provide entry ID to Sound/developer for next phases

**Note**: Users will see this field pre-filled when they access the form via Voxel. Google Forms does not support hidden fields natively.

### Phase 2: Update Voxel URL

**Action**: Update posted Voxel URL with UUID entry ID

**Before**:
```
https://voxelfox.co.uk/gforms?f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/&u=2092238618&i=
```

**After**:
```
https://voxelfox.co.uk/gforms?f=1FAIpQLSeviV0Uz8ufF6P58TsPmI_F2gsnJDLyJTbiy_-FDZgcmb7TfQ/&u=2092238618&i=XXXXXXXXX
```

Replace `XXXXXXXXX` with entry ID from Phase 1.

**Who Updates**: Coooley (posts URL weekly) or Surely (provides updated URL to Coooley)

**Result**: New Voxel signups will populate:
- Column B: Discord Handle (username)
- Column F: Discord ID (UUID)

### Phase 3: Update Roster Presence Formula

**Action**: Sound updates formula in Google Sheets

**Location**: `[DFC] Data Input` → "Recent Signups" tab → Column F (or add Column G if F is IMPORTRANGE'd)

**Current formula** (Column F):
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

**Updated formula** (assumes UUID is in Column F from IMPORTRANGE):

**Option A: If Column F is populated by IMPORTRANGE (A2:F), update to Column G:**
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

**Option B: If Column F is the calculated "Roster Presence" column, update IMPORTRANGE to A2:F and modify formula:**
- Update IMPORTRANGE formula to include Column F: `'DFC Recent Signups'!A2:F`
- Move "Roster Presence" formula to Column G with updated formula above

**Important**: Update `Duel Data Forms.gs` header reference from `HANDLE_HEADER = 'Roster Presence'` to point to new column (G) if moved.

### Phase 4: Update `/signup` Bot Command

**Action**: Developer updates `commands/signup.js` to submit UUID

**File**: `commands/signup.js`
**Current Code** (approx. line 465):
```javascript
formData.append('entry.2092238618', user.username); // Discord Handle
```

**Updated Code**:
```javascript
formData.append('entry.2092238618', user.username); // Discord Handle
formData.append('entry.XXXXXXXXX', user.id);        // Discord UUID ← ADD THIS LINE
```

Replace `XXXXXXXXX` with the UUID entry ID from Phase 1.

**Coordination Required**:
1. Surely provides UUID entry ID to developer
2. Developer updates `signup.js`
3. Developer deploys updated command: `node deploy-commands.js`
4. Bot signups now submit both username and UUID

**Result**: Both Voxel form AND bot `/signup` command populate UUID field.

### Phase 5: Testing & Validation

**Test Voxel Signup**:
1. Post updated Voxel URL in test channel
2. Have test user sign up
3. Check "DFC Signups" tab → Column F should have numeric Discord ID
4. Check "Recent Signups" in [DFC] Data Input → "Roster Presence" should return Data Name (not "Not Found")
5. Run Duel Data Forms.gs script
6. Check match reporting form → "Winner"/"Loser" dropdowns should include user's Data Name

**Test Bot Signup**:
1. Run `/signup` command in Discord
2. Complete signup flow
3. Check "DFC Signups" tab → Column F should have numeric Discord ID
4. Verify same as Voxel test above

**Test Username Change Handling**:
1. Have test user change Discord username
2. User signs up again (simulating next week's signup)
3. Check "Roster Presence" → Should still return correct Data Name (UUID matched)
4. Verify no "Not Found" despite username change

**Rollback Plan**:
- If issues arise, revert Roster Presence formula to original
- Voxel URL can remain with `i=` parameter (ignored if column doesn't exist)
- Bot command can be reverted via `node deploy-commands.js`

---

## Code Changes Required

### Summary Table

| Component | File/Location | Change Type | Coordinator |
|-----------|---------------|-------------|-------------|
| Google Form | Form ID: 1FAIpQLSe... | Add field | Surely |
| Voxel URL | Posted in Discord | Update parameter | Coooley/Surely |
| Roster Presence Formula | [DFC] Data Input, Recent Signups, Column F/G | Replace formula | Sound |
| IMPORTRANGE (if needed) | [DFC] Data Input, Recent Signups | Update range A2:E → A2:F | Sound |
| Duel Data Forms.gs (if column moves) | Apps Script | Update HANDLE_HEADER | Sound |
| `/signup` command | commands/signup.js line ~465 | Add UUID submission | Developer |
| Deploy commands | deploy-commands.js | Run deployment | Developer |

### Detailed Code Diffs

#### Roster Presence Formula (Before/After)

**Before** (username-only, case-sensitive):
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

**After** (UUID + username hybrid, case-insensitive fallback):
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

#### signup.js (Before/After)

**Before**:
```javascript
// Around line 465 in commands/signup.js
// Build form submission
const formData = new URLSearchParams();

// Add Discord handle
formData.append('entry.2092238618', user.username);

// Add other fields (division, class, build)
formData.append('entry.1149713456', division);
formData.append('entry.245385898', className);
formData.append('entry.1188949585', buildDetails);

// Submit to Google Forms
const response = await fetch(formUrl, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
```

**After**:
```javascript
// Around line 465 in commands/signup.js
// Build form submission
const formData = new URLSearchParams();

// Add Discord handle
formData.append('entry.2092238618', user.username);

// Add Discord UUID ← NEW
formData.append('entry.XXXXXXXXX', user.id);  // Replace XXXXXXXXX with actual entry ID

// Add other fields (division, class, build)
formData.append('entry.1149713456', division);
formData.append('entry.245385898', className);
formData.append('entry.1188949585', buildDetails);

// Submit to Google Forms
const response = await fetch(formUrl, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
```

**Deployment**:
```bash
# After updating signup.js
node deploy-commands.js

# Verify deployment
# Check Discord server, run /signup, verify Column F populated
```

#### Duel Data Forms.gs (Potential Update)

**If "Roster Presence" moves from Column F to Column G**:

**Before**:
```javascript
const HANDLE_HEADER = 'Roster Presence';
```

**After**:
```javascript
// No change needed - script searches by header name, not column letter
// As long as header is still "Roster Presence", script works
```

**Alternative** (if header name changes):
```javascript
const HANDLE_HEADER = 'Validated Roster Name';  // Update if header renamed
```

---

## Migration & Backward Compatibility

### Transition Period

**Week 1 (Implementation)**:
- Voxel URL updated with `i=` parameter
- New signups get UUID (Column F populated)
- Old signups have empty Column F
- Formula tries UUID match first, falls back to username
- Accuracy: ~70-80% (only new signups have UUID)

**Week 2-4**:
- More users sign up again with UUID
- UUID coverage increases (20% → 50% → 80%)
- Accuracy improves progressively

**Week 8+**:
- Most active users have UUID (~95%)
- Only inactive users lack UUID
- Accuracy: ~99%

**Eventual State**:
- All active users have UUID
- Accuracy: 100% for active roster
- Inactive users (no recent signups) may still lack UUID but don't impact active workflows

### Handling Old Signups

**Old signups without UUID**:
- Column F empty or null
- Formula skips UUID match (`IFERROR` catches empty UUID)
- Falls back to case-insensitive username match
- Better than current (case-insensitive) but not as good as UUID

**One-Time Cleanup** (optional but recommended):
- Run `roster-reconciliation.gs` script once
- Fixes existing ~47 mismatches in Roster Column C
- Ensures username fallback works better for old signups
- After cleanup, formula accuracy significantly improves even without full UUID coverage

---

## Expected Outcomes

### Immediate (Week 1)

- New signups capture UUID
- Roster Presence formula uses UUID for new signups
- Username change detection works for users who sign up again
- "Not Found" entries reduce for newly signing-up users

### Short-Term (Weeks 2-8)

- Progressive accuracy improvement as users sign up with UUID
- Reduced manual reconciliation workload
- Fewer duplicate user entries in analytics
- More accurate match reporting form dropdowns

### Long-Term (Week 8+)

- 100% accurate user matching for active roster
- No manual reconciliation needed
- Self-maintaining system
- Username changes have zero impact on data integrity

---

## Comparison to Alternatives

### Option 1: Roster Reconciliation Script (Current Approach)

**How it works**:
- Weekly Apps Script (`roster-reconciliation.gs`)
- Fuzzy matching on Discord handles (Levenshtein distance)
- Manual review of suggested matches
- Approval workflow to update Roster

**Pros**:
- Works without form changes
- No coordination with Surely needed
- Good for one-time cleanup

**Cons**:
- Requires weekly maintenance
- 70-85% accuracy (fuzzy matching limitations)
- Manual review time
- Recurring operational overhead
- Doesn't prevent future duplicates

**Verdict**: Good stopgap, not sustainable long-term

### Option 2: UUID Integration (Proposed Approach)

**How it works**:
- Voxel captures UUID via `i=` parameter
- Roster Presence formula uses UUID for matching
- Automatic, no manual intervention

**Pros**:
- One-time setup
- 100% accuracy for UUID matches
- No ongoing maintenance
- Self-healing over time
- Backward compatible

**Cons**:
- Requires coordination with Surely
- Requires bot code changes
- Transition period (not 100% on day one)
- Google Forms fields visible to users (limitation)

**Verdict**: Best long-term solution, eliminates root cause

### Option 3: Hybrid (Recommended)

**Combine both**:
1. Implement UUID integration (Phase 1-4)
2. Run reconciliation script once for historical cleanup
3. Monitor for edge cases during transition

**Result**:
- Immediate improvement from reconciliation script
- Long-term solution via UUID
- Clean migration path
- No gaps in coverage

---

## Troubleshooting

### Issue: UUID Column F Not Populating

**Symptoms**:
- Voxel signups have empty Column F
- Bot signups have empty Column F

**Checks**:
1. Verify Voxel URL has correct entry ID: `i=XXXXXXXXX` (not empty)
2. Check Google Form has "Discord ID" field
3. Verify entry ID matches between form and Voxel URL
4. Test pre-fill link directly: `...viewform?entry.XXXXXXXXX=test123`
5. Check bot code has correct entry ID in `formData.append()`

**Fix**:
- Get correct entry ID from Surely
- Update Voxel URL and bot code

### Issue: Roster Presence Returns "Not Found" Despite UUID

**Symptoms**:
- Column F has UUID
- Roster Column D has matching UUID
- Roster Presence still returns "Not Found"

**Checks**:
1. Verify Roster Column D has UUIDs (not empty)
2. Check formula uses `TEXT(uuid,"0")` conversion
3. Verify Roster!D:D range in formula
4. Test UUID match manually: `=MATCH(TEXT(F2,"0"), Roster!D:D, 0)`

**Fix**:
- Ensure Roster Column D populated with UUIDs from `/register` or manual entry
- Verify formula syntax (copy from this document)

### Issue: Bot /signup Command Doesn't Submit UUID

**Symptoms**:
- Voxel signups have UUID
- Bot signups missing UUID

**Checks**:
1. Verify `commands/signup.js` has UUID submission line
2. Check entry ID matches form field
3. Verify `user.id` is available in Discord interaction
4. Check logs for form submission errors

**Fix**:
- Update `signup.js` with correct entry ID
- Redeploy: `node deploy-commands.js`
- Clear Discord client cache if commands don't update

### Issue: "Roster Presence" Header Not Found Error

**Symptoms**:
- Duel Data Forms.gs throws error: `Header not found: Roster Presence`

**Checks**:
1. Verify column header is exactly "Roster Presence" (case-sensitive)
2. Check if formula moved from Column F to Column G
3. Verify Recent Signups tab exists in [DFC] Data Input

**Fix**:
- Ensure header name matches `HANDLE_HEADER` constant
- Update Duel Data Forms.gs if header changed
- Check IMPORTRANGE includes Roster Presence column

---

## Deployment Checklist

### Pre-Implementation

- [ ] Review this document with Sound
- [ ] Confirm Surely available to make form changes
- [ ] Identify test users for validation
- [ ] Back up current Roster Presence formula
- [ ] Document current "Not Found" count (baseline metric)

### Phase 1: Form Changes (Surely)

- [ ] Add "Discord ID" field to Google Form
- [ ] Get entry ID via pre-filled link method
- [ ] Test pre-fill: `...viewform?entry.XXXXXXXXX=123456789`
- [ ] Provide entry ID to Sound/developer

### Phase 2: Voxel URL Update

- [ ] Update Voxel URL: `i=XXXXXXXXX`
- [ ] Post updated URL in test channel
- [ ] Test signup → verify Column F populated

### Phase 3: Formula Update (Sound)

- [ ] Update IMPORTRANGE to A2:F (if needed)
- [ ] Update/add Roster Presence formula with UUID logic
- [ ] Test formula with existing UUID entries
- [ ] Update Duel Data Forms.gs header reference (if column moved)

### Phase 4: Bot Code Update (Developer)

- [ ] Update `commands/signup.js` with UUID entry ID
- [ ] Test locally (if possible)
- [ ] Deploy: `node deploy-commands.js`
- [ ] Test `/signup` in Discord → verify Column F populated

### Phase 5: Validation

- [ ] Test Voxel signup end-to-end
- [ ] Test bot signup end-to-end
- [ ] Verify Roster Presence returns Data Name (not "Not Found")
- [ ] Run Duel Data Forms.gs script
- [ ] Check match reporting form dropdowns
- [ ] Test username change scenario

### Post-Implementation

- [ ] Monitor "Not Found" count (should decrease)
- [ ] Run reconciliation script once for historical cleanup (optional)
- [ ] Document UUID coverage metric (% of roster with UUID)
- [ ] Update `.claude/CLAUDE.md` with new architecture notes
- [ ] Archive reconciliation script (no longer needed weekly)

---

## Timeline Estimate

| Phase | Duration | Blocker | Owner |
|-------|----------|---------|-------|
| Pre-review | 30 min | None | Sound/Developer |
| Phase 1: Form changes | 15 min | Surely availability | Surely |
| Phase 2: Voxel URL | 5 min | Entry ID from Phase 1 | Coooley/Surely |
| Phase 3: Formula update | 30 min | Entry ID from Phase 1 | Sound |
| Phase 4: Bot code | 30 min | Entry ID from Phase 1 | Developer |
| Phase 5: Testing | 30 min | All phases complete | Sound/Developer |
| **Total** | **~2.5 hours** | Coordination | Team |

**Critical Path**: Surely availability (Phase 1 blocks all other phases)

---

## Maintenance

### Ongoing (None Required)

Once implemented, the system is self-maintaining:
- No weekly reconciliation needed
- No manual reviews
- No script triggers to manage
- Formula updates automatically

### Monitoring (Optional)

**Recommended metrics** (monthly check):
- UUID coverage: `COUNT(F:F) / COUNT(B:B)` in Recent Signups
- "Not Found" rate: Count "Not Found" in Roster Presence column
- Duplicate user count: Declining trend expected

**Success Criteria**:
- UUID coverage >95% within 8 weeks
- "Not Found" rate <5%
- Zero duplicate user reports in analytics

---

## References

- **Voxel Source Code**: [frontend.py lines 68-104](https://github.com/Voxel-Fox-Ltd/Website/blob/master/website/frontend.py#L68-L104)
- **Google Sheets Structure**: `context/google-sheets-structure.md`
- **Roster Reconciliation Script**: `roster-reconciliation.gs`
- **Roster Reconciliation Deployment**: `ROSTER-RECONCILIATION-DEPLOYMENT.md`
- **Duel Data Forms Script**: `Duel Data Forms.gs`
- **Signup Command**: `commands/signup.js`

---

## Glossary

- **UUID**: Discord user ID, a permanent numeric identifier (e.g., `123456789012345678`)
- **Roster Presence**: Calculated column that validates signup Discord handle against Roster
- **Voxel**: Third-party Discord OAuth service for Google Forms integration
- **Entry ID**: Google Forms field identifier (e.g., `entry.2092238618`)
- **Data Name**: Roster Column B, display name used in rankings and match reporting
- **Arena Name**: Roster Column A, in-game Diablo 2 character name

---

**Document Version**: 1.0
**Last Reviewed**: November 2025
**Next Review**: After implementation (document lessons learned)
