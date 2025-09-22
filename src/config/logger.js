const path = require('path');
const fs = require('fs');
const DailyRotateFile = require('winston-daily-rotate-file');
const winston = require('winston');
const config = require('./config');

// Try to import archiver, fall back to basic functionality if not available
let archiver;
let unzipper;
try {
  archiver = require('archiver');
  unzipper = require('unzipper');
} catch (error) {
  console.warn('archiver/unzipper packages not found. Archive functionality will use basic compression.');
}

/**
 * Create hierarchical log directory structure
 * @param {Date} date - Date for which to create directory structure
 * @returns {string} - Path to the log directory for the given date
 */
const createLogDirectoryStructure = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const baseLogDir = path.join(__dirname, '../../storage/logs');
  const yearDir = path.join(baseLogDir, String(year));
  const monthDir = path.join(yearDir, month);
  const dayDir = path.join(monthDir, day);

  try {
    if (!fs.existsSync(baseLogDir)) {
      fs.mkdirSync(baseLogDir, { recursive: true });
    }
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating log directories:', error);
    return baseLogDir;
  }

  return dayDir;
};

/**
 * Generate log filename with date
 * @param {Date} date - Date for the log file
 * @returns {string} - Formatted filename (DD-MM-YYYY.log)
 */
const generateLogFilename = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}.log`;
};

/**
 * Create archive directory structure
 * @returns {string} - Path to the archive directory
 */
const createArchiveDirectoryStructure = () => {
  const baseArchiveDir = path.join(__dirname, '../../storage/logs-zip');
  
  try {
    if (!fs.existsSync(baseArchiveDir)) {
      fs.mkdirSync(baseArchiveDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating archive directory:', error);
  }
  
  return baseArchiveDir;
};

/**
 * Archive a completed month to zip file
 * @param {number} year - Year of the month to archive
 * @param {number} month - Month to archive (1-12)
 * @returns {Promise<boolean>} - Success status
 */
const archiveMonth = async (year, month) => {
  return new Promise((resolve, reject) => {
    const baseLogDir = path.join(__dirname, '../../storage/logs');
    const archiveDir = createArchiveDirectoryStructure();
    
    const monthStr = String(month).padStart(2, '0');
    const sourceDir = path.join(baseLogDir, String(year), monthStr);
    const archiveYearDir = path.join(archiveDir, String(year));
    
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      console.log(`No logs found for ${year}/${monthStr} to archive`);
      return resolve(false);
    }
    
    // Create archive year directory
    try {
      if (!fs.existsSync(archiveYearDir)) {
        fs.mkdirSync(archiveYearDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating archive year directory:', error);
      return reject(error);
    }
    
    if (archiver) {
      // Use archiver if available
      const archiveFile = path.join(archiveYearDir, `${monthStr}.zip`);
      const output = fs.createWriteStream(archiveFile);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });
      
      output.on('close', () => {
        const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log(`✅ Archived ${year}/${monthStr} to ${archiveFile} (${sizeInMB} MB)`);
        
        // Remove the original directory after successful archiving
        try {
          fs.rmSync(sourceDir, { recursive: true, force: true });
          console.log(`🗑️  Removed original directory: ${sourceDir}`);
          resolve(true);
        } catch (error) {
          console.error('Error removing original directory:', error);
          resolve(true); // Archive was successful even if cleanup failed
        }
      });
      
      output.on('error', (error) => {
        console.error('Error writing archive file:', error);
        reject(error);
      });
      
      archive.on('error', (error) => {
        console.error('Error creating archive:', error);
        reject(error);
      });
      
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    } else {
      // Fallback: Move directory to archive location without compression
      const archiveFile = path.join(archiveYearDir, monthStr);
      
      try {
        // Copy directory to archive location
        fs.cpSync(sourceDir, archiveFile, { recursive: true });
        
        // Remove original directory
        fs.rmSync(sourceDir, { recursive: true, force: true });
        
        console.log(`✅ Moved ${year}/${monthStr} to archive (no compression available)`);
        console.log(`🗑️  Removed original directory: ${sourceDir}`);
        resolve(true);
      } catch (error) {
        console.error('Error archiving month:', error);
        reject(error);
      }
    }
  });
};

/**
 * Check and archive previous months
 * @returns {Promise<Object>} - Archive results
 */
const checkAndArchivePreviousMonths = async () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  
  const results = {
    archivedMonths: [],
    errors: []
  };
  
  try {
    const years = logger.listLogFiles();
    
    for (const year of years) {
      const yearNum = parseInt(year);
      const months = logger.listLogFiles(year);
      
      for (const month of months) {
        const monthNum = parseInt(month);
        
        // Archive if it's a previous month (not current month)
        const shouldArchive = (yearNum < currentYear) || 
                             (yearNum === currentYear && monthNum < currentMonth);
        
        if (shouldArchive) {
          try {
            const archived = await archiveMonth(yearNum, monthNum);
            if (archived) {
              results.archivedMonths.push(`${yearNum}/${String(monthNum).padStart(2, '0')}`);
            }
          } catch (error) {
            console.error(`Error archiving ${yearNum}/${month}:`, error);
            results.errors.push(`${yearNum}/${month}: ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during monthly archiving:', error);
    results.errors.push(`General error: ${error.message}`);
  }
  
  return results;
};

