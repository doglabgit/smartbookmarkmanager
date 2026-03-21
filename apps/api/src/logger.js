/**
 * Structured logger using Winston.
 *
 * Features:
 * - JSON format for machine parsing
 * - Daily file rotation (keep 14 days)
 * - Console transport for development
 * - Log level from NODE_ENV (debug in dev, info in prod)
 * - requestId injection via clsc (see requestIdMiddleware)
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const { getRequestId, getUserId } = require('./middleware/requestId');

// Define log level based on environment
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Custom format to inject request context from CLS
const addRequestContext = winston.format((info) => {
  const requestId = getRequestId();
  const userId = getUserId();
  if (requestId) {info.requestId = requestId;}
  if (userId) {info.userId = userId;}
  return info;
});

// Create logger instance
const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    addRequestContext(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'smartbookmark-api'
  },
  transports: [
    // Console transport for development/debugging
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
    }),
    // Daily rotate file transport
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    })
  ]
});

// If in production, also log errors to a separate error file
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error'
  }));
}

// Capture unhandled rejections and exceptions and log them, then exit
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection — exiting', { reason, promise });
  // Also print to stderr directly as backup
  console.error('Unhandled Rejection:', reason);
  setTimeout(() => process.exit(1), 100);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception — exiting', { error });
  // Also print to stderr directly to guarantee we see it
  console.error('Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 100);
});

module.exports = logger;
