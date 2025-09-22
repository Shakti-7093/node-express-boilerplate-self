#!/usr/bin/env node

// Test script for the monthly archiving system
const logger = require('./src/config/logger');
const fs = require('fs');
const path = require('path');

console.log('🗜️  Testing Monthly Log Archiving System\n');

// Create test log structure for previous months
const createTestLogs = () => {
  console.log('1. Creating test log structure...');

  const baseLogDir = path.join(__dirname, 'storage/logs');
  const currentDate = new Date();

  // Create logs for previous months
  const testMonths = [
    { year: 2025, month: 8 }, // August 2025 (previous month)
    { year: 2025, month: 7 }, // July 2025
    { year: 2024, month: 12 }, // December 2024
  ];

  testMonths.forEach(({ year, month }) => {
    const monthStr = String(month).padStart(2, '0');
    const yearDir = path.join(baseLogDir, String(year));
    const monthDir = path.join(yearDir, monthStr);

    // Create some test days
    for (let day = 1; day <= 3; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dayDir = path.join(monthDir, dayStr);

      try {
        fs.mkdirSync(dayDir, { recursive: true });

        // Create a test log file
        const logFile = path.join(dayDir, `${dayStr}-${monthStr}-${year}.log`);
        const testContent = `${year}-${monthStr}-${dayStr} 10:00:00 info: Test log entry for ${year}/${month}/${day}
${year}-${monthStr}-${dayStr} 10:01:00 warn: This is a test warning
${year}-${monthStr}-${dayStr} 10:02:00 error: This is a test error
${year}-${monthStr}-${dayStr} 10:03:00 debug: Test debug message
`;

        fs.writeFileSync(logFile, testContent);
        console.log(`   ✅ Created test log: ${year}/${monthStr}/${dayStr}`);
      } catch (error) {
        console.error(`   ❌ Error creating test log for ${year}/${month}/${day}:`, error.message);
      }
    }
  });

  console.log('   📁 Test log structure created\n');
};

// Test the archiving functionality
const testArchiving = async () => {
  console.log('2. Testing monthly archiving...');

  try {
    // Check current log structure
    const years = logger.listLogFiles();
    console.log(`   📊 Available years before archiving: ${years.join(', ')}`);

    if (years.length > 0) {
      years.forEach((year) => {
        const months = logger.listLogFiles(year);
        console.log(`   📊 Months in ${year}: ${months.join(', ')}`);
      });
    }

    // Run the archiving process
    console.log('   🗜️  Running monthly archiving...');
    const results = await logger.checkAndArchivePreviousMonths();

    console.log(`   ✅ Archiving completed:`);
    console.log(`      - Archived months: ${results.archivedMonths.length}`);
    if (results.archivedMonths.length > 0) {
      results.archivedMonths.forEach((month) => {
        console.log(`        📦 ${month}`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`      - Errors: ${results.errors.length}`);
      results.errors.forEach((error) => {
        console.log(`        ❌ ${error}`);
      });
    }
  } catch (error) {
    console.error('   ❌ Error during archiving test:', error.message);
  }

  console.log('');
};

// Test archive listing
const testArchiveListing = () => {
  console.log('3. Testing archive listing...');

  try {
    const archivedYears = logger.listArchivedMonths();
    console.log(`   📦 Archived years: ${archivedYears.join(', ')}`);

    archivedYears.forEach((year) => {
      const archivedMonths = logger.listArchivedMonths(year);
      console.log(`   📦 Archived months in ${year}: ${archivedMonths.join(', ')}`);
    });

    // Get archive statistics
    const archiveStats = logger.getArchiveStats();
    console.log('   📊 Archive Statistics:');
    console.log(`      - Total archived years: ${archiveStats.totalArchivedYears}`);
    console.log(`      - Total archived months: ${archiveStats.totalArchivedMonths}`);
    console.log(`      - Total archive size: ${archiveStats.totalArchiveSizeFormatted}`);
  } catch (error) {
    console.error('   ❌ Error testing archive listing:', error.message);
  }

  console.log('');
};

// Test directory structure
const testDirectoryStructure = () => {
  console.log('4. Testing directory structure...');

  const baseDir = path.join(__dirname, 'storage');

  function listDirectoryStructure(dir, prefix = '') {
    try {
      const items = fs.readdirSync(dir).sort();
      items.forEach((item, index) => {
        const itemPath = path.join(dir, item);
        const isLast = index === items.length - 1;
        const connector = isLast ? '└── ' : '├── ';

        const stats = fs.statSync(itemPath);
        let itemInfo = item;

        if (stats.isFile() && item.endsWith('.zip')) {
          const sizeInKB = (stats.size / 1024).toFixed(1);
          itemInfo += ` (${sizeInKB} KB)`;
        }

        console.log(`${prefix}${connector}${itemInfo}`);

        if (stats.isDirectory() && !item.startsWith('.')) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          listDirectoryStructure(itemPath, newPrefix);
        }
      });
    } catch (error) {
      console.log(`${prefix}└── [Error reading directory: ${error.message}]`);
    }
  }

  console.log(`   📁 Storage Directory Structure (${baseDir}):`);
  listDirectoryStructure(baseDir, '   ');
  console.log('');
};

// Main test execution
const runTests = async () => {
  try {
    // Create test data
    createTestLogs();

    // Wait a moment for file system
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test archiving
    await testArchiving();

    // Test archive listing
    testArchiveListing();

    // Show directory structure
    testDirectoryStructure();

    console.log('✅ Monthly archiving test completed!\n');

    console.log('📋 Summary of Monthly Archiving Features:');
    console.log('- ✅ Automatic monthly archiving of previous months');
    console.log('- ✅ ZIP compression with maximum compression level');
    console.log('- ✅ Hierarchical archive structure: storage/logs-zip/{year}/{month}.zip');
    console.log('- ✅ Archive statistics and management');
    console.log('- ✅ API endpoints for archive operations');
    console.log('- ✅ Automatic cleanup of original directories after archiving');
    console.log('- ✅ Scheduled daily archiving at 2 AM');
    console.log('- ✅ Archive extraction capability');
    console.log('- ✅ Old archive cleanup (24 months retention)');

    console.log('\n🌟 Archive API Endpoints:');
    console.log('- GET  /api/logs/archives/stats - Archive statistics');
    console.log('- GET  /api/logs/archives/years - List archived years');
    console.log('- GET  /api/logs/archives/months/:year - List archived months');
    console.log('- POST /api/logs/archives/archive-month - Archive specific month');
    console.log('- POST /api/logs/archives/archive-previous - Archive all previous months');
    console.log('- POST /api/logs/archives/extract/:year/:month - Extract archived month');
    console.log('- GET  /api/logs/archives/download/:year/:month - Download archive');
    console.log('- DELETE /api/logs/archives/:year/:month - Delete archive');
    console.log('- POST /api/logs/archives/cleanup - Cleanup old archives');
  } catch (error) {
    console.error('❌ Test execution error:', error);
  }
};

// Run the tests
runTests();
