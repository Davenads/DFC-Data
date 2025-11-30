# Tournament Signup Notification System - Implementation Plan

## Overview

Add automated Discord notifications for DFC tournament signup windows using node-cron scheduled jobs.

## Notifications

### 1. "Signups Now Open"
- **Schedule**: Friday 12:00 AM ET (`'0 0 * * 5'`)
- **Color**: Green (0x00FF00)
- **Mentions**: @DFC Dueler role
- **Content**: Announces signup window is open with full schedule details

### 2. "Signup Closing Soon"
- **Schedule**: Tuesday 5:00 PM ET (`'0 17 * * 2'`)
- **Color**: Orange (0xFF6600)
- **Mentions**: @DFC Dueler role
- **Content**: Warning that signups close in 6 hours with urgent call-to-action

## Architecture

### New File: `utils/signupNotifications.js`
Self-contained module with:
- Environment-specific channel/role ID selection (TEST_MODE aware)
- Embed builder functions for both notification types
- Notification sending with error handling
- Cron job registration function
- Test function for manual triggering (kept in production for troubleshooting)

### Modified File: `index.js`
Add after line 177 (after cache refresh scheduling):
```javascript
const { scheduleSignupNotifications } = require('./utils/signupNotifications');
scheduleSignupNotifications(client);
console.log('Signup notifications scheduled: Friday 12:00am ET (open) and Tuesday 5:00pm ET (closing)');
```

### Environment Variables (.env)
Add 4 new variables:
```env
# Test Environment
SIGNUP_NOTIFICATION_CHANNEL_TEST=1442946150523998209
DFC_DUELER_ROLE_ID_TEST=<test_role_id>

# Production Environment
SIGNUP_NOTIFICATION_CHANNEL_PROD=928826232827699300
DFC_DUELER_ROLE_ID_PROD=<prod_role_id>
```

## Technical Patterns

### Multi-Environment Selection
```javascript
const isTestMode = process.env.TEST_MODE === 'true'; // String comparison!
const channelId = isTestMode
  ? process.env.SIGNUP_NOTIFICATION_CHANNEL_TEST
  : process.env.SIGNUP_NOTIFICATION_CHANNEL_PROD;
```

### Channel Messaging
- Use `client.channels.cache.get(channelId)` for O(1) lookup
- Send with: `channel.send({ content: '<@&roleId>', embeds: [embed] })`
- Non-blocking sends with `.catch()` error handling
- Graceful degradation to console logging on failure

### Cron Configuration
- Use `America/New_York` timezone (handles DST automatically)
- Match existing cache refresh pattern from index.js:122-178
- Log execution to console for monitoring

### Role Mentions
- Use `<@&ROLE_ID>` format in `content` field (not in embed)
- **Both notifications will ping @DFC Dueler role** for maximum visibility
- Plain text won't trigger role pings
- Requires role IDs from Discord Developer Mode (Server Settings → Roles → Right-click → Copy ID)

## Error Handling

**Non-blocking approach** (matches existing auditLogger.js pattern):
- Missing channel → Log warning, continue bot operation
- Permission errors → Log error with code, continue
- Missing env vars → Log validation error, skip notification
- All errors logged with timestamp and context

**No await on channel.send** - use `.catch()` for fire-and-forget reliability.

## Testing Strategy

### Local Testing
1. Start bot in TEST_MODE: `TEST_MODE=true node index.js`
2. Use exported `testNotifications()` function to trigger immediately
3. Verify notification appears in test channel (1442946150523998209)
4. Check embed formatting, colors, and role mention
5. Test both 'open' and 'closing' notification types

### Production Testing
1. Set Heroku config vars (4 new environment variables)
2. Deploy via GitHub auto-deploy: `git push origin main`
3. Monitor Heroku logs: `heroku logs --tail`
4. Wait for first scheduled execution or manually test
5. Verify notifications in production channel (928826232827699300)

## Implementation Steps

1. **Obtain Role IDs** (Prerequisites)
   - Enable Discord Developer Mode
   - Right-click @DFC Dueler role in Server Settings → Roles
   - Copy ID for both test and production servers

2. **Create Module** (15 min)
   - Create `utils/signupNotifications.js` with full implementation
   - Include embed builders, notification sender, scheduler, and test function

3. **Modify index.js** (3 min)
   - Add require and schedule call after existing cron jobs (line ~177)

4. **Update .env** (2 min)
   - Add 4 environment variables locally

5. **Local Testing** (10 min)
   - Test with manual trigger function
   - Verify console logs and channel output

6. **Deploy** (5 min)
   - Set Heroku config vars
   - Git commit and push to main

7. **Monitor** (Ongoing)
   - Watch first Friday 12:00 AM notification
   - Watch first Tuesday 5:00 PM notification

## Key Design Decisions

**Embed Colors**: Orange (warning) for closing, green (success) for opening - matches user preference

**Timing**: Exact midnight for opening (as requested), 5pm for 6-hour warning (as requested)

**Role Mentions**: Use Discord role ID format to ensure pings work properly

**Module Location**: `utils/` follows existing pattern for utility functions (cache modules, auditLogger)

**Error Philosophy**: Non-blocking with console fallback - keep bot operational even if notifications fail

**Test Function**: Kept in production for manual troubleshooting and testing capabilities

## Critical Files

- **utils/signupNotifications.js** [NEW] - Core notification logic
- **index.js** [MODIFY] - Line 177: Add scheduling registration
- **.env** [MODIFY] - Add 4 environment variables
- **commands/signup.js** [REFERENCE] - Signup window timing source
- **utils/auditLogger.js** [REFERENCE] - Channel messaging pattern

## Future Enhancements

- Add signup count stats to embeds (from signupsCache)
- Add mid-window reminder (e.g., Monday 9am)
- Track notification delivery success rate
- Add admin command to manually trigger notifications
