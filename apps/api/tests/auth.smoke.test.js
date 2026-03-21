/**
 * Smoke test: Full auth flow
 *
 * Tests: register → login → /me → logout
 *
 * Uses a dedicated test database. Set DATABASE_URL_TEST env var.
 */

const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test user data
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

describe('Auth Smoke Test', () => {
  beforeAll(async () => {
    // Ensure test database is clean
    await prisma.user.deleteMany({
      where: { email: TEST_EMAIL }
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: TEST_EMAIL }
    });
    await prisma.$disconnect();
  });

  test('should register a new user', async () => {
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
  });

  test('should login with existing user', async () => {
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
  });

  test('should get current user with valid cookie', async () => {
    // First login to get cookie
    let res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    // Then access /me with the cookie from login response
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', res.headers['set-cookie'])
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data.user.email).toBe(TEST_EMAIL);
  });

  test('should logout and clear cookie', async () => {
    // Login first
    let res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    // Logout
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', res.headers['set-cookie'])
      .expect(200);

    expect(response.body.data.message).toBe('Logged out');
  });
});