/**
 * Extract archived month
 * @param {number} year - Year of the archived month
 * @param {number} month - Month to extract (1-12)
 * @returns {Promise<boolean>} - Success status
 */
const extractArchivedMonth = async (year, month) => {
  return new Promise((resolve, reject) => {
    const baseLogDir = path.join(__dirname, '../../storage/logs');
    const archiveDir = path.join(__dirname, '../../storage/logs-zip');
    
    const monthStr = String(month).padStart(2, '0');
    const zipFile = path.join(archiveDir, String(year), `${monthStr}.zip`);
    const dirArchive = path.join(archiveDir, String(year), monthStr);
    const extractDir = path.join(baseLogDir, String(year));
    
    // Check if zip file exists
    if (fs.existsSync(zipFile) && unzipper) {
      // Extract from zip file
      try {
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        
        fs.createReadStream(zipFile)
          .pipe(unzipper.Extract({ path: extractDir }))
          .on('close', () => {
            console.log(`✅ Extracted ${year}/${monthStr} from zip archive`);
            resolve(true);
          })
          .on('error', (error) => {
            console.error('Error extracting zip archive:', error);
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    } else if (fs.existsSync(dirArchive)) {
      // Copy from directory archive
      try {
        const targetDir = path.join(extractDir, monthStr);
        fs.cpSync(dirArchive, targetDir, { recursive: true });
        console.log(`✅ Restored ${year}/${monthStr} from directory archive`);
        resolve(true);
      } catch (error) {
        console.error('Error restoring from directory archive:', error);
        reject(error);
      }
    } else {
      reject(new Error(`Archive not found: ${zipFile} or ${dirArchive}`));
    }
  });
};

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const today = new Date();
const initialLogDir = createLogDirectoryStructure(today);
// const initialLogFile = path.join(initialLogDir, generateLogFilename(today));

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.splat()
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new DailyRotateFile({
      filename: path.join(initialLogDir, '%DATE%.log'),
      datePattern: 'DD-MM-YYYY',
      zippedArchive: false,
      maxSize: '50m',
      maxFiles: '365d',
      format: winston.format.combine(winston.format.uncolorize(), logFormat),
      createSymlink: false,
      symlinkName: null,
      auditFile: path.join(initialLogDir, 'audit.json'),
    }),
  ],
});

const fileTransport = logger.transports.find((t) => t instanceof DailyRotateFile);
if (fileTransport) {
  // const originalGetLogFilePath = fileTransport.getLogFilePath;

  fileTransport.getLogFilePath = function (options) {
    const date = new Date();
    const logDir = createLogDirectoryStructure(date);
    const filename = generateLogFilename(date);
    this.filename = path.join(logDir, '%DATE%.log');
    this.auditFile = path.join(logDir, 'audit.json');

    return path.join(logDir, filename);
  };
}

