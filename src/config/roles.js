const allRoles = {
  user: [],
  admin: [
    'getUsers',
    'manageUsers',
    'manageMFA',
    'manageBackupCodes',
    'manageAccount',
    'manageLogs',
    'manageRoles',
    'manageSettings',
    'manageUsers',
  ],
  support: [
    'getUsers',
    'manageUsers',
    'manageMFA',
    'manageBackupCodes',
    'manageAccount',
    'manageLogs',
    'manageRoles',
    'manageSettings',
  ],
  hr: [
    'getUsers',
    'manageUsers',
    'manageMFA',
    'manageBackupCodes',
    'manageAccount',
    'manageLogs',
    'manageRoles',
    'manageSettings',
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
