#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Download Path Resolution\n');

// Simulate the path resolution from src/index.js
const __dirname_simulated = path.join(__dirname, 'src');
console.log('Simulated __dirname (from src/index.js):', __dirname_simulated);

const year = '2025';
const month = '08';

const zipArchivePath = path.join(__dirname_simulated, '../storage/logs-zip', year, `${month}.zip`);
const dirArchivePath = path.join(__dirname_simulated, '../storage/logs-zip', year, month);

console.log('\nPath Resolution:');
console.log('ZIP Archive Path:', zipArchivePath);
console.log('Dir Archive Path:', dirArchivePath);

console.log('\nPath Existence Check:');
console.log('ZIP Archive Exists:', fs.existsSync(zipArchivePath));
console.log('Dir Archive Exists:', fs.existsSync(dirArchivePath));

// Test with actual archives
console.log('\nTesting Available Archives:');
const baseArchiveDir = path.join(__dirname, 'storage/logs-zip');

try {
  const years = fs.readdirSync(baseArchiveDir);
  console.log('Available years:', years);

  years.forEach((yearDir) => {
    const yearPath = path.join(baseArchiveDir, yearDir);
    if (fs.statSync(yearPath).isDirectory()) {
      const archives = fs.readdirSync(yearPath);
      console.log(`Archives in ${yearDir}:`, archives);

      archives.forEach((archive) => {
        const archivePath = path.join(yearPath, archive);
        const stats = fs.statSync(archivePath);
        console.log(`  - ${archive}: ${(stats.size / 1024).toFixed(1)} KB`);
      });
    }
  });
} catch (error) {
  console.error('Error reading archive directory:', error.message);
}

// Test the corrected path
console.log('\nCorrected Path Test:');
const correctZipPath = path.join(__dirname, 'storage/logs-zip', year, `${month}.zip`);
console.log('Correct ZIP Path:', correctZipPath);
console.log('Correct ZIP Exists:', fs.existsSync(correctZipPath));

console.log('\n✅ Path resolution test completed!');
