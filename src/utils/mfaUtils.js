const crypto = require('crypto');
const speakeasy = require('speakeasy');
const logger = require('../config/logger');

/**
 * Generate a random secret for MFA
 * @returns {string} Base32 encoded secret
 */
const generateSecret = (email) => {
  return speakeasy.generateSecret({
    name: `YourApp (${email})`,
    issuer: 'YourApp',
    length: 32,
  });
};

/**
 * Base32 encoding function
 * @param {Buffer} buffer - Buffer to encode
 * @returns {string} Base32 encoded string
 */
// const base32Encode = (buffer) => {
//   const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
//   let bits = 0;
//   let value = 0;
//   let output = '';

//   for (let i = 0; i < buffer.length; i++) {
//     value = (value << 8) | buffer[i];
//     bits += 8;

//     while (bits >= 5) {
//       output += alphabet[(value >>> (bits - 5)) & 31];
//       bits -= 5;
//     }
//   }

//   if (bits > 0) {
//     output += alphabet[(value << (5 - bits)) & 31];
//   }

//   return output;
// };

/**
 * Base32 decoding function
 * @param {string} encoded - Base32 encoded string
 * @returns {Buffer} Decoded buffer
 */
const base32Decode = (encoded) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = Buffer.alloc(Math.ceil((encoded.length * 5) / 8));
  let outputIndex = 0;

  for (let i = 0; i < encoded.length; i++) {
    const index = alphabet.indexOf(encoded[i].toUpperCase());
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output[outputIndex++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.slice(0, outputIndex);
};

/**
 * Generate HOTP value
 * @param {string} secret - Base32 encoded secret
 * @param {number} counter - Counter value
 * @param {number} digits - Number of digits (default 6)
 * @returns {string} HOTP value
 */
const generateHOTP = (secret, counter, digits = 6) => {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);

  // Write counter as big-endian 64-bit integer
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
};

/**
 * Generate TOTP value
 * @param {string} secret - Base32 encoded secret
 * @param {number} timeStep - Time step in seconds (default 30)
 * @param {number} digits - Number of digits (default 6)
 * @param {number} timestamp - Current timestamp (default now)
 * @returns {string} TOTP value
 */
const generateTOTP = (secret, timeStep = 30, digits = 6, timestamp = Date.now()) => {
  const counter = Math.floor(timestamp / 1000 / timeStep);
  return generateHOTP(secret, counter, digits);
};

/**
 * Verify TOTP token
 * @param {string} token - Token to verify
 * @param {string} secret - Base32 encoded secret
 * @param {number} window - Time window for validation (default 1)
 * @param {number} timeStep - Time step in seconds (default 30)
 * @param {number} digits - Number of digits (default 6)
 * @returns {boolean} True if token is valid
 */
const verifyTOTP = (token, secret, window = 3, timeStep = 30, digits = 6) => {
  const currentTime = Date.now();
  const currentTimeSeconds = Math.floor(currentTime / 1000);

  logger.info('TOTP Verification Debug:', {
    inputToken: token,
    secret: secret.substring(0, 8) + '...',
    currentTime: new Date(currentTime).toISOString(),
    currentTimeSeconds,
    window,
    timeStep,
  });

  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i * timeStep * 1000;
    const expectedToken = generateTOTP(secret, timeStep, digits, testTime);

    logger.info(`Testing window ${i}: expected=${expectedToken}, input=${token}, time=${new Date(testTime).toISOString()}`);

    if (token === expectedToken) {
      logger.info(`TOTP Match found at window ${i}`);
      return true;
    }
  }

  logger.info('No TOTP match found in any window');
  return false;
};

/**
 * Generate QR code URL for MFA setup
 * @param {string} secret - Base32 encoded secret
 * @param {string} label - Account label (usually email)
 * @param {string} issuer - Service name
 * @returns {string} QR code URL
 */
const generateQRCodeURL = (secret, label, issuer = 'Your App') => {
  const encodedLabel = encodeURIComponent(label);
  const encodedIssuer = encodeURIComponent(issuer);

  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
};

/**
 * Generate backup codes
 * @param {number} count - Number of codes to generate (default 10)
 * @returns {string[]} Array of backup codes
 */
const generateBackupCodes = (count = 10) => {
  const codes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
};

/**
 * Hash backup code for storage
 * @param {string} code - Backup code to hash
 * @returns {string} Hashed code
 */
const hashBackupCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify backup code
 * @param {string} code - Code to verify
 * @param {string} hashedCode - Stored hashed code
 * @returns {boolean} True if code matches
 */
const verifyBackupCode = (code, hashedCode) => {
  const inputHash = hashBackupCode(code);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hashedCode));
};

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateQRCodeURL,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
};
