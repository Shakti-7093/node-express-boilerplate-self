const Joi = require('joi');
const { objectId, enhancedPassword, email, name, mfaToken, backupCode, role } = require('./custom.validation');

const createUser = {
  body: Joi.object()
    .keys({
      email: Joi.string().required().custom(email),
      password: Joi.string().required().custom(enhancedPassword),
      name: Joi.string().required().custom(name),
      role: Joi.string().required().custom(role),
    })
    .required(),
};

const getUsers = {
  query: Joi.object().keys({
    name: Joi.string().custom(name).optional(),
    role: Joi.string().custom(role).optional(),
    sortBy: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional(),
  }),
};

const getUser = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
};

const updateUser = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
  body: Joi.object()
    .keys({
      email: Joi.string().custom(email).optional(),
      password: Joi.string().custom(enhancedPassword).optional(),
      name: Joi.string().custom(name).optional(),
      mfaEnabled: Joi.boolean().optional(),
    })
    .min(1)
    .required(),
};

const deleteUser = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
};

const setupMFA = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
};

const enableMFA = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
  body: Joi.object()
    .keys({
      token: Joi.string().required().custom(mfaToken),
    })
    .required(),
};

const disableMFA = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
  body: Joi.object()
    .keys({
      token: Joi.string().required().custom(mfaToken),
    })
    .required(),
};

const verifyMFA = {
  body: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
      token: Joi.string().required().custom(mfaToken),
    })
    .required(),
};

const useBackupCode = {
  body: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
      backupCode: Joi.string().required().custom(backupCode),
    })
    .required(),
};

const validatePasswordStrength = {
  body: Joi.object()
    .keys({
      password: Joi.string().required().custom(enhancedPassword),
    })
    .required(),
};

const changePassword = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
  body: Joi.object()
    .keys({
      currentPassword: Joi.string().required().min(1),
      newPassword: Joi.string().required().custom(enhancedPassword),
    })
    .required(),
};

const unlockAccount = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
};

const getSecurityInfo = {
  params: Joi.object()
    .keys({
      userId: Joi.string().required().custom(objectId),
    })
    .required(),
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  setupMFA,
  enableMFA,
  disableMFA,
  verifyMFA,
  useBackupCode,
  validatePasswordStrength,
  changePassword,
  unlockAccount,
  getSecurityInfo,
};
