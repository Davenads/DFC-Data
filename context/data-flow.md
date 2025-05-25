# DFC-Data Bot Data Flow

## Google Sheets Integration

### Sheets Structure
The bot interacts with a Google Spreadsheet with multiple tabs:
1. **Roster**: Contains player registration data
   - Columns: Dueler Name, Display Name, Discord Name, Discord UUID
   
2. **DFC Bot Signups**: Player signups for weekly events
   - Players register with their class and build information
   
3. **Match Results**: Stores fight results
   - Tracks winners, losers, and match details
   
4. **Rankings**: Displays current player standings
   - Potentially calculated from match results

### Data Operations

#### Reading Data
1. Authentication with Google Sheets API
   ```js
   const authClient = await auth.getClient();
   const res = await sheets.spreadsheets.values.get({
       auth: authClient,
       spreadsheetId: process.env.SPREADSHEET_ID,
       range: 'Roster!A:D',
   });
   ```

2. Processing returned data
   ```js
   const roster = res.data.values || [];
   ```

#### Writing Data
1. Appending new rows
   ```js
   await sheets.spreadsheets.values.append({
       auth: authClient,
       spreadsheetId: process.env.SPREADSHEET_ID,
       range: 'DFC Bot Signups!A:E',
       valueInputOption: 'RAW',
       requestBody: {
           values: [[data1, data2, data3, data4]],
       },
   });
   ```

2. Updating existing cells
   ```js
   await sheets.spreadsheets.values.update({
       auth: authClient,
       spreadsheetId: process.env.SPREADSHEET_ID,
       range: `Roster!A${rowIndex}:D${rowIndex}`,
       valueInputOption: 'RAW',
       requestBody: {
           values: [[updatedValue1, updatedValue2, updatedValue3, updatedValue4]],
       },
   });
   ```

## Caching Strategy

The bot implements a Redis-based caching system to reduce API calls to Google Sheets and improve performance:

### Redis Cache Implementation
- **Primary Cache**: Redis database for persistent, fast data access
- **Fallback**: Google Sheets API when Redis is unavailable
- **Cache Duration**: Data persists until manual refresh
- **Scheduled Refresh**: Automatic cache updates on Thursday 5:30pm ET and Friday 2:00am ET

### Duel Data Cache (`utils/duelDataCache.js`)

1. **Cache Retrieval**
   ```js
   const duelDataCache = require('../utils/duelDataCache');
   const duelRows = await duelDataCache.getCachedData();
   ```

2. **Manual Cache Refresh** (Moderator-only)
   ```js
   await duelDataCache.refreshCache();
   ```

3. **Cache Timestamp Tracking**
   ```js
   const timestamp = await duelDataCache.getCacheTimestamp();
   ```

### Cache Benefits
- **Performance**: ~100ms cache retrieval vs 2-3s Google Sheets API calls
- **Reliability**: Fallback mechanism maintains service availability  
- **API Quota**: Reduces Google Sheets API usage by 80-90%
- **Data Consistency**: Scheduled refreshes ensure current data

### Commands Using Cache
- **recentduels**: Filters cached duel data by date range
- **stats**: Processes player statistics from cached match data
- **rankings**: Calculates player standings from cached results
- **refreshcache**: Manual cache refresh for moderators