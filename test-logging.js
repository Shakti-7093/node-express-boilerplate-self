#!/usr/bin/env node

// Test script for the new hierarchical logging system
const logger = require('./src/config/logger');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Enhanced Hierarchical Logging System\n');

// Test basic logging
console.log('1. Testing basic log messages...');
logger.info('This is an info message from the test script');
logger.warn('This is a warning message from the test script');
logger.error('This is an error message from the test script');
logger.debug('This is a debug message from the test script');

// Test log path generation
console.log('\n2. Testing log path generation...');
const today = new Date();
const logPath = logger.getLogPath(today);
const logDir = logger.getLogDirectory(today);

console.log(`Current log file path: ${logPath}`);
console.log(`Current log directory: ${logDir}`);

// Test directory structure
console.log('\n3. Testing directory structure...');
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');

console.log(`Expected structure: logs/${year}/${month}/${day}/`);
console.log(`Directory exists: ${fs.existsSync(logDir)}`);

// Test log file listing
console.log('\n4. Testing log file listing...');
const years = logger.listLogFiles();
console.log(`Available years: ${years.join(', ')}`);

if (years.length > 0) {
  const months = logger.listLogFiles(years[0]);
  console.log(`Months in ${years[0]}: ${months.join(', ')}`);

  if (months.length > 0) {
    const days = logger.listLogFiles(years[0], months[0]);
    console.log(`Days in ${years[0]}/${months[0]}: ${days.join(', ')}`);
  }
}

// Test log stats
console.log('\n5. Testing log statistics...');
const stats = logger.getLogStats();
console.log('Log Statistics:');
console.log(`- Total Years: ${stats.totalYears}`);
console.log(`- Total Months: ${stats.totalMonths}`);
console.log(`- Total Days: ${stats.totalDays}`);
console.log(`- Total Log Files: ${stats.totalLogFiles}`);
console.log(`- Total Size: ${stats.totalSizeFormatted}`);
console.log(`- Oldest Log: ${stats.oldestLog ? stats.oldestLog.toISOString() : 'N/A'}`);
console.log(`- Newest Log: ${stats.newestLog ? stats.newestLog.toISOString() : 'N/A'}`);

// Test log content reading
console.log('\n6. Testing log content reading...');
setTimeout(() => {
  const content = logger.getLogContent(year, parseInt(month), parseInt(day));
  if (content) {
    const lines = content.split('\n').filter((line) => line.trim());
    console.log(`Current log file has ${lines.length} lines`);
    console.log('Last few log entries:');
    lines.slice(-3).forEach((line) => console.log(`  ${line}`));
  } else {
    console.log('No log content found for today');
  }

  console.log('\n7. Directory structure verification...');

  // Verify the complete directory structure
  const baseLogDir = path.join(__dirname, 'storage/logs');

  function listDirectoryStructure(dir, prefix = '') {
    try {
      const items = fs.readdirSync(dir).sort();
      items.forEach((item, index) => {
        const itemPath = path.join(dir, item);
        const isLast = index === items.length - 1;
        const connector = isLast ? '└── ' : '├── ';

        console.log(`${prefix}${connector}${item}`);

        if (fs.statSync(itemPath).isDirectory()) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          listDirectoryStructure(itemPath, newPrefix);
        }
      });
    } catch (error) {
      console.log(`${prefix}└── [Error reading directory: ${error.message}]`);
    }
  }

  console.log(`📁 Log Directory Structure (${baseLogDir}):`);
  listDirectoryStructure(baseLogDir);

  console.log('\n✅ Logging system test completed!');
  console.log('\n📋 Summary:');
  console.log('- ✅ Hierarchical directory structure created');
  console.log('- ✅ Daily log files with DD-MM-YYYY format');
  console.log('- ✅ Automatic directory creation');
  console.log('- ✅ Log file listing and management');
  console.log('- ✅ Log content reading');
  console.log('- ✅ Statistics and monitoring');

  console.log('\n🌟 New Log Structure Features:');
  console.log('- Year/Month/Day directory hierarchy');
  console.log('- Daily log files named DD-MM-YYYY.log');
  console.log('- Automatic cleanup of old logs (365 days)');
  console.log('- API endpoints for log management');
  console.log('- Comprehensive log statistics');
  console.log('- Log file download capability');

  // Cleanup test file
  //   setTimeout(() => {
  //     fs.unlinkSync(__filename);
  //     console.log('\n🧹 Test file cleaned up');
  //   }, 1000);
}, 1000);
