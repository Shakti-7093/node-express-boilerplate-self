const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * Enhanced rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Strict rate limiting for password reset
 */
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for registration
 */
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registration attempts per hour
  message: {
    error: 'Too many registration attempts, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Account lockout middleware
 */
const checkAccountLockout = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next();
    }

    const user = await User.findOne({ email });

    if (user && user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000)); // minutes
      throw new ApiError(
        httpStatus.LOCKED,
        `Account is locked due to too many failed login attempts. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    req.user = user; // Pass user to next middleware
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Suspicious activity detection
 */
const detectSuspiciousActivity = (req, res, next) => {
  try {
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    const requestBody = JSON.stringify(req.body);
    const requestQuery = JSON.stringify(req.query);

    // Check for suspicious patterns in various parts of the request
    const checkString = `${userAgent} ${referer} ${requestBody} ${requestQuery}`;

    // SQL injection patterns
    const sqlPatterns = ["'", ';', '--', '|', '%27', '%3B', '%7C'];
    // XSS patterns
    const xssPatterns = ['<script', '<iframe', '<object', '<embed', '<link', '<meta', '<form'];
    // Path traversal patterns
    const pathPatterns = ['../', '..\\', '%2e%2e%2f', '%2e%2e%5c'];
    // Command injection patterns
    const cmdPatterns = ['|', '&', ';', '$(', '`'];

    const allPatterns = [...sqlPatterns, ...xssPatterns, ...pathPatterns, ...cmdPatterns];

    const lowerCheckString = checkString.toLowerCase();
    for (const pattern of allPatterns) {
      if (lowerCheckString.includes(pattern.toLowerCase())) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Suspicious activity detected');
      }
    }

    // Check for unusual request characteristics
    if (userAgent.length > 1000) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user agent');
    }

    // Check for empty or suspicious user agents
    const suspiciousUserAgents = ['curl', 'wget', 'python', 'bot', 'crawler', 'scanner', 'exploit'];

    const lowerUserAgent = userAgent.toLowerCase();
    for (const suspicious of suspiciousUserAgents) {
      if (lowerUserAgent.includes(suspicious)) {
        // Log this but don't block (might be legitimate API usage)
        console.warn(`Suspicious user agent detected: ${userAgent} from IP: ${req.ip}`);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Geolocation-based security check
 */
const geoSecurityCheck = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const forwardedFor = req.get('X-Forwarded-For');
  const realIP = req.get('X-Real-IP');

  // Log IP information for security monitoring
  console.log(`Request from IP: ${clientIP}, X-Forwarded-For: ${forwardedFor}, X-Real-IP: ${realIP}`);

  // Check for IP header manipulation
  if (forwardedFor && forwardedFor.split(',').length > 5) {
    console.warn(`Suspicious X-Forwarded-For header: ${forwardedFor}`);
  }

  // Add IP info to request for logging
  req.securityInfo = {
    clientIP,
    forwardedFor,
    realIP,
    timestamp: new Date().toISOString(),
  };

  next();
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    throw new ApiError(httpStatus.PAYLOAD_TOO_LARGE, 'Request payload too large');
  }

  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS header (only for HTTPS)
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

/**
 * CSRF protection for state-changing operations
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.get('X-CSRF-Token') || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid CSRF token');
  }

  next();
};

module.exports = {
  authRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  checkAccountLockout,
  detectSuspiciousActivity,
  geoSecurityCheck,
  requestSizeLimiter,
  securityHeaders,
  csrfProtection,
};
