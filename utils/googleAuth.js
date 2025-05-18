const { google } = require('googleapis');

/**
 * Properly formats the Google private key from environment variables
 * Environment variables may store newlines as \\n, which need to be converted
 * to actual newlines for the key to work
 * @returns {string} Properly formatted private key
 */
function getPrivateKey() {
  try {
    const key = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!key) {
      throw new Error('GOOGLE_PRIVATE_KEY environment variable is not set');
    }
    
    // Log key format information for debugging (without exposing actual key content)
    console.log('PRIVATE KEY FORMAT DEBUG INFO:');
    console.log(`- Key length: ${key.length}`);
    console.log(`- Contains "BEGIN PRIVATE KEY": ${key.includes('-----BEGIN PRIVATE KEY-----')}`);
    console.log(`- Contains "END PRIVATE KEY": ${key.includes('-----END PRIVATE KEY-----')}`);
    console.log(`- Contains escaped newlines (\\\\n): ${key.includes('\\n')}`);
    console.log(`- Starts with quote: ${key.startsWith('"')}`);
    console.log(`- Ends with quote: ${key.endsWith('"')}`);
    console.log(`- First 10 chars (sanitized): ${key.substring(0, 10).replace(/[A-Za-z0-9+/=]/g, '*')}`);
    console.log(`- Last 10 chars (sanitized): ${key.substring(key.length - 10).replace(/[A-Za-z0-9+/=]/g, '*')}`);
    
    // Check if the key is already properly formatted with PEM headers
    if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
      console.log('Using key with existing PEM headers');
      return key;
    }
    
    // Handle escaped newlines
    if (key.includes('\\n')) {
      console.log('Replacing escaped newlines in key');
      return key.replace(/\\n/g, '\n');
    }
    
    // Try to handle if key is JSON stringified
    if (key.startsWith('"') && key.endsWith('"')) {
      try {
        console.log('Attempting to parse key as JSON string');
        // Parse the JSON string and check if the result has newlines to replace
        const parsedKey = JSON.parse(key);
        if (typeof parsedKey === 'string' && parsedKey.includes('\\n')) {
          console.log('Replacing escaped newlines in JSON parsed key');
          return parsedKey.replace(/\\n/g, '\n');
        }
        console.log('Using JSON parsed key');
        return parsedKey;
      } catch (e) {
        console.log('Failed to parse key as JSON string, proceeding with original key');
      }
    }
    
    // If key seems to be base64 encoded, try to decode it
    if (!key.includes('-----BEGIN') && /^[A-Za-z0-9+/=]+$/.test(key)) {
      try {
        console.log('Attempting to decode key as base64');
        const decodedKey = Buffer.from(key, 'base64').toString('ascii');
        // Check if decoded result looks like a private key
        if (decodedKey.includes('-----BEGIN PRIVATE KEY-----')) {
          console.log('Using base64 decoded key');
          return decodedKey;
        }
      } catch (e) {
        console.log('Failed to decode key as base64, proceeding with original key');
      }
    }
    
    // If we can't determine format but key has no PEM headers, assume it's the raw key content
    // and add PEM headers manually
    if (!key.includes('-----BEGIN')) {
      console.log('Adding PEM headers to key');
      return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
    }
    
    // If all else fails, return the key as is
    console.log('Using key as-is - no format transformations applied');
    return key;
  } catch (error) {
    console.error('Error formatting private key:', error.message);
    throw new Error('Failed to process Google private key. Check your environment variables.');
  }
}

/**
 * Creates a Google Auth instance with the proper credentials
 * @param {string[]} scopes - Google API scopes to authorize
 * @returns {google.auth.GoogleAuth} Google Auth instance
 */
function createGoogleAuth(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: getPrivateKey(),
    },
    scopes,
  });
}

module.exports = {
  getPrivateKey,
  createGoogleAuth
};