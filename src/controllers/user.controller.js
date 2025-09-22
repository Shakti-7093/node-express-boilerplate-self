const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const userService = require('../services/user.service');
const ApiError = require('../utils/ApiError');
const { validatePasswordStrength } = require('../utils/passwordSecurity');
const { pick } = require('../utils/pick');

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

const updateUserById = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send(user);
});

const deleteUserById = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const setupMFA = catchAsync(async (req, res) => {
  const data = await userService.setupMFA(req.params.userId);
  res.send(data);
});

const enableMFA = catchAsync(async (req, res) => {
  const user = await userService.enableMFA(req.params.userId, req.body.token);
  res.send(user);
});

const disableMFA = catchAsync(async (req, res) => {
  const user = await userService.disableMFA(req.params.userId, req.body.token);
  res.send(user);
});

const verifyMFAToken = catchAsync(async (req, res) => {
  const isValid = await userService.verifyMFAToken(req.body.userId, req.body.token);
  res.send({ valid: isValid });
});

const useBackupCode = catchAsync(async (req, res) => {
  const success = await userService.useBackupCode(req.params.userId, req.body.code);
  res.send({ success });
});

const changePassword = catchAsync(async (req, res) => {
  const user = await userService.changePassword(req.params.userId, req.body.currentPassword, req.body.newPassword);
  res.send(user);
});

const unlockAccount = catchAsync(async (req, res) => {
  const user = await userService.unlockAccount(req.params.userId);
  res.send(user);
});

const getUserSecurityInfo = catchAsync(async (req, res) => {
  const info = await userService.getUserSecurityInfo(req.params.userId);
  res.send(info);
});

const handleFailedLogin = catchAsync(async (req, res) => {
  await userService.handleFailedLogin(req.body.email);
  res.status(httpStatus.NO_CONTENT).send();
});

const handleSuccessfulLogin = catchAsync(async (req, res) => {
  await userService.handleSuccessfulLogin(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const needsPasswordChange = catchAsync(async (req, res) => {
  const needsChange = await userService.needsPasswordChange(req.params.userId);
  res.send({ needsChange });
});

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser: updateUserById,
  deleteUser: deleteUserById,
  setupMFA,
  enableMFA,
  disableMFA,
  verifyMFA: verifyMFAToken,
  useBackupCode,
  validatePasswordStrength,
  changePassword,
  unlockAccount,
  getUserSecurityInfo,
  handleFailedLogin,
  handleSuccessfulLogin,
  needsPasswordChange,
};
