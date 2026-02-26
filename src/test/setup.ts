/**
 * Global test setup file
 * This file runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Increase test timeout for property-based tests
jest.setTimeout(30000);

// Global test utilities can be added here
