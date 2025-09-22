const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const {
  securityHeaders,
  geoSecurityCheck,
  detectSuspiciousActivity,
  requestSizeLimiter,
} = require('./middlewares/securityMiddleware');
const { User } = require('./models');
const { generateSecret, generateBackupCodes, hashBackupCode } = require('./utils/mfaUtils');
const { validatePasswordStrength, generateSecurePassword } = require('./utils/passwordSecurity');

// Apply global security middleware
app.use(securityHeaders);
app.use(geoSecurityCheck);
app.use(detectSuspiciousActivity);
app.use(requestSizeLimiter);

// Security monitoring and logging
const securityMonitor = {
  loginAttempts: new Map(),
  suspiciousIPs: new Set(),

  logSecurityEvent: (type, details) => {
    const timestamp = new Date().toISOString();
    logger.warn(`[SECURITY] ${timestamp} - ${type}: ${JSON.stringify(details)}`);
  },

  trackLoginAttempt: (ip, success) => {
    const attempts = securityMonitor.loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    attempts.success = success;

    securityMonitor.loginAttempts.set(ip, attempts);

    // Mark IP as suspicious after 10 failed attempts
    if (!success && attempts.count >= 10) {
      securityMonitor.suspiciousIPs.add(ip);
      securityMonitor.logSecurityEvent('SUSPICIOUS_IP', { ip, attempts: attempts.count });
    }
  },

  isSuspiciousIP: (ip) => {
    return securityMonitor.suspiciousIPs.has(ip);
  },

  // Clean up old entries every hour
  cleanup: () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [ip, data] of securityMonitor.loginAttempts.entries()) {
      if (data.lastAttempt < oneHourAgo) {
        securityMonitor.loginAttempts.delete(ip);
      }
    }
  },
};

// Cleanup suspicious IPs every hour
setInterval(securityMonitor.cleanup, 60 * 60 * 1000);

// Password security utilities
const passwordUtils = {
  validateStrength: validatePasswordStrength,
  generateSecure: generateSecurePassword,

  // Check if password needs to be changed (older than 90 days)
  needsPasswordChange: (user) => {
    if (!user.lastPasswordChange) return true;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return user.lastPasswordChange < ninetyDaysAgo;
  },

  // Generate password reset token with expiry
  generateResetToken: () => {
    const crypto = require('crypto');
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  },
};

// MFA utilities
const mfaUtils = {
  setupMFA: async (userId) => {
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) => hashBackupCode(code));

    await User.findByIdAndUpdate(userId, {
      mfaSecret: secret,
      mfaBackupCodes: hashedBackupCodes,
    });

    return { secret, backupCodes };
  },

  enableMFA: async (userId) => {
    await User.findByIdAndUpdate(userId, { mfaEnabled: true });
    logger.info(`MFA enabled for user ${userId}`);
  },

  disableMFA: async (userId) => {
    await User.findByIdAndUpdate(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
    });
    logger.info(`MFA disabled for user ${userId}`);
  },
};

// Account security utilities
const accountSecurity = {
  // Check for compromised accounts
  checkCompromised: async (userId) => {
    const user = await User.findById(userId);
    if (!user) return false;

    // Check for suspicious login patterns
    const recentLogins = user.loginAttempts || 0;
    const isLocked = user.isLocked();
    const passwordAge = passwordUtils.needsPasswordChange(user);

    return {
      isCompromised: recentLogins > 5 || isLocked,
      needsPasswordChange: passwordAge,
      isLocked,
      recommendations: [
        ...(recentLogins > 5 ? ['Enable MFA'] : []),
        ...(passwordAge ? ['Change password'] : []),
        ...(isLocked ? ['Account is locked due to failed attempts'] : []),
      ],
    };
  },

  // Force password change for all users
  forcePasswordChangeAll: async () => {
    await User.updateMany({}, { lastPasswordChange: new Date(0) });
    logger.info('Forced password change for all users');
  },

  // Get security stats
  getSecurityStats: async () => {
    const totalUsers = await User.countDocuments();
    const mfaEnabled = await User.countDocuments({ mfaEnabled: true });
    const lockedAccounts = await User.countDocuments({ lockUntil: { $gt: Date.now() } });
    const oldPasswords = await User.countDocuments({
      lastPasswordChange: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });

    return {
      totalUsers,
      mfaEnabled,
      mfaEnabledPercentage: Math.round((mfaEnabled / totalUsers) * 100),
      lockedAccounts,
      oldPasswords,
      suspiciousIPs: securityMonitor.suspiciousIPs.size,
    };
  },
};

// Security API endpoints for monitoring and management
app.get('/api/security/stats', async (req, res) => {
  try {
    const stats = await accountSecurity.getSecurityStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting security stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/security/force-password-change', async (req, res) => {
  try {
    // This should be protected by admin authentication in production
    await accountSecurity.forcePasswordChangeAll();
    res.json({
      success: true,
      message: 'Password change forced for all users',
    });
  } catch (error) {
    logger.error('Error forcing password change:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/security/suspicious-ips', (req, res) => {
  try {
    const suspiciousIPs = Array.from(securityMonitor.suspiciousIPs);
    const loginAttempts = Object.fromEntries(securityMonitor.loginAttempts);

    res.json({
      success: true,
      data: {
        suspiciousIPs,
        totalSuspicious: suspiciousIPs.length,
        recentAttempts: Object.keys(loginAttempts).length,
        loginAttempts,
      },
    });
  } catch (error) {
    logger.error('Error getting suspicious IPs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/security/clear-suspicious-ip/:ip', (req, res) => {
  try {
    const { ip } = req.params;
    securityMonitor.suspiciousIPs.delete(ip);
    securityMonitor.loginAttempts.delete(ip);

    logger.info(`Cleared suspicious IP: ${ip}`);
    res.json({
      success: true,
      message: `Cleared suspicious status for IP: ${ip}`,
    });
  } catch (error) {
    logger.error('Error clearing suspicious IP:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/security/password/generate', (req, res) => {
  try {
    const { length = 16 } = req.query;
    const password = passwordUtils.generateSecure(parseInt(length, 10));
    const strength = passwordUtils.validateStrength(password);

    res.json({
      success: true,
      data: {
        password,
        strength: {
          score: strength.score,
          entropy: strength.entropy,
          isValid: strength.isValid,
        },
      },
    });
  } catch (error) {
    logger.error('Error generating password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/security/password/validate', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const validation = passwordUtils.validateStrength(password);
    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    logger.error('Error validating password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Expose security utilities globally
global.securityUtils = {
  monitor: securityMonitor,
  password: passwordUtils,
  mfa: mfaUtils,
  account: accountSecurity,
};

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');

  // Log security initialization
  logger.info('Security features initialized:');
  logger.info('- Enhanced password requirements with entropy checking');
  logger.info('- Personal password history (last 5 passwords)');
  logger.info('- Account lockout after 5 failed attempts');
  logger.info('- Comprehensive rate limiting');
  logger.info('- MFA support with backup codes');
  logger.info('- Suspicious activity detection');
  logger.info('- Security monitoring and logging');

  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);

    // Log initial security stats
    accountSecurity
      .getSecurityStats()
      .then((stats) => {
        logger.info(
          `Security Stats - Users: ${stats.totalUsers}, MFA: ${stats.mfaEnabledPercentage}%, Locked: ${stats.lockedAccounts}`
        );
      })
      .catch((err) => {
        logger.error('Error getting security stats:', err);
      });
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
