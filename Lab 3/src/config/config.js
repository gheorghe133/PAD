const config = {
  warehouse: {
    port: process.env.PORT || process.env.DW_PORT || 3000,
    host: process.env.DW_HOST || "0.0.0.0",
    requestTimeout: process.env.DW_REQUEST_TIMEOUT || 30000,
  },

  proxy: {
    port: process.env.PORT || process.env.PROXY_PORT || 8080,
    host: process.env.PROXY_HOST || "0.0.0.0",
    maxConnections: process.env.PROXY_MAX_CONNECTIONS || 200,
    requestTimeout: process.env.PROXY_REQUEST_TIMEOUT || 60000,
  },

  cache: {
    defaultTTL: process.env.CACHE_TTL || 300,
    maxSize: process.env.CACHE_MAX_SIZE || 1000,
    checkPeriod: process.env.CACHE_CHECK_PERIOD || 60,
  },

  loadBalancer: {
    healthCheckInterval: process.env.LB_HEALTH_CHECK_INTERVAL || 30000,
    healthCheckTimeout: process.env.LB_HEALTH_CHECK_TIMEOUT || 5000,
    maxRetries: process.env.LB_MAX_RETRIES || 3,
  },

  warehouseServers: process.env.DW_SERVERS
    ? process.env.DW_SERVERS.split(",").map((server) => {
        const [host, port] = server.split(":");
        return { host, port: parseInt(port) || 3000 };
      })
    : [
        { host: "localhost", port: 3000 },
        { host: "localhost", port: 3001 },
        { host: "localhost", port: 3002 },
      ],

  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "combined",
  },

  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: process.env.CORS_CREDENTIALS === "true",
    },
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === "production",
    },
  },

  env: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV !== "production",
};

module.exports = config;
