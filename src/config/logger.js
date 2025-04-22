const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const winston = require('winston');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

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
      filename: path.join(__dirname, '../../storage/logs/server-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(winston.format.uncolorize(), logFormat),
    }),
  ],
});

module.exports = logger;
