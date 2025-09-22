const httpStatus = require('http-status');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { generateSecret, generateBackupCodes, hashBackupCode, verifyTOTP, verifyBackupCode } = require('../utils/mfaUtils');
const { validatePasswordStrength } = require('../utils/passwordSecurity');
const qrcode = require('qrcode');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create(userBody);
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isLocked()) {
    throw new ApiError(httpStatus.LOCKED, 'Account is locked due to too many failed login attempts');
  }

  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const restrictedFields = ['passwordHistory', 'mfaSecret', 'mfaBackupCodes', 'loginAttempts', 'lockUntil'];
  restrictedFields.forEach((field) => {
    if (updateBody[field]) {
      delete updateBody[field];
    }
  });

  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};

/**
 * Setup MFA for user
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
const setupMFA = async (userId) => {
  const user = await getUserById(userId);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  if (user.mfaEnabled) throw new ApiError(httpStatus.BAD_REQUEST, 'MFA already enabled');

  const secretObj = generateSecret(user.email);
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map((code) => hashBackupCode(code));
  user.mfaSecret = secretObj.base32;
  user.mfaBackupCodes = hashedBackupCodes;
  await user.save();

  const qrCodeUrl = await qrcode.toDataURL(secretObj.otpauth_url);

  return {
    secret: secretObj.base32,
    otpauthUrl: secretObj.otpauth_url,
    qrCodeUrl,
    backupCodes,
  };
};

/**
 * Enable MFA for user
 * @param {ObjectId} userId
 * @param {string} token
 * @returns {Promise<User>}
 */
const enableMFA = async (userId, token) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.mfaSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA setup required first');
  }

  if (user.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is already enabled');
  }

  // Verify the token
  const isValid = verifyTOTP(token, user.mfaSecret);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid MFA token');
  }

  user.mfaEnabled = true;
  await user.save();

  return user;
};

/**
 * Disable MFA for user
 * @param {ObjectId} userId
 * @param {string} token
 * @returns {Promise<User>}
 */
const disableMFA = async (userId, token) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is not enabled');
  }

  // Verify the token
  const isValid = verifyTOTP(token, user.mfaSecret);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid MFA token');
  }

  user.mfaEnabled = false;
  user.mfaSecret = null;
  user.mfaBackupCodes = [];
  await user.save();

  return user;
};

/**
 * Verify MFA token
 * @param {ObjectId} userId
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const verifyMFAToken = async (userId, token) => {
  const user = await getUserById(userId);

  logger.info('MFA Verification Debug:', {
    userId,
    userExists: !!user,
    mfaEnabled: user?.mfaEnabled,
    hasSecret: !!user?.mfaSecret,
    token,
    secretLength: user?.mfaSecret?.length,
  });

  if (!user) {
    logger.warn('MFA Verification failed: User not found');
    return false;
  }

  if (!user.mfaSecret) {
    logger.warn('MFA Verification failed: No MFA secret');
    return false;
  }

  const result = verifyTOTP(token, user.mfaSecret, 2);
  logger.info('TOTP Verification result:', result);

  return result;
};

/**
 * Use backup code
 * @param {ObjectId} userId
 * @param {string} backupCode
 * @returns {Promise<boolean>}
 */
const useBackupCode = async (userId, backupCode) => {
  const user = await getUserById(userId);
  if (!user || !user.mfaEnabled || !user.mfaBackupCodes) {
    return false;
  }

  const codeIndex = user.mfaBackupCodes.findIndex((hashedCode) => verifyBackupCode(backupCode, hashedCode));

  if (codeIndex === -1) {
    return false;
  }

  user.mfaBackupCodes.splice(codeIndex, 1);
  await user.save();

  return true;
};

/**
 * Change user password
 * @param {ObjectId} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<User>}
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isLocked()) {
    throw new ApiError(httpStatus.LOCKED, 'Account is locked due to too many failed login attempts');
  }

  const isCurrentPasswordValid = await user.isPasswordMatch(currentPassword);
  if (!isCurrentPasswordValid) {
    await user.incLoginAttempts();
    throw new ApiError(httpStatus.BAD_REQUEST, 'Current password is incorrect');
  }

  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, validation.feedback.join('. '));
  }

  const isInHistory = await user.isPasswordInHistory(newPassword);
  if (isInHistory) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You cannot reuse a previous password. Please choose a different password.');
  }

  user.password = newPassword;
  await user.save();
  await user.resetLoginAttempts();

  return user;
};

/**
 * Unlock user account
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const unlockAccount = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  await user.resetLoginAttempts();
  return user;
};

/**
 * Get user security information
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
const getUserSecurityInfo = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const passwordAge = user.lastPasswordChange
    ? Math.floor((Date.now() - user.lastPasswordChange.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    userId: user.id,
    email: user.email,
    mfaEnabled: user.mfaEnabled,
    isLocked: user.isLocked(),
    loginAttempts: user.loginAttempts || 0,
    lockUntil: user.lockUntil,
    lastPasswordChange: user.lastPasswordChange,
    passwordAge: passwordAge,
    passwordHistoryCount: user.passwordHistory ? user.passwordHistory.length : 0,
    backupCodesRemaining: user.mfaBackupCodes ? user.mfaBackupCodes.length : 0,
    securityRecommendations: [
      ...(passwordAge && passwordAge > 90 ? ['Change password (older than 90 days)'] : []),
      ...(!user.mfaEnabled ? ['Enable MFA for better security'] : []),
      ...(user.isLocked() ? ['Account is locked due to failed attempts'] : []),
      ...(user.mfaEnabled && user.mfaBackupCodes && user.mfaBackupCodes.length < 3 ? ['Generate new backup codes'] : []),
    ],
  };
};

/**
 * Handle failed login attempt
 * @param {string} email
 * @returns {Promise<void>}
 */
const handleFailedLogin = async (email) => {
  const user = await getUserByEmail(email);
  if (user) {
    await user.incLoginAttempts();
  }
};

/**
 * Handle successful login
 * @param {ObjectId} userId
 * @returns {Promise<void>}
 */
const handleSuccessfulLogin = async (userId) => {
  const user = await getUserById(userId);
  if (user) {
    await user.resetLoginAttempts();
  }
};

/**
 * Check if user needs to change password
 * @param {ObjectId} userId
 * @returns {Promise<boolean>}
 */
const needsPasswordChange = async (userId) => {
  const user = await getUserById(userId);
  if (!user || !user.lastPasswordChange) {
    return true;
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return user.lastPasswordChange < ninetyDaysAgo;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  setupMFA,
  enableMFA,
  disableMFA,
  verifyMFAToken,
  useBackupCode,
  changePassword,
  unlockAccount,
  getUserSecurityInfo,
  handleFailedLogin,
  handleSuccessfulLogin,
  needsPasswordChange,
};
