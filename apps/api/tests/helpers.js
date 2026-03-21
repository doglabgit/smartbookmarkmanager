/**
 * Test helpers for API tests
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

/**
 * Creates a test user and returns the user object with password
 */
async function createTestUser(email = 'test@example.com', password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash
    },
    select: {
      id: true,
      email: true,
      createdAt: true
    }
  });

  return { ...user, password };
}

/**
 * Gets auth cookie from login response for use in subsequent requests
 */
function getAuthCookie(loginResponse) {
  const setCookie = loginResponse.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) {
    throw new Error('No cookie in login response');
  }
  // Return the cookie string (supertest will handle passing it)
  return setCookie[0].split(';')[0];
}

/**
 * Cleans up all test data (users, bookmarks, tags)
 */
async function cleanupTestData() {
  await prisma.bookmark.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = {
  createTestUser,
  getAuthCookie,
  cleanupTestData,
  prisma
};
