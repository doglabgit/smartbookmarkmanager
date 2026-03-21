/**
 * Reset test database script
 *
 * Usage: node scripts/reset-test-db.js
 *
 * This will:
 * 1. Connect to test database (DATABASE_URL_TEST or derived from DATABASE_URL)
 * 2. Truncate all tables
 * 3. Run Prisma migrations to ensure schema is up to date
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const getTestDbUrl = () => {
  const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set');
  }
  if (!process.env.DATABASE_URL_TEST) {
    const url = new URL(baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
    return url.toString();
  }
  return baseUrl;
};

async function resetTestDb() {
  console.log('Resetting test database...');

  // Set DATABASE_URL to test DB for prisma migrate
  process.env.DATABASE_URL = getTestDbUrl();

  // Run prisma migrate reset
  console.log('Running prisma migrate reset...');
  execSync('npx prisma migrate reset --force', {
    cwd: __dirname + '/../', // project root for api
    stdio: 'inherit'
  });

  console.log('✅ Test database reset complete');
}

resetTestDb().catch(error => {
  console.error('❌ Failed to reset test database:', error);
  process.exit(1);
});
