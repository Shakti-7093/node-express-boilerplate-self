const objectId = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.error('string.pattern.base', { message: 'must be a valid mongo id' });
  }
  return value;
};

const password = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }
  if (value.length < 8) {
    return helpers.error('string.min', { limit: 8 });
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return helpers.error('string.pattern.base', { message: 'must contain at least 1 letter and 1 number' });
  }
  return value;
};

const enhancedPassword = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }

  const { validatePasswordStrength } = require('../utils/passwordSecurity');

  const validation = validatePasswordStrength(value);
  if (!validation.isValid) {
    return helpers.error('string.pattern.base', { message: validation.feedback.join('. ') });
  }

  return value;
};

const email = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }

  const validator = require('validator');
  if (!validator.isEmail(value)) {
    return helpers.error('string.email');
  }

  return value.toLowerCase().trim();
};

const name = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }
  if (value.trim().length < 2) {
    return helpers.error('string.min', { limit: 2 });
  }
  if (value.trim().length > 50) {
    return helpers.error('string.max', { limit: 50 });
  }
  if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) {
    return helpers.error('string.pattern.base', { message: 'can only contain letters, spaces, hyphens, and apostrophes' });
  }

  return value.trim();
};

const mfaToken = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }
  if (!/^\d{6}$/.test(value)) {
    return helpers.error('string.pattern.base', { message: 'must be exactly 6 digits' });
  }

  return value;
};

const backupCode = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.toUpperCase())) {
    return helpers.error('string.pattern.base', { message: 'must be in format XXXX-XXXX' });
  }

  return value.toUpperCase();
};

const role = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  if (typeof value !== 'string') {
    return helpers.error('string.base');
  }

  const { roles } = require('../config/roles');
  if (!roles.includes(value)) {
    return helpers.error('any.only', { valids: roles });
  }

  return value;
};

module.exports = {
  objectId,
  password,
  enhancedPassword,
  email,
  name,
  mfaToken,
  backupCode,
  role,
};
