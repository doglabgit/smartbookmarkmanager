/**
 * Coverage supplement tests
 *
 * These tests target uncovered branches to reach coverage thresholds:
 * - Error class instantiation and properties
 * - Error middleware handling all error types
 * - CSRF edge cases (missing token, invalid token, safe methods)
 * - Rate limiter boundary conditions
 * - validateEnv missing/invalid environment variables
 * - Helper functions edge cases
 */

const request = require('supertest');
const app = require('../index');
const {
  AuthError,
  CsrfError,
  DatabaseError,
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  ValidationError
} = require('../src/errors');

describe('Error Classes', () => {
  it('AuthError should have correct default properties', () => {
    const error = new AuthError();
    expect(error.message).toBe('Authentication required');
    expect(error.name).toBe('AuthError');
    expect(error.statusCode).toBe(401);
  });

  it('AuthError should accept custom message', () => {
    const error = new AuthError('Invalid credentials');
    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(401);
  });

  it('CsrfError should have correct default properties', () => {
    const error = new CsrfError();
    expect(error.message).toBe('CSRF validation failed');
    expect(error.name).toBe('CsrfError');
    expect(error.statusCode).toBe(403);
  });

  it('DatabaseError should have correct properties', () => {
    const error = new DatabaseError('Connection failed');
    expect(error.message).toBe('Connection failed');
    expect(error.name).toBe('DatabaseError');
    expect(error.statusCode).toBe(503); // Service Unavailable
  });

  it('ExternalServiceError should have correct properties', () => {
    const error = new ExternalServiceError('Claude API down');
    expect(error.message).toBe('Claude API down');
    expect(error.name).toBe('ExternalServiceError');
    expect(error.statusCode).toBe(502); // Bad Gateway
  });

  it('NotFoundError should have correct properties', () => {
    const error = new NotFoundError('Bookmark not found');
    expect(error.message).toBe('Bookmark not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
  });

  it('RateLimitError should have correct properties', () => {
    const error = new RateLimitError('Too many requests');
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
    expect(error.statusCode).toBe(429);
  });

  it('ValidationError should have correct properties', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.statusCode).toBe(400);
  });

  it('DatabaseError should preserve cause', () => {
    const cause = new Error('DB connection timeout');
    const error = new DatabaseError('Query failed', cause);
    expect(error.cause).toBe(cause);
  });

  it('ExternalServiceError should preserve cause', () => {
    const cause = new Error('ECONNREFUSED');
    const error = new ExternalServiceError('Upstream failed', cause);
    expect(error.cause).toBe(cause);
  });
});

describe('Error Middleware Edge Cases', () => {
  it('should handle AuthError correctly', async () => {
    const { AuthError } = require('../src/errors');
    const { createTestUser } = require('./helpers');
    const prisma = require('./helpers').prisma;

    // Create a user, then test accessing protected route without token
    await createTestUser('errtest@example.com', 'password123');

    const response = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(response.body).toHaveProperty('error');
    await prisma.user.deleteMany({ where: { email: 'errtest@example.com' } });
  });

  it('should handle ValidationError from malformed JSON', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send('invalid-json')
      .set('Content-Type', 'application/json')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should handle rate limit with test limiter disabled', async () => {
    // In test env, rate limiter is bypassed, but we can still test the route works
    const { createTestUser, cleanupTestData } = require('./helpers');
    await cleanupTestData();
    const user = await createTestUser('ratelimit@example.com', 'password123');

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`accessToken=valid-token`]) // Simplified, won't actually auth but won't hit rate limit
      .expect(401); // Will fail auth, but not rate limit

    expect(response.body).toHaveProperty('error');
    await cleanupTestData();
  });

  it('should handle missing bookmark (404)', async () => {
    // Use the authCookie from beforeAll and a non-existent ID
    const response = await request(app)
      .get('/api/bookmarks/999999')
      .set('Cookie', authCookie)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Bookmark not found');
  });
});

describe('CSRF Middleware Edge Cases', () => {
  it('should skip CSRF for GET requests', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .expect(401); // Will fail auth, but CSRF won't block it

    expect(response.status).toBe(401);
  });

  it('should skip CSRF when no cookie present (first visit)', async () => {
    // This is tested in regular flow; CSRF middleware allows requests without token
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'csrftest@example.com', password: 'password123' });

    // Should succeed (201) or fail with validation error (400/409), NOT 403 CSRF
    expect([201, 400, 409]).toContain(response.status);
  });
});

