const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../../config/logger');

const router = express.Router();

// Log Management API Endpoints
router.get('/stats', (req, res) => {
  try {
    const stats = logger.getLogStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting log stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/years', (req, res) => {
  try {
    const years = logger.listLogFiles();
    res.json({
      success: true,
      data: years,
      count: years.length,
    });
  } catch (error) {
    logger.error('Error listing log years:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/months/:year', (req, res) => {
  try {
    const { year } = req.params;
    const months = logger.listLogFiles(year);
    res.json({
      success: true,
      data: months,
      year: year,
      count: months.length,
    });
  } catch (error) {
    logger.error('Error listing log months:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/days/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const days = logger.listLogFiles(year, month);
    res.json({
      success: true,
      data: days,
      year: year,
      month: month,
      count: days.length,
    });
  } catch (error) {
    logger.error('Error listing log days:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/content/:year/:month/:day', (req, res) => {
  try {
    const { year, month, day } = req.params;
    const content = logger.getLogContent(year, month, day);

    if (content === null) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found',
      });
    }

    res.json({
      success: true,
      data: {
        content: content,
        date: `${day}-${month}-${year}`,
        lines: content.split('\n').length,
      },
    });
  } catch (error) {
    logger.error('Error getting log content:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/download/:year/:month/:day', (req, res) => {
  try {
    const { year, month, day } = req.params;
    const logPath = logger.getLogPath(new Date(year, month - 1, day));

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found',
      });
    }

    const filename = `server-log-${day}-${month}-${year}.log`;
    res.download(logPath, filename, (error) => {
      if (error) {
        logger.error('Error downloading log file:', error);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Error downloading file' });
        }
      }
    });
  } catch (error) {
    logger.error('Error downloading log file:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/cleanup', (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;
    const result = logger.cleanupOldLogs(daysToKeep);

    res.json({
      success: true,
      message: 'Log cleanup completed',
      data: result,
    });
  } catch (error) {
    logger.error('Error during log cleanup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/current', (req, res) => {
  try {
    const today = new Date();
    const currentLogPath = logger.getLogPath(today);
    const currentLogDir = logger.getLogDirectory(today);

    res.json({
      success: true,
      data: {
        currentLogFile: currentLogPath,
        currentLogDirectory: currentLogDir,
        date: today.toISOString().split('T')[0],
        exists: fs.existsSync(currentLogPath),
      },
    });
  } catch (error) {
    logger.error('Error getting current log info:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Archive Management API Endpoints
router.get('/archives/debug/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;

    const zipArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, `${month}.zip`);
    const dirArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, month);
    const archiveDir = path.join(__dirname, '../../../storage/logs-zip', year);

    const debug = {
      requested: { year, month },
      paths: {
        zipArchive: zipArchivePath,
        dirArchive: dirArchivePath,
        yearDir: archiveDir,
      },
      exists: {
        zipArchive: fs.existsSync(zipArchivePath),
        dirArchive: fs.existsSync(dirArchivePath),
        yearDir: fs.existsSync(archiveDir),
      },
      yearDirContents: [],
    };

    if (fs.existsSync(archiveDir)) {
      debug.yearDirContents = fs.readdirSync(archiveDir);
    }

    res.json({
      success: true,
      debug,
    });
  } catch (error) {
    logger.error('Error in debug endpoint:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/archives/stats', (req, res) => {
  try {
    const stats = logger.getArchiveStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting archive stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/archives/years', (req, res) => {
  try {
    const years = logger.listArchivedMonths();
    res.json({
      success: true,
      data: years,
      count: years.length,
    });
  } catch (error) {
    logger.error('Error listing archived years:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/archives/months/:year', (req, res) => {
  try {
    const { year } = req.params;
    const months = logger.listArchivedMonths(year);
    res.json({
      success: true,
      data: months,
      year: year,
      count: months.length,
    });
  } catch (error) {
    logger.error('Error listing archived months:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/archives/archive-month', async (req, res) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: 'Year and month are required',
      });
    }

    const result = await logger.archiveMonth(parseInt(year), parseInt(month));

    res.json({
      success: true,
      message: result ? `Successfully archived ${year}/${month}` : `No logs found for ${year}/${month}`,
      archived: result,
    });
  } catch (error) {
    logger.error('Error archiving month:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/archives/archive-previous', async (req, res) => {
  try {
    const results = await logger.checkAndArchivePreviousMonths();

    res.json({
      success: true,
      message: 'Monthly archiving completed',
      data: results,
    });
  } catch (error) {
    logger.error('Error during monthly archiving:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/archives/extract/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;

    const result = await logger.extractArchivedMonth(parseInt(year), parseInt(month));

    res.json({
      success: true,
      message: `Successfully extracted ${year}/${month} from archive`,
      extracted: result,
    });
  } catch (error) {
    logger.error('Error extracting archive:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/archives/download/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;

    const zipArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, `${month}.zip`);
    const dirArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, month);

    // Check for ZIP archive first
    if (fs.existsSync(zipArchivePath)) {
      const filename = `logs-archive-${month}-${year}.zip`;
      logger.info(`Downloading ZIP archive: ${zipArchivePath}`);

      res.download(zipArchivePath, filename, (error) => {
        if (error) {
          logger.error('Error downloading ZIP archive:', error);
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Error downloading archive' });
          }
        }
      });
    } else if (fs.existsSync(dirArchivePath)) {
      // For directory archives, we need to create a temporary ZIP
      let archiver;
      try {
        archiver = require('archiver');
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Cannot create ZIP from directory archive. Archiver package not available.',
        });
      }

      const filename = `logs-archive-${month}-${year}.zip`;
      logger.info(`Creating ZIP from directory archive: ${dirArchivePath}`);

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (error) => {
        logger.error('Error creating ZIP from directory:', error);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Error creating archive' });
        }
      });

      archive.pipe(res);
      archive.directory(dirArchivePath, false);
      archive.finalize();
    } else {
      logger.warn(`Archive not found: ${zipArchivePath} or ${dirArchivePath}`);
      return res.status(404).json({
        success: false,
        error: 'Archive not found',
      });
    }
  } catch (error) {
    logger.error('Error downloading archive:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/archives/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;

    const zipArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, `${month}.zip`);
    const dirArchivePath = path.join(__dirname, '../../../storage/logs-zip', year, month);

    let deleted = false;
    let deletedType = '';

    // Try to delete ZIP archive first
    if (fs.existsSync(zipArchivePath)) {
      fs.unlinkSync(zipArchivePath);
      logger.info(`Deleted ZIP archive: ${year}/${month}.zip`);
      deleted = true;
      deletedType = 'ZIP';
    }

    // Try to delete directory archive
    if (fs.existsSync(dirArchivePath)) {
      fs.rmSync(dirArchivePath, { recursive: true, force: true });
      logger.info(`Deleted directory archive: ${year}/${month}/`);
      deleted = true;
      deletedType = deleted ? `${deletedType} and directory` : 'directory';
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Archive not found',
      });
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedType.toLowerCase()} archive ${year}/${month}`,
    });
  } catch (error) {
    logger.error('Error deleting archive:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/archives/cleanup', (req, res) => {
  try {
    const { monthsToKeep = 24 } = req.body;
    const result = logger.cleanupOldArchives(monthsToKeep);

    res.json({
      success: true,
      message: 'Archive cleanup completed',
      data: result,
    });
  } catch (error) {
    logger.error('Error during archive cleanup:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
