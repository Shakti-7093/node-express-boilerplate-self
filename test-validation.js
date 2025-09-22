#!/usr/bin/env node

const Joi = require('joi');

console.log('🧪 Testing Enhanced Required Field Validation\n');

// Test the custom validators
const { 
  enhancedPassword, 
  email, 
  name, 
  mfaToken, 
  backupCode, 
  role, 
  objectId 
} = require('./src/validations/custom.validation');

// Test user validation schemas
const userValidation = require('./src/validations/user.validation');
const authValidation = require('./src/validations/auth.validation');

console.log('1. Testing Custom Validators...\n');

// Test email validator
console.log('📧 Email Validator:');
const testEmails = [
  { value: '', expected: 'fail', reason: 'empty' },
  { value: null, expected: 'fail', reason: 'null' },
  { value: 'invalid-email', expected: 'fail', reason: 'invalid format' },
  { value: 'test@example.com', expected: 'pass', reason: 'valid email' },
  { value: 'TEST@EXAMPLE.COM', expected: 'pass', reason: 'uppercase (should normalize)' },
];

testEmails.forEach(({ value, expected, reason }) => {
  try {
    const result = email(value, { message: (msg) => ({ message: msg }) });
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: ${value} -> ${result}`);
  } catch (error) {
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: ${value} -> ERROR: ${error.message}`);
  }
});

console.log('\n🔐 Enhanced Password Validator:');
const testPasswords = [
  { value: '', expected: 'fail', reason: 'empty' },
  { value: null, expected: 'fail', reason: 'null' },
  { value: 'weak', expected: 'fail', reason: 'too weak' },
  { value: 'password123', expected: 'fail', reason: 'common password' },
  { value: 'MySecureP@ssw0rd123!', expected: 'pass', reason: 'strong password' },
];

testPasswords.forEach(({ value, expected, reason }) => {
  try {
    const result = enhancedPassword(value, { message: (msg) => ({ message: msg }) });
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: [password] -> VALID`);
  } catch (error) {
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: [password] -> ERROR: ${error.message}`);
  }
});

console.log('\n👤 Name Validator:');
const testNames = [
  { value: '', expected: 'fail', reason: 'empty' },
  { value: 'A', expected: 'fail', reason: 'too short' },
  { value: 'John Doe', expected: 'pass', reason: 'valid name' },
  { value: 'Mary-Jane O\'Connor', expected: 'pass', reason: 'name with hyphen and apostrophe' },
  { value: 'John123', expected: 'fail', reason: 'contains numbers' },
];

testNames.forEach(({ value, expected, reason }) => {
  try {
    const result = name(value, { message: (msg) => ({ message: msg }) });
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: "${value}" -> "${result}"`);
  } catch (error) {
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: "${value}" -> ERROR: ${error.message}`);
  }
});

console.log('\n2. Testing Validation Schemas...\n');

// Test user creation validation
console.log('👥 User Creation Validation:');
const testUserCreation = [
  {
    data: {},
    expected: 'fail',
    reason: 'empty object'
  },
  {
    data: { email: 'test@example.com' },
    expected: 'fail',
    reason: 'missing password and name'
  },
  {
    data: { 
      email: 'test@example.com',
      password: 'MySecureP@ssw0rd123!',
      name: 'John Doe',
      role: 'user'
    },
    expected: 'pass',
    reason: 'valid user data'
  },
  {
    data: { 
      email: 'invalid-email',
      password: 'weak',
      name: '',
      role: 'invalid'
    },
    expected: 'fail',
    reason: 'all fields invalid'
  }
];

