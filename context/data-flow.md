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

The bot implements caching to reduce API calls to Google Sheets:

```js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute TTL
```

### Caching Operations

1. **Storing data in cache**
   ```js
   cache.set('key', data);
   ```

2. **Retrieving data from cache**
   ```js
   const cachedData = cache.get('key');
   if (cachedData) {
       // Use cached data
   } else {
       // Fetch from Google Sheets and update cache
   }
   ```

3. **Cache invalidation**
   ```js
   cache.del('key');
   ```

4. **Force cache refresh** (via environment variable)
   ```js
   if (process.env.FORCE_CACHE_REFRESH === 'true') {
       cache.del('key');
   }
   ```