// Set test environment variables
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.CACHE_TTL = "1";
process.env.CACHE_CHECK_PERIOD = "1";

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
