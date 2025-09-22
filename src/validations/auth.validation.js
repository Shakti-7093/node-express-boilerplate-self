const Joi = require('joi');
const { password, enhancedPassword, email, name } = require('./custom.validation');

const register = {
  body: Joi.object().keys({
    email: Joi.string().required().custom(email),
    password: Joi.string().required().custom(enhancedPassword),
    name: Joi.string().required().custom(name),
  }).required(),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required().custom(email),
    password: Joi.string().required().min(1),
  }).required(),
};

const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required().min(1),
  }).required(),
};

const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required().min(1),
  }).required(),
};

const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().required().custom(email),
  }).required(),
};

const resetPassword = {
  query: Joi.object().keys({
    token: Joi.string().required().min(1),
  }).required(),
  body: Joi.object().keys({
    password: Joi.string().required().custom(enhancedPassword),
  }).required(),
};

const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required().min(1),
  }).required(),
};

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
