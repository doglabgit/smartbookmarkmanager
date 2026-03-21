require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./src/logger'); // Initialize logger first
const { validateEnvironment } = require('./src/utils/validateEnv');
const authMiddleware = require('./src/middleware/auth');
const errorMiddleware = require('./src/middleware/errorMiddleware');
const requestIdMiddleware = require('./src/middleware/requestId');
const { csrfProtect } = require('./src/middleware/csrf');
const { metricsMiddleware, metricsEndpoint } = require('./src/metrics');
const prisma = require('./src/database');

// Validate environment on startup (fail fast) — after logger is ready
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(cookieParser());
app.use(bodyParser.json({ limit: '100kb' })); // Request body size limit

// CORS: Allow specific origins (set ALLOWED_ORIGINS env var, comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3001', 'http://127.0.0.1:3001']; // Default to Next.js dev server

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline for Next.js hydration; tighten in prod if possible
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline for Tailwind
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"], // API calls via same-origin (proxied through Next.js)
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// Request ID must be early to capture all downstream activity
app.use(requestIdMiddleware);

// CSRF protection on state-changing requests
app.use(csrfProtect);

// Metrics collection (before routes so all requests are captured)
app.use(metricsMiddleware);

// Health check endpoint
app.get('/healthz', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({ status: 'error', error: 'Database unreachable' });
  }
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/bookmarks', authMiddleware, require('./src/routes/bookmarks'));

// Metrics endpoint (Prometheus format)
app.get('/metrics', metricsEndpoint);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler (must be after all routes)
app.use(errorMiddleware);

// Start server only if this is the main module (not required as a module for testing)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
  });

  // Close prisma on exit
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Export app for testing
module.exports = app;