logger.getLogPath = (date = new Date()) => {
  const logDir = createLogDirectoryStructure(date);
  const filename = generateLogFilename(date);
  return path.join(logDir, filename);
};

logger.getLogDirectory = (date = new Date()) => {
  return createLogDirectoryStructure(date);
};

logger.listLogFiles = (year, month) => {
  const baseLogDir = path.join(__dirname, '../../storage/logs');

  if (!year) {
    try {
      return fs
        .readdirSync(baseLogDir)
        .filter((item) => {
          const yearPath = path.join(baseLogDir, item);
          return fs.statSync(yearPath).isDirectory() && !isNaN(item);
        })
        .sort((a, b) => parseInt(b) - parseInt(a));
    } catch (error) {
      return [];
    }
  }

  if (!month) {
    const yearDir = path.join(baseLogDir, String(year));
    try {
      return fs
        .readdirSync(yearDir)
        .filter((item) => {
          const monthPath = path.join(yearDir, item);
          return fs.statSync(monthPath).isDirectory();
        })
        .sort((a, b) => parseInt(b) - parseInt(a));
    } catch (error) {
      return [];
    }
  }

  const monthDir = path.join(baseLogDir, String(year), String(month).padStart(2, '0'));
  try {
    return fs
      .readdirSync(monthDir)
      .filter((item) => {
        const dayPath = path.join(monthDir, item);
        return fs.statSync(dayPath).isDirectory();
      })
      .sort((a, b) => parseInt(b) - parseInt(a));
  } catch (error) {
    return [];
  }
};

logger.getLogContent = (year, month, day) => {
  const logDir = path.join(
    __dirname,
    '../../storage/logs',
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  );
  const logFile = path.join(logDir, generateLogFilename(new Date(year, month - 1, day)));

  try {
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf8');
    }
    return null;
  } catch (error) {
    logger.error('Error reading log file:', error);
    return null;
  }
};

logger.getLogStats = () => {
  const baseLogDir = path.join(__dirname, '../../storage/logs');
  const stats = {
    totalYears: 0,
    totalMonths: 0,
    totalDays: 0,
    totalLogFiles: 0,
    totalSize: 0,
    oldestLog: null,
    newestLog: null,
    structure: {},
  };

  try {
    const years = logger.listLogFiles();
    stats.totalYears = years.length;

    years.forEach((year) => {
      stats.structure[year] = {};
      const months = logger.listLogFiles(year);
      stats.totalMonths += months.length;

      months.forEach((month) => {
        stats.structure[year][month] = {};
        const days = logger.listLogFiles(year, month);
        stats.totalDays += days.length;

        days.forEach((day) => {
          const dayDir = path.join(baseLogDir, year, month, day);
          const logFiles = [];

          try {
            const files = fs.readdirSync(dayDir).filter((file) => file.endsWith('.log'));
            stats.totalLogFiles += files.length;

            files.forEach((file) => {
              const filePath = path.join(dayDir, file);
              const fileStat = fs.statSync(filePath);
              stats.totalSize += fileStat.size;

              logFiles.push({
                name: file,
                size: fileStat.size,
                created: fileStat.birthtime,
                modified: fileStat.mtime,
              });

              const fileDate = fileStat.mtime;
              if (!stats.oldestLog || fileDate < stats.oldestLog) {
                stats.oldestLog = fileDate;
              }
              if (!stats.newestLog || fileDate > stats.newestLog) {
                stats.newestLog = fileDate;
              }
            });

            stats.structure[year][month][day] = logFiles;
          } catch (error) {
            stats.structure[year][month][day] = [];
          }
        });
      });
    });

    const formatSize = (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    };

    stats.totalSizeFormatted = formatSize(stats.totalSize);
  } catch (error) {
    logger.error('Error getting log stats:', error);
  }

  return stats;
};

