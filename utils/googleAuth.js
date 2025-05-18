const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

/**
 * Properly formats the Google private key from environment variables
 * Environment variables may store newlines as \\n, which need to be converted
 * to actual newlines for the key to work
 * @returns {string} Properly formatted private key
 */
function getPrivateKey() {
  try {
    // First try to use base64 encoded key (most reliable method across platforms)
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
      try {
        console.log('Using base64 encoded private key');
        const decodedKey = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
        // If it's a JSON service account key file, extract the private_key property
        if (decodedKey.includes('"private_key":')) {
          try {
            const keyObj = JSON.parse(decodedKey);
            if (keyObj.private_key) {
              console.log('Extracted private_key from decoded JSON');
              return keyObj.private_key;
            }
          } catch (e) {
            console.log('Decoded content is not valid JSON, using as-is');
          }
        }
        return decodedKey;
      } catch (e) {
        console.error('Error decoding base64 key:', e.message);
      }
    }
    
    // Fall back to regular key if base64 is not provided or fails
    let key = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!key) {
      throw new Error('No Google private key found. Set either GOOGLE_PRIVATE_KEY or GOOGLE_PRIVATE_KEY_BASE64');
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
    
    // Remove any surrounding quotes
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.substring(1, key.length - 1);
      console.log('Removed surrounding quotes from key');
    }
    
    // Always replace escaped newlines with actual newlines
    if (key.includes('\\n')) {
      key = key.replace(/\\n/g, '\n');
      console.log('Replaced escaped newlines in key');
    }
    
    // Check if the key is properly formatted
    if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) {
      console.log('Key does not start with proper header');
    }
    
    if (!key.endsWith('-----END PRIVATE KEY-----')) {
      console.log('Key does not end with proper footer');
    }
    
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
  try {
    // Try the direct JWT approach first - more reliable on Heroku
    console.log('Creating JWT client directly');
    
    // Get the email and key
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = getPrivateKey();
    
    if (!clientEmail) {
      throw new Error('GOOGLE_CLIENT_EMAIL environment variable is not set');
    }
    
    // Create JWT client
    const jwt = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: scopes
    });
    
    return jwt;
  } catch (error) {
    console.error('Error creating JWT client:', error);
    
    // Fall back to GoogleAuth if JWT fails
    console.log('Falling back to GoogleAuth');
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: getPrivateKey(),
      },
      scopes,
    });
  }
}

module.exports = {
  getPrivateKey,
  createGoogleAuth
};