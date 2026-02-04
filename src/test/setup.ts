// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = "test";
});

// Increase timeout for database operations
jest.setTimeout(30000);
