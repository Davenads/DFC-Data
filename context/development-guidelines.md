# Development Guidelines for DFC-Data Bot

## Code Structure

### Command Files
Each command should be a separate file in the `commands` directory with this structure:
```js
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('command-name')
        .setDescription('Command description')
        // Add command options here
    
    // Optional: Add role requirement
    role: 'Manager', // Role name required to use this command
    
    async execute(interaction, sheets, auth) {
        // Command implementation
    },
    
    // Optional: Add autocomplete handler
    async autocomplete(interaction) {
        // Autocomplete implementation
    }
};
```

### Code Style
- Use async/await for asynchronous operations
- Include proper error handling with try/catch blocks
- Add comments for complex logic
- Log errors with detailed context

## Error Handling

### Command Execution
```js
try {
    // Command logic
} catch (error) {
    console.error('Error description:', error);
    await interaction.reply({
        content: 'User-friendly error message',
        ephemeral: true
    });
}
```

### Google Sheets Interactions
```js
try {
    // Google Sheets API call
} catch (error) {
    console.error('Google Sheets API error:', error);
    // Handle the error appropriately
}
```

## Caching Strategy

- Use node-cache for reducing API calls
- Set appropriate TTL (Time-To-Live) values
- Implement cache invalidation when data is updated
- Add cache keys that represent the data they store

```js
// Example cache implementation
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// Storing data
cache.set('key', data);

// Retrieving data
const cachedData = cache.get('key');
if (!cachedData) {
    // Fetch from API and store in cache
}

// Invalidating cache
cache.del('key');
```

## Performance Considerations

1. **Batch API Requests**: Minimize the number of API calls
2. **Implement Caching**: Avoid unnecessary API calls for frequently accessed data
3. **Optimize Range Requests**: Only request the specific data needed
4. **Use Efficient Queries**: When searching data, use optimal search strategies

## User Experience

1. **Response Time**: Aim for quick command responses (<3 seconds)
2. **Informative Errors**: Provide clear error messages
3. **Visual Design**: Use Discord embeds for better presentation
4. **Ephemeral Responses**: Use ephemeral responses for private information
5. **Progressive Feedback**: For long operations, acknowledge receipt before processing

## Testing

1. **Command Testing**: Test all commands manually in a test server
2. **Edge Cases**: Test with unusual inputs and boundary conditions
3. **Error Conditions**: Verify all error handlers work correctly
4. **Permission Scenarios**: Test with different user roles

## Adding New Features

1. Create a new command file in the `commands` directory
2. Implement the command using the standard structure
3. Update deploy-commands.js to register the new command
4. Test thoroughly before deployment
5. Consider data storage needs for new features