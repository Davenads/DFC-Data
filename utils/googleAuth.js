const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

/**
 * Creates a Google Auth instance with the proper credentials
 * @param {string[]} scopes - Google API scopes to authorize
 * @returns {JWT} Google Auth JWT client
 */
function createGoogleAuth(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  // Use direct JWT initialization with email and key
  console.log('Initializing Google Auth with direct JWT approach');
  
  // Use raw email and key from environment
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  
  if (!clientEmail) {
    throw new Error('GOOGLE_CLIENT_EMAIL environment variable is not set');
  }
  
  // Log simplified diagnostic info
  console.log(`Client email present: ${!!clientEmail}`);
  console.log(`Private key present: ${!!privateKey}`);
  console.log(`Private key length: ${privateKey ? privateKey.length : 0}`);
  
  try {
    // WARNING: Heroku Node.js 18+ handling for PKCS#8 keys
    // Force Heroku to use legacy OpenSSL provider which accepts older key formats
    // See: https://github.com/nodejs/node/issues/43132
    const crypto = require('crypto');
    const setFipsOptions = process.env.NODE_OPTIONS?.includes('--openssl-legacy-provider') !== true;
    
    if (setFipsOptions) {
      // Only set if not already set
      console.log('Setting OpenSSL legacy provider option');
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --openssl-legacy-provider';
    }
  } catch (error) {
    console.error('Unable to set OpenSSL options:', error.message);
  }
  
  // Create the JWT client with simplified parameters
  return new JWT(
    clientEmail,
    null, // No keyfile
    privateKey.replace(/\\n/g, '\n'), // Simple newline replacement
    scopes
  );
}

module.exports = {
  createGoogleAuth
};