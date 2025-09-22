const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../config/roles');
const { validatePasswordStrength } = require('../utils/passwordSecurity');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 12,
      validate(value) {
        const validation = validatePasswordStrength(value);
        if (!validation.isValid) {
          throw new Error(validation.feedback.join('. '));
        }
      },
      private: true, // used by the toJSON plugin
    },
    passwordHistory: [{
      type: String,
      private: true,
    }],
    mfaSecret: {
      type: String,
      private: true,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaBackupCodes: [{
      type: String,
      private: true,
    }],
    lastPasswordChange: {
      type: Date,
      default: Date.now,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    role: {
      type: String,
      enum: roles,
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if password was used before by the same user
 * @param {string} password - The password to check
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordInHistory = async function (password) {
  const user = this;
  if (!user.passwordHistory || user.passwordHistory.length === 0) {
    return false;
  }
  
  for (const hashedPassword of user.passwordHistory) {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (isMatch) {
      return true;
    }
  }
  
  return false;
};

/**
 * Check if account is locked
 * @returns {boolean}
 */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment login attempts
 * @returns {Promise<void>}
 */
userSchema.methods.incLoginAttempts = async function () {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.lockUntil) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

/**
 * Reset login attempts
 * @returns {Promise<void>}
 */
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  return bcrypt.compare(password, user.password);
};

userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    // Check if password was used before by this user
    const isInHistory = await user.isPasswordInHistory(user.password);
    if (isInHistory) {
      throw new Error('You cannot reuse a previous password. Please choose a different password.');
    }
    
    // Store current password in history before hashing new one
    if (user.password && !user.isNew) {
      const currentUser = await this.constructor.findById(user._id);
      if (currentUser && currentUser.password) {
        user.passwordHistory = user.passwordHistory || [];
        user.passwordHistory.push(currentUser.password);
        
        // Keep only last 5 passwords
        if (user.passwordHistory.length > 5) {
          user.passwordHistory = user.passwordHistory.slice(-5);
        }
      }
    }
    
    user.password = await bcrypt.hash(user.password, 12);
    user.lastPasswordChange = new Date();
  }
  next();
});

/**
 * @typedef User
 */
const User = mongoose.model('User', userSchema);

module.exports = User;