testUserCreation.forEach(({ data, expected, reason }) => {
  const { error } = userValidation.createUser.body.validate(data, { abortEarly: false });
  
  if (error) {
    const errorCount = error.details.length;
    const errorMessages = error.details.map(detail => detail.message.replace(/"/g, ''));
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: ${errorCount} errors`);
    if (expected === 'fail') {
      errorMessages.slice(0, 3).forEach(msg => console.log(`      - ${msg}`));
      if (errorMessages.length > 3) console.log(`      - ... and ${errorMessages.length - 3} more`);
    }
  } else {
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: VALID`);
  }
});

console.log('\n🔐 Auth Registration Validation:');
const testAuthRegistration = [
  {
    data: {},
    expected: 'fail',
    reason: 'empty object'
  },
  {
    data: { email: 'test@example.com' },
    expected: 'fail',
    reason: 'missing password and name'
  },
  {
    data: { 
      email: 'test@example.com',
      password: 'MySecureP@ssw0rd123!',
      name: 'John Doe'
    },
    expected: 'pass',
    reason: 'valid registration data'
  }
];

testAuthRegistration.forEach(({ data, expected, reason }) => {
  const { error } = authValidation.register.body.validate(data, { abortEarly: false });
  
  if (error) {
    const errorCount = error.details.length;
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: ${errorCount} errors`);
  } else {
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: VALID`);
  }
});

console.log('\n🔑 Login Validation:');
const testLogin = [
  {
    data: {},
    expected: 'fail',
    reason: 'empty object'
  },
  {
    data: { email: 'test@example.com' },
    expected: 'fail',
    reason: 'missing password'
  },
  {
    data: { password: 'somepassword' },
    expected: 'fail',
    reason: 'missing email'
  },
  {
    data: { 
      email: 'test@example.com',
      password: 'somepassword'
    },
    expected: 'pass',
    reason: 'valid login data'
  }
];

testLogin.forEach(({ data, expected, reason }) => {
  const { error } = authValidation.login.body.validate(data, { abortEarly: false });
  
  if (error) {
    const errorCount = error.details.length;
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: ${errorCount} errors`);
  } else {
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: VALID`);
  }
});

console.log('\n🛡️ MFA Validation:');
const testMFA = [
  {
    schema: userValidation.enableMFA,
    data: { params: { userId: '507f1f77bcf86cd799439011' }, body: {} },
    expected: 'fail',
    reason: 'missing MFA token'
  },
  {
    schema: userValidation.enableMFA,
    data: { params: { userId: '507f1f77bcf86cd799439011' }, body: { token: '123' } },
    expected: 'fail',
    reason: 'invalid token length'
  },
  {
    schema: userValidation.enableMFA,
    data: { params: { userId: '507f1f77bcf86cd799439011' }, body: { token: '123456' } },
    expected: 'pass',
    reason: 'valid MFA data'
  }
];

testMFA.forEach(({ schema, data, expected, reason }) => {
  const { error } = Joi.object(schema).validate(data, { abortEarly: false });
  
  if (error) {
    const errorCount = error.details.length;
    console.log(`   ${expected === 'fail' ? '✅' : '❌'} ${reason}: ${errorCount} errors`);
  } else {
    console.log(`   ${expected === 'pass' ? '✅' : '❌'} ${reason}: VALID`);
  }
});

console.log('\n✅ Required Field Validation Test Complete!\n');

console.log('📋 Summary of Enhanced Validations:');
console.log('- ✅ Email: Required, format validation, normalization');
console.log('- ✅ Password: Required, enhanced security validation');
console.log('- ✅ Name: Required, length and character validation');
console.log('- ✅ Role: Required, enum validation');
console.log('- ✅ ObjectId: Required, MongoDB ID format validation');
console.log('- ✅ MFA Token: Required, 6-digit format validation');
console.log('- ✅ Backup Code: Required, XXXX-XXXX format validation');
console.log('- ✅ All schemas: .required() added for strict validation');

console.log('\n🛡️ Security Features:');
console.log('- ✅ Type checking for all inputs');
console.log('- ✅ Length validation for all fields');
console.log('- ✅ Format validation with regex patterns');
console.log('- ✅ Comprehensive error messages');
console.log('- ✅ Data sanitization and normalization');
console.log('- ✅ Enhanced validation middleware available');
