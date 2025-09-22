const nodemailer = require('nodemailer');
const config = require('./src/config/config');
const logger = require('./src/config/logger');

console.log('🧪 Testing SMTP Configuration\n');
console.log('📧 SMTP Settings:');
console.log(`   Host: ${config.email.smtp.host || 'NOT SET'}`);
console.log(`   Port: ${config.email.smtp.port || 'NOT SET'}`);
console.log(`   Username: ${config.email.smtp.auth.user || 'NOT SET'}`);
console.log(`   Password: ${config.email.smtp.auth.pass ? '***SET***' : 'NOT SET'}`);
console.log(`   From: ${config.email.from || 'NOT SET'}`);
console.log('');

async function testSMTP() {
  try {
    logger.info('🔍 Testing SMTP connection...');
    const transporter = nodemailer.createTransport(config.email.smtp);
    await transporter.verify();
    logger.info('✅ SMTP connection successful!');
    const testEmail = {
      from: config.email.from,
      to: 'test@example.com',
      subject: 'SMTP Test Email',
      text: 'This is a test email to verify SMTP configuration is working correctly.',
    };
    await transporter.sendMail(testEmail);
    logger.info('✅ Test email sent successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ SMTP connection failed:');
    logger.error('   Error:', error.message);

    if (error.code === 'EAUTH') {
      logger.error('\n💡 Authentication failed. Check:');
      logger.error('   - Username/email is correct');
      logger.error('   - Using App Password (not regular password)');
      logger.error('   - 2FA is enabled on your Google account');
    } else if (error.code === 'ECONNECTION') {
      logger.error('\n💡 Connection failed. Check:');
      logger.error('   - SMTP host and port are correct');
      logger.error('   - Internet connection is working');
      logger.error('   - Firewall is not blocking the connection');
      process.exit(1);
    }
  }
}

function checkConfig() {
  const missing = [];

  if (!config.email.smtp.host) missing.push('SMTP_HOST');
  if (!config.email.smtp.port) missing.push('SMTP_PORT');
  if (!config.email.smtp.auth.user) missing.push('SMTP_USERNAME');
  if (!config.email.smtp.auth.pass) missing.push('SMTP_PASSWORD');
  if (!config.email.from) missing.push('EMAIL_FROM');
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach((env) => logger.error(`   - ${env}`));
    logger.info('\n💡 Please add these to your .env file');
    process.exit(1);
  }
  return true;
}

if (checkConfig()) {
  testSMTP();
} else {
  logger.info('\n📋 Expected .env configuration:');
  logger.info('SMTP_HOST=smtp.gmail.com');
  logger.info('SMTP_PORT=587');
  logger.info('SMTP_USERNAME=youremail@gmail.com');
  logger.info('SMTP_PASSWORD=your-app-password');
  logger.info('EMAIL_FROM=youremail@gmail.com');
}
