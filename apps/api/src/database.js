const { PrismaClient } = require('@prisma/client');

/**
 * Single shared PrismaClient instance
 *
 * Using a singleton pattern to avoid creating multiple connection pools
 * which would exhaust database connections and cause memory leaks.
 *
 * In production with multiple processes (PM2, Kubernetes, etc.),
 * each process will have its own pool, which is expected and appropriate.
 */
const prisma = new PrismaClient({
  // Connection pool configuration (optional tuning)
  // These defaults are reasonable for most workloads
  datasourceUrl: process.env.DATABASE_URL,
});

module.exports = prisma;
