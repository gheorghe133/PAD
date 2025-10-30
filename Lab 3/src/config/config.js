/**
 * Configuration settings for the Web Proxy Lab
 */

const config = {
  warehouse: {
    port: process.env.PORT || process.env.DW_PORT || 3000,
    host: process.env.DW_HOST || "0.0.0.0",
    maxConnections: process.env.DW_MAX_CONNECTIONS || 100,
    requestTimeout: process.env.DW_REQUEST_TIMEOUT || 30000,
  },

  proxy: {
    port: process.env.PORT || process.env.PROXY_PORT || 8080,
    host: process.env.PROXY_HOST || "0.0.0.0",
    maxConnections: process.env.PROXY_MAX_CONNECTIONS || 200,
    requestTimeout: process.env.PROXY_REQUEST_TIMEOUT || 60000,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },

  cassandra: {
    contactPoints: process.env.CASSANDRA_HOSTS
      ? process.env.CASSANDRA_HOSTS.split(",")
      : ["localhost"],
    localDataCenter: process.env.CASSANDRA_DC || "datacenter1",
    keyspace: process.env.CASSANDRA_KEYSPACE || "warehouse",
    username: process.env.CASSANDRA_USERNAME || null,
    password: process.env.CASSANDRA_PASSWORD || null,
    socketOptions: {
      connectTimeout: 30000,
      readTimeout: 30000,
    },
  },

  cache: {
    defaultTTL: process.env.CACHE_TTL || 300,
    maxSize: process.env.CACHE_MAX_SIZE || 1000,
    checkPeriod: process.env.CACHE_CHECK_PERIOD || 60,
  },

  loadBalancer: {
    algorithm: process.env.LB_ALGORITHM || "round-robin",
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
    file: process.env.LOG_FILE || null,
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
  isProduction: process.env.NODE_ENV === "production",
};

module.exports = config;
