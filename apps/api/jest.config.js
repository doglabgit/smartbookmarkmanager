/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverage: false, // Will enable after baseline tests exist
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/../.next/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

module.exports = config;
