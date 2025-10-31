const axios = require("axios");
const http = require("http");
const https = require("https");

const config = require("../../config/config");
const logger = require("../../utils/logger");

const axiosInstance = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  validateStatus: () => true,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: 50,
  }),
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: 50,
  }),
});

class RoundRobinBalancer {
  constructor(servers = config.warehouseServers) {
    this.servers = servers.map((server) => {
      const protocol = server.port === 443 ? "https" : "http";
      const portSuffix =
        (protocol === "https" && server.port === 443) ||
        (protocol === "http" && server.port === 80)
          ? ""
          : `:${server.port}`;
      return {
        ...server,
        url: `${protocol}://${server.host}${portSuffix}`,
        isHealthy: true,
        lastHealthCheck: null,
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
      };
    });

    this.currentIndex = 0;
    this.healthCheckInterval = null;

    this.startHealthChecks();

    logger.info("Round-Robin Load Balancer initialized", {
      serverCount: this.servers.length,
      servers: this.servers.map((s) => s.url),
    });
  }

  getNextServer() {
    const healthyServers = this.servers.filter((server) => server.isHealthy);

    if (healthyServers.length === 0) {
      logger.error("No healthy servers available");
      return null;
    }

    let attempts = 0;
    while (attempts < this.servers.length) {
      const server = this.servers[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.servers.length;

      if (server.isHealthy) {
        logger.debug("Selected server for request", {
          url: server.url,
          totalRequests: server.totalRequests,
        });
        return server;
      }

      attempts++;
    }

    const fallbackServer = healthyServers[0];
    logger.warn("Using fallback server", { url: fallbackServer.url });
    return fallbackServer;
  }

  async forwardRequest(req, res) {
    const server = this.getNextServer();

    if (!server) {
      throw new Error("No healthy servers available");
    }

    const startTime = Date.now();

    try {
      const requestConfig = {
        method: req.method,
        url: `${server.url}${req.originalUrl || req.url}`,
        headers: this.prepareHeaders(req),
      };

      if (req.method !== "GET" && req.body) {
        requestConfig.data = req.body;
      }

      logger.debug("Forwarding request", {
        method: req.method,
        url: requestConfig.url,
        serverUrl: server.url,
      });

      const response = await axiosInstance(requestConfig);
      const responseTime = Date.now() - startTime;

      this.updateServerStats(server, true, responseTime);
      this.forwardResponseHeaders(response, res);

      logger.info("Request forwarded successfully", {
        method: req.method,
        url: requestConfig.url,
        statusCode: response.status,
        responseTime: `${responseTime}ms`,
      });

      return {
        statusCode: response.status,
        headers: response.headers,
        data: response.data,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.updateServerStats(server, false, responseTime);

      if (server.consecutiveFailures >= config.loadBalancer.maxRetries) {
        server.isHealthy = false;
        logger.warn("Server marked as unhealthy", {
          url: server.url,
          consecutiveFailures: server.consecutiveFailures,
        });
      }

      logger.error("Request forwarding failed", {
        method: req.method,
        url: `${server.url}${req.originalUrl || req.url}`,
        error: error.message,
        errorCode: error.code,
        errorResponse: error.response?.status,
        responseTime: `${responseTime}ms`,
      });

      throw error;
    }
  }

  prepareHeaders(req) {
    const headers = { ...req.headers };

    const hopByHopHeaders = [
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailers",
      "transfer-encoding",
      "upgrade",
    ];

    hopByHopHeaders.forEach((header) => {
      delete headers[header];
    });

    headers["x-forwarded-for"] = req.ip;
    headers["x-forwarded-proto"] = req.protocol;
    headers["x-forwarded-host"] = req.get("host");
    headers["x-proxy-by"] = "web-proxy-lab";

    return headers;
  }

  forwardResponseHeaders(response, res) {
    const hopByHopHeaders = [
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailers",
      "transfer-encoding",
      "upgrade",
    ];

    Object.keys(response.headers).forEach((header) => {
      if (!hopByHopHeaders.includes(header.toLowerCase())) {
        res.set(header, response.headers[header]);
      }
    });

    res.set("x-proxy-cache", "MISS");
    res.set("x-proxy-server", response.config.url);
  }

  updateServerStats(server, success, responseTime) {
    server.totalRequests++;

    if (success) {
      server.successfulRequests++;
      server.consecutiveFailures = 0;

      const totalResponseTime =
        server.averageResponseTime * (server.successfulRequests - 1);
      server.averageResponseTime =
        (totalResponseTime + responseTime) / server.successfulRequests;
    } else {
      server.consecutiveFailures++;
    }
  }

  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, config.loadBalancer.healthCheckInterval);

    logger.info("Health check monitoring started", {
      interval: config.loadBalancer.healthCheckInterval,
    });
  }

  async performHealthChecks() {
    const healthCheckPromises = this.servers.map((server) =>
      this.checkServerHealth(server)
    );
    await Promise.allSettled(healthCheckPromises);
  }

  async checkServerHealth(server) {
    try {
      const response = await axiosInstance.get(`${server.url}/health`, {
        timeout: config.loadBalancer.healthCheckTimeout,
      });

      const wasUnhealthy = !server.isHealthy;
      server.isHealthy = response.status === 200;
      server.lastHealthCheck = new Date().toISOString();

      if (wasUnhealthy && server.isHealthy) {
        server.consecutiveFailures = 0;
        logger.info("Server recovered", { url: server.url });
      }
    } catch (error) {
      const wasHealthy = server.isHealthy;
      server.isHealthy = false;
      server.lastHealthCheck = new Date().toISOString();

      if (wasHealthy) {
        logger.warn("Server health check failed", {
          url: server.url,
          error: error.message,
          errorCode: error.code,
        });
      }
    }
  }

  getStats() {
    const healthyServers = this.servers.filter((s) => s.isHealthy).length;
    const totalRequests = this.servers.reduce(
      (sum, s) => sum + s.totalRequests,
      0
    );
    const totalSuccessful = this.servers.reduce(
      (sum, s) => sum + s.successfulRequests,
      0
    );

    return {
      totalServers: this.servers.length,
      healthyServers,
      unhealthyServers: this.servers.length - healthyServers,
      totalRequests,
      successfulRequests: totalSuccessful,
      successRate: totalRequests > 0 ? totalSuccessful / totalRequests : 0,
      servers: this.servers.map((server) => ({
        url: server.url,
        isHealthy: server.isHealthy,
        totalRequests: server.totalRequests,
        successfulRequests: server.successfulRequests,
        consecutiveFailures: server.consecutiveFailures,
        averageResponseTime: Math.round(server.averageResponseTime),
        lastHealthCheck: server.lastHealthCheck,
      })),
    };
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info("Health check monitoring stopped");
    }
  }

  destroy() {
    this.stopHealthChecks();
    logger.info("Round-Robin Load Balancer destroyed");
  }
}

module.exports = RoundRobinBalancer;
