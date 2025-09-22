const crypto = require('crypto');

/**
 * Calculate password entropy
 * @param {string} password - The password to analyze
 * @returns {number} Entropy score
 */
const calculateEntropy = (password) => {
  const charSetSizes = {
    lowercase: 26,
    uppercase: 26,
    numbers: 10,
    symbols: 32,
  };

  let charSetSize = 0;
  
  if (/[a-z]/.test(password)) charSetSize += charSetSizes.lowercase;
  if (/[A-Z]/.test(password)) charSetSize += charSetSizes.uppercase;
  if (/\d/.test(password)) charSetSize += charSetSizes.numbers;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charSetSize += charSetSizes.symbols;

  return Math.log2(Math.pow(charSetSize, password.length));
};

/**
 * Extended common passwords list
 */
const commonPasswords = [
  // Basic patterns
  'password', 'password123', 'password1', 'password12', 'password1234',
  'admin', 'admin123', 'admin1', 'administrator', 'root', 'root123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'letmein', 'letmein123', 'welcome', 'welcome123', 'login', 'login123',
  
  // Sequential patterns
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'abcdef', 'abcdefg', 'abcdefgh', 'abcdefghi', 'abcdefghij',
  
  // Common words
  'iloveyou', 'iloveyou123', 'monkey', 'monkey123', 'dragon', 'dragon123',
  'master', 'master123', 'shadow', 'shadow123', 'superman', 'superman123',
  'football', 'football123', 'baseball', 'baseball123', 'basketball', 'basketball123',
  
  // Keyboard patterns
  'qwer1234', 'asdf1234', 'zxcv1234', '1qaz2wsx', '1q2w3e4r',
  'qazwsx', 'qazwsxedc', 'wsxedc', 'edcrfv', 'rfvtgb',
  
  // Company/service related
  'google123', 'facebook123', 'twitter123', 'linkedin123', 'github123',
  'company123', 'office123', 'work123', 'business123',
  
  // Dates and years
  '2023', '2024', '2025', '01012023', '12312023', 'january2023',
  'password2023', 'admin2023', 'user2023',
  
  // Simple substitutions
  'p@ssw0rd', 'p@ssword', 'passw0rd', 'pa$$word', 'pa$$w0rd',
  '@dmin123', 'adm1n123', 'qu3rty', 'l3tm31n',
];

/**
 * Check if password is in common passwords list
 * @param {string} password - The password to check
 * @returns {boolean} True if password is common
 */
const isCommonPassword = (password) => {
  const lowerPassword = password.toLowerCase();
  return commonPasswords.some(common => {
    // Exact match
    if (lowerPassword === common.toLowerCase()) return true;
    
    // Check if password contains common pattern
    if (lowerPassword.includes(common.toLowerCase()) && common.length > 4) return true;
    
    return false;
  });
};

/**
 * Check for keyboard patterns
 * @param {string} password - The password to check
 * @returns {boolean} True if contains keyboard patterns
 */
const hasKeyboardPattern = (password) => {
  const keyboardRows = [
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
  ];
  
  const lowerPassword = password.toLowerCase();
  
  return keyboardRows.some(row => {
    // Check for sequences of 4+ characters
    for (let i = 0; i <= row.length - 4; i++) {
      const sequence = row.substring(i, i + 4);
      const reverseSequence = sequence.split('').reverse().join('');
      
      if (lowerPassword.includes(sequence) || lowerPassword.includes(reverseSequence)) {
        return true;
      }
    }
    return false;
  });
};

/**
 * Check for repetitive patterns
 * @param {string} password - The password to check
 * @returns {boolean} True if contains repetitive patterns
 */
const hasRepetitivePattern = (password) => {
  // Check for repeated characters (3+ times)
  if (/(.)\1{2,}/.test(password)) return true;
  
  // Check for repeated patterns
  for (let i = 1; i <= password.length / 2; i++) {
    const pattern = password.substring(0, i);
    const repeated = pattern.repeat(Math.floor(password.length / i));
    
    if (password.startsWith(repeated) && repeated.length >= 4) {
      return true;
    }
  }
  
  return false;
};

/**
 * Comprehensive password strength validation
 * @param {string} password - The password to validate
 * @returns {Object} Validation result with score and feedback
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: true,
    score: 0,
    feedback: [],
    entropy: 0,
  };

  // Calculate entropy
  result.entropy = calculateEntropy(password);
  
  // Length check (minimum 12 characters)
  if (password.length < 12) {
    result.isValid = false;
    result.feedback.push('Password must be at least 12 characters long');
  } else if (password.length >= 16) {
    result.score += 2;
  } else {
    result.score += 1;
  }

  // Character variety checks
  if (!/[a-z]/.test(password)) {
    result.isValid = false;
    result.feedback.push('Password must contain at least one lowercase letter');
  } else {
    result.score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    result.isValid = false;
    result.feedback.push('Password must contain at least one uppercase letter');
  } else {
    result.score += 1;
  }

  if (!/\d/.test(password)) {
    result.isValid = false;
    result.feedback.push('Password must contain at least one number');
  } else {
    result.score += 1;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.isValid = false;
    result.feedback.push('Password must contain at least one special character');
  } else {
    result.score += 1;
  }

  // Entropy check (minimum 50 bits)
  if (result.entropy < 50) {
    result.isValid = false;
    result.feedback.push('Password is not complex enough. Try using a longer password with more variety');
  } else if (result.entropy >= 70) {
    result.score += 2;
  } else {
    result.score += 1;
  }

  // Common password check
  if (isCommonPassword(password)) {
    result.isValid = false;
    result.feedback.push('Password is too common. Please choose a more unique password');
  } else {
    result.score += 1;
  }

  // Keyboard pattern check
  if (hasKeyboardPattern(password)) {
    result.isValid = false;
    result.feedback.push('Password contains keyboard patterns. Please avoid sequential characters');
  } else {
    result.score += 1;
  }

  // Repetitive pattern check
  if (hasRepetitivePattern(password)) {
    result.isValid = false;
    result.feedback.push('Password contains repetitive patterns. Please use more variety');
  } else {
    result.score += 1;
  }

  // Calculate final score (0-10)
  result.score = Math.min(10, result.score);

  return result;
};

/**
 * Generate secure random password
 * @param {number} length - Password length (default 16)
 * @returns {string} Generated password
 */
const generateSecurePassword = (length = 16) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*(),.?":{}|<>';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one character from each set
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(0, 3) - 1).join('');
};

module.exports = {
  calculateEntropy,
  isCommonPassword,
  hasKeyboardPattern,
  hasRepetitivePattern,
  validatePasswordStrength,
  generateSecurePassword,
};
