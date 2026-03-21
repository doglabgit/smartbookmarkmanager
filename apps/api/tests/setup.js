/**
 * Jest test setup and teardown
 *
 * Handles:
 * - Database isolation (dedicated test DB)
 * - Global afterEach cleanup (prisma.$disconnect)
 */

const { PrismaClient } = require('@prisma/client');

// Create a Prisma client for tests using DATABASE_URL_TEST or fallback to DATABASE_URL with _test suffix
const getTestDbUrl = () => {
  const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set');
  }
  // If using a named database, append _test to avoid collisions
  if (!process.env.DATABASE_URL_TEST) {
    const url = new URL(baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
    return url.toString();
  }
  return baseUrl;
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getTestDbUrl()
    }
  }
});

// Make prisma available in tests via global
global.__TEST_PRISMA__ = prisma;

// Global afterEach to clean up data between test files
afterEach(async () => {
  // Optionally clean specific tables if needed
  // Currently we reset the whole DB between test runs (see jest --resetDB script)
});

// Global afterAll to disconnect
afterAll(async () => {
  await prisma.$disconnect();
});

// Helper to reset the entire test database (truncate all tables)
global.resetTestDatabase = async () => {
  const schema = process.env.DATABASE_URL?.split('/').pop() || 'public';
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_type = 'BASE TABLE'
  `;

  // Disable triggers temporarily for truncate
  await prisma.$executeRaw`SET session_replication_role = 'replica'`;

  for (const { table_name } of tables) {
    try {
      await prisma.$executeRaw`TRUNCATE TABLE ${table_name} RESTART IDENTITY CASCADE`;
    } catch (error) {
      // Ignore errors for tables that can't be truncated
      console.warn(`Could not truncate ${table_name}:`, error.message);
    }
  }

  await prisma.$executeRaw`SET session_replication_role = 'origin'`;
};

// Hook to reset DB before all tests if needed
beforeAll(async () => {
  // Ensure we're using a test database and it's migratable
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Connected to test database: ${getTestDbUrl()}`);
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});