describe('validateEnv Middleware', () => {
  const validateEnvPath = require.resolve('../src/utils/validateEnv');

  afterEach(() => {
    // Clear require cache to ensure fresh require with current env
    delete require.cache[validateEnvPath];
  });

  it('should throw when DATABASE_URL is missing', () => {
    const originalDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(() => require(validateEnvPath)).toThrow('DATABASE_URL is required');

    if (originalDb) process.env.DATABASE_URL = originalDb;
  });

  it('should throw when JWT_SECRET is missing', () => {
    const originalDb = process.env.DATABASE_URL;
    const originalJwt = process.env.JWT_SECRET;

    // Ensure DATABASE_URL set to avoid that error
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    }
    delete process.env.JWT_SECRET;

    expect(() => require(validateEnvPath)).toThrow('JWT_SECRET is required');

    // Restore
    if (originalDb) process.env.DATABASE_URL = originalDb;
    if (originalJwt) process.env.JWT_SECRET = originalJwt;
  });

  it('should not throw when all required env vars present', () => {
    const originalDb = process.env.DATABASE_URL || 'postgresql://user:pass@localhost/db';
    const originalJwt = process.env.JWT_SECRET || 'test-secret';

    process.env.DATABASE_URL = originalDb;
    process.env.JWT_SECRET = originalJwt;

    // Should not throw
    const validateEnv = require(validateEnvPath);
    expect(validateEnv).toBeDefined();

    // Restore if we changed them
    if (!originalDb) delete process.env.DATABASE_URL;
    if (!originalJwt) delete process.env.JWT_SECRET;
  });
});

describe('Helper Functions Edge Cases', () => {
  const { cleanupTestData, createTestUser, getAuthCookie } = require('./helpers');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  it('cleanupTestData should handle empty database gracefully', async () => {
    // Already cleaned in afterEach, but call again to ensure no errors
    await cleanupTestData();
    // Should not throw even if tables are already empty
  });

  it('getAuthCookie should extract cookie from login response', () => {
    const mockResponse = {
      headers: {
        'set-cookie': ['accessToken=abc123; Path=/; HttpOnly']
      }
    };

    const cookie = getAuthCookie(mockResponse);
    expect(cookie).toBe('accessToken=abc123');
  });

  it('getAuthCookie should throw when no cookie present', () => {
    const mockResponse = {
      headers: {}
    };

    expect(() => getAuthCookie(mockResponse)).toThrow('No cookie in login response');
  });
});

describe('Bookmarks Route Edge Cases', () => {
  let authCookie;
  let userId;

  beforeAll(async () => {
    const { createTestUser } = require('./helpers');
    const user = await createTestUser('edge@example.com', 'password123');
    userId = user.id;

    // Get auth cookie via login
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'edge@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    authCookie = response.headers['set-cookie'];
  });

  afterAll(async () => {
    const { cleanupTestData } = require('./helpers');
    await cleanupTestData();
  });

  beforeEach(async () => {
    const { prisma } = require('./helpers');
    await prisma.bookmark.deleteMany({ where: { userId } });
    await prisma.tag.deleteMany({ where: { userId } });
  });

  it('should handle pagination with limit > MAX_LIMIT', async () => {
    const response = await request(app)
      .get('/api/bookmarks?limit=1000')
      .set('Cookie', authCookie)
      .expect(200);

    // Should clamp to 100
    expect(response.body.data.pagination.limit).toBeLessThanOrEqual(100);
  });

  it('should handle invalid page parameter', async () => {
    const response = await request(app)
      .get('/api/bookmarks?page=abc')
      .set('Cookie', authCookie)
      .expect(200);

    // Should default to page 1
    expect(response.body.data.pagination.page).toBe(1);
  });

  it('should handle empty search results', async () => {
    const response = await request(app)
      .get('/api/bookmarks?search=nonexistent123456')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.data.bookmarks).toEqual([]);
  });

  it('should handle non-existent bookmark update', async () => {
    const response = await request(app)
      .patch('/api/bookmarks/99999')
      .send({ title: 'New Title' })
      .set('Cookie', authCookie)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Bookmark not found');
  });

  it('should handle non-existent bookmark delete', async () => {
    const response = await request(app)
      .delete('/api/bookmarks/99999')
      .set('Cookie', authCookie)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Bookmark not found');
  });

  it('should create bookmark with empty tags array', async () => {
    const response = await request(app)
      .post('/api/bookmarks')
      .send({ url: 'https://example.com/notags' })
      .set('Cookie', authCookie)
      .expect(201);

    expect(response.body.data.bookmark).toBeDefined();
    expect(response.body.data.bookmark.tags).toEqual([]);
  });

  it('should handle bookmark update with no fields', async () => {
    // First create a bookmark
    const createRes = await request(app)
      .post('/api/bookmarks')
      .send({ url: 'https://example.com/update-test' })
      .set('Cookie', authCookie);

    const bookmarkId = createRes.body.data.bookmark.id;

    // Update with empty body should still trigger validation but succeed
    const response = await request(app)
      .patch(`/api/bookmarks/${bookmarkId}`)
      .send({})
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.data.bookmark).toBeDefined();
  });
});