logger.cleanupOldLogs = (daysToKeep = 365) => {
  const baseLogDir = path.join(__dirname, '../../storage/logs');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let deletedFiles = 0;
  let deletedDirs = 0;

  try {
    const years = logger.listLogFiles();

    years.forEach((year) => {
      const months = logger.listLogFiles(year);

      months.forEach((month) => {
        const days = logger.listLogFiles(year, month);

        days.forEach((day) => {
          const logDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

          if (logDate < cutoffDate) {
            const dayDir = path.join(baseLogDir, year, month, day);

            try {
              const files = fs.readdirSync(dayDir);
              files.forEach((file) => {
                fs.unlinkSync(path.join(dayDir, file));
                deletedFiles++;
              });

              fs.rmdirSync(dayDir);
              deletedDirs++;
            } catch (error) {
              logger.error(`Error deleting log directory ${dayDir}:`, error);
            }
          }
        });

        const monthDir = path.join(baseLogDir, year, month);
        try {
          const remainingDays = fs.readdirSync(monthDir);
          if (remainingDays.length === 0) {
            fs.rmdirSync(monthDir);
            deletedDirs++;
          }
        } catch (error) {}
      });

      const yearDir = path.join(baseLogDir, year);
      try {
        const remainingMonths = fs.readdirSync(yearDir);
        if (remainingMonths.length === 0) {
          fs.rmdirSync(yearDir);
          deletedDirs++;
        }
      } catch (error) {}
    });
  } catch (error) {
    logger.error('Error during log cleanup:', error);
  }

  logger.info(`Log cleanup completed: ${deletedFiles} files and ${deletedDirs} directories deleted`);
  return { deletedFiles, deletedDirs };
};

// Archive management methods
logger.archiveMonth = archiveMonth;
logger.checkAndArchivePreviousMonths = checkAndArchivePreviousMonths;
logger.extractArchivedMonth = extractArchivedMonth;

logger.listArchivedMonths = (year) => {
  const archiveDir = path.join(__dirname, '../../storage/logs-zip');
  
  if (!year) {
    // List all archived years
    try {
      return fs.readdirSync(archiveDir).filter(item => {
        const yearPath = path.join(archiveDir, item);
        return fs.statSync(yearPath).isDirectory() && !isNaN(item);
      }).sort((a, b) => parseInt(b) - parseInt(a));
    } catch (error) {
      return [];
    }
  }
  
  // List all archived months for the given year
  const yearDir = path.join(archiveDir, String(year));
  try {
    const items = fs.readdirSync(yearDir);
    const months = new Set();
    
    items.forEach(item => {
      if (item.endsWith('.zip')) {
        // ZIP archive
        months.add(item.replace('.zip', ''));
      } else if (fs.statSync(path.join(yearDir, item)).isDirectory() && /^\d{2}$/.test(item)) {
        // Directory archive (2-digit month)
        months.add(item);
      }
    });
    
    return Array.from(months).sort((a, b) => parseInt(b) - parseInt(a));
  } catch (error) {
    return [];
  }
};

logger.getArchiveStats = () => {
  const archiveDir = path.join(__dirname, '../../storage/logs-zip');
  const stats = {
    totalArchivedYears: 0,
    totalArchivedMonths: 0,
    totalArchiveSize: 0,
    archivedMonths: [],
    structure: {}
  };
  
  try {
    const years = logger.listArchivedMonths();
    stats.totalArchivedYears = years.length;
    
    years.forEach(year => {
      stats.structure[year] = [];
      const months = logger.listArchivedMonths(year);
      stats.totalArchivedMonths += months.length;
      
      months.forEach(month => {
        const zipFile = path.join(archiveDir, year, `${month}.zip`);
        const dirArchive = path.join(archiveDir, year, month);
        
        let archiveInfo = null;
        
        try {
          if (fs.existsSync(zipFile)) {
            // ZIP archive
            const fileStat = fs.statSync(zipFile);
            archiveInfo = {
              year: year,
              month: month,
              type: 'zip',
              size: fileStat.size,
              created: fileStat.birthtime,
              modified: fileStat.mtime
            };
          } else if (fs.existsSync(dirArchive)) {
            // Directory archive
            const dirStat = fs.statSync(dirArchive);
            // Calculate directory size
            const getDirSize = (dir) => {
              let size = 0;
              const files = fs.readdirSync(dir);
              files.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                  size += getDirSize(filePath);
                } else {
                  size += stat.size;
                }
              });
              return size;
            };
            
            archiveInfo = {
              year: year,
              month: month,
              type: 'directory',
              size: getDirSize(dirArchive),
              created: dirStat.birthtime,
              modified: dirStat.mtime
            };
          }
          
          if (archiveInfo) {
            stats.totalArchiveSize += archiveInfo.size;
            stats.archivedMonths.push(`${year}/${month}`);
            stats.structure[year].push(archiveInfo);
          }
        } catch (error) {
          // Archive might not exist or be accessible
        }
      });
    });
    
    // Format size
    const formatSize = (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    };
    
    stats.totalArchiveSizeFormatted = formatSize(stats.totalArchiveSize);
  } catch (error) {
    logger.error('Error getting archive stats:', error);
  }
  
  return stats;
};

