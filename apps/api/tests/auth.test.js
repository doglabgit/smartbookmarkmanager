/**
 * Auth route tests
 *
 * Covers: register, login, /me, logout, error cases
 */

const request = require('supertest');
const app = require('../index');
const { createTestUser, cleanupTestData } = require('./helpers');

const TEST_EMAIL = 'auth-test@example.com';
const TEST_PASSWORD = 'securepassword123';

describe('Auth Routes', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up after each test to ensure isolation
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        })
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(TEST_EMAIL);
      expect(response.body.data).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 if email missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: TEST_PASSWORD
        })
        .expect(400);

      expect(response.body.error).toBe('Email and password required');
    });

    it('should return 400 if password missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL
        })
        .expect(400);

      expect(response.body.error).toBe('Email and password required');
    });

    it('should return 400 if user already exists', async () => {
      // Create user first
      await createTestUser(TEST_EMAIL, TEST_PASSWORD);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        })
        .expect(400);

      expect(response.body.error).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      await createTestUser(TEST_EMAIL, TEST_PASSWORD);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.user.email).toBe(TEST_EMAIL);
      expect(response.body.data).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_PASSWORD
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 with invalid password', async () => {
      await createTestUser(TEST_EMAIL, TEST_PASSWORD);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 if email missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: TEST_PASSWORD
        })
        .expect(400);

      expect(response.body.error).toBe('Email and password required');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid cookie', async () => {
      await createTestUser(TEST_EMAIL, TEST_PASSWORD);

      // Login to get cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', loginRes.headers['set-cookie'])
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.user.email).toBe(TEST_EMAIL);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['accessToken=invalidtoken'])
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 404 if user deleted after login', async () => {
      const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        });

      // Delete user
      await cleanupTestData();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', loginRes.headers['set-cookie'])
        .expect(404);

      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear cookie and return success', async () => {
      // Create user for this test
      await createTestUser(TEST_EMAIL, TEST_PASSWORD);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD
        });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', loginRes.headers['set-cookie'])
        .expect(200);

      expect(response.body.data.message).toBe('Logged out');
      // Check that Set-Cookie header clears the cookie
      const clearCookie = response.headers['set-cookie']?.[0];
      expect(clearCookie).toContain('accessToken=;');
      expect(clearCookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });
});