logger.cleanupOldArchives = (monthsToKeep = 24) => {
  const archiveDir = path.join(__dirname, '../../storage/logs-zip');
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
  
  let deletedArchives = 0;
  
  try {
    const years = logger.listArchivedMonths();
    
    years.forEach(year => {
      const months = logger.listArchivedMonths(year);
      
      months.forEach(month => {
        const archiveDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        
        if (archiveDate < cutoffDate) {
          const archiveFile = path.join(archiveDir, year, `${month}.zip`);
          
          try {
            fs.unlinkSync(archiveFile);
            deletedArchives++;
            logger.info(`Deleted old archive: ${year}/${month}.zip`);
          } catch (error) {
            logger.error(`Error deleting archive ${archiveFile}:`, error);
          }
        }
      });
      
      // Clean up empty year directories
      const yearDir = path.join(archiveDir, year);
      try {
        const remainingArchives = fs.readdirSync(yearDir);
        if (remainingArchives.length === 0) {
          fs.rmdirSync(yearDir);
        }
      } catch (error) {}
    });
  } catch (error) {
    logger.error('Error during archive cleanup:', error);
  }
  
  logger.info(`Archive cleanup completed: ${deletedArchives} archives deleted`);
  return { deletedArchives };
};

// Automatic monthly archiving and cleanup
const performScheduledTasks = async () => {
  try {
    // Archive previous months
    logger.info('Starting scheduled monthly archiving...');
    const archiveResults = await logger.checkAndArchivePreviousMonths();
    
    if (archiveResults.archivedMonths.length > 0) {
      logger.info(`Archived ${archiveResults.archivedMonths.length} months: ${archiveResults.archivedMonths.join(', ')}`);
    }
    
    if (archiveResults.errors.length > 0) {
      logger.error(`Archive errors: ${archiveResults.errors.join('; ')}`);
    }
    
    // Cleanup old daily logs (after archiving)
    logger.cleanupOldLogs(365);
    
    // Cleanup old archives (keep 24 months of archives)
    logger.cleanupOldArchives(24);
    
  } catch (error) {
    logger.error('Error during scheduled tasks:', error);
  }
};

// Run scheduled tasks daily at 2 AM
const scheduleTasksDaily = () => {
  const now = new Date();
  const tomorrow2AM = new Date();
  tomorrow2AM.setDate(now.getDate() + 1);
  tomorrow2AM.setHours(2, 0, 0, 0);
  
  const timeUntil2AM = tomorrow2AM.getTime() - now.getTime();
  
  setTimeout(() => {
    performScheduledTasks();
    // Then run daily
    setInterval(performScheduledTasks, 24 * 60 * 60 * 1000);
  }, timeUntil2AM);
};

// Start scheduled tasks
scheduleTasksDaily();

// Also run archiving on startup (in case we missed some months)
setTimeout(async () => {
  try {
    logger.info('Running initial monthly archiving check...');
    const results = await logger.checkAndArchivePreviousMonths();
    if (results.archivedMonths.length > 0) {
      logger.info(`Initial archiving completed: ${results.archivedMonths.join(', ')}`);
    }
  } catch (error) {
    logger.error('Error during initial archiving:', error);
  }
}, 5000); // Wait 5 seconds after startup

module.exports = logger;
