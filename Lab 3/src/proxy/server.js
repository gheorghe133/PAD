const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("../config/config");
const logger = require("../utils/logger");
const responseFormatter = require("../utils/responseFormatter");

const CacheManager = require("./cache/CacheManager");
const ConnectionManager = require("./connections/ConnectionManager");
const RoundRobinBalancer = require("./loadbalancer/RoundRobinBalancer");

class ReverseProxyServer {
  constructor() {
    this.app = express();
    this.server = null;

    this.cacheManager = new CacheManager();
    this.loadBalancer = new RoundRobinBalancer();
    this.connectionManager = new ConnectionManager();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    this.app.use(helmet(config.security.helmet));
    this.app.use(cors(config.security.cors));
    this.app.use(compression());

    if (config.logging.format) {
      this.app.use(morgan(config.logging.format));
    }

    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    this.app.use((req, res, next) => {
      req.setTimeout(config.proxy.requestTimeout);
      res.setTimeout(config.proxy.requestTimeout);
      next();
    });

    this.app.use((req, res, next) => {
      const connectionId = this.connectionManager.registerConnection(req, res);
      req.connectionId = connectionId;
      next();
    });

    this.app.use((req, res, next) => {
      req.startTime = Date.now();

      const originalSend = res.send;
      res.send = function (data) {
        const responseTime = Date.now() - req.startTime;
        res.set("X-Response-Time", `${responseTime}ms`);
        logger.httpRequest(req, res, responseTime);
        originalSend.call(this, data);
      };

      next();
    });

    logger.info("Proxy middleware setup completed");
  }

  setupRoutes() {
    this.app.get("/proxy/health", (_req, res) => {
      const stats = {
        proxy: {
          status: "healthy",
          uptime: process.uptime(),
          connections: this.connectionManager.getActiveConnectionsCount(),
        },
        cache: this.cacheManager.getStats(),
        loadBalancer: this.loadBalancer.getStats(),
      };

      res.json(stats);
    });

    this.app.get("/proxy/stats", (_req, res) => {
      const stats = {
        cache: this.cacheManager.getStats(),
        loadBalancer: this.loadBalancer.getStats(),
        connections: this.connectionManager.getStats(),
        connectionPools: this.connectionManager.getPoolStats(),
      };

      res.json(stats);
    });

    this.app.delete("/proxy/cache", (_req, res) => {
      this.cacheManager.clear();
      res.json({ success: true, message: "Cache cleared" });
    });

    this.app.delete("/proxy/cache/:pattern", (req, res) => {
      const { pattern } = req.params;
      const invalidatedCount = this.cacheManager.invalidatePattern(pattern);
      res.json({
        success: true,
        message: `Cache invalidated`,
        invalidatedCount,
      });
    });

    this.app.use("*", this.handleProxyRequest.bind(this));

    logger.info("Proxy routes setup completed");
  }

  async handleProxyRequest(req, res) {
    try {
      this.connectionManager.updateConnectionActivity(req.connectionId);

      const cacheKey = this.cacheManager.generateKey(req);

      if (this.cacheManager.isCacheable(req)) {
        const cachedResponse = this.cacheManager.get(cacheKey);

        if (cachedResponse) {
          res.set("X-Proxy-Cache", "HIT");
          res.set(
            "X-Cache-Age",
            Math.floor((Date.now() - cachedResponse.timestamp) / 1000)
          );
          res.status(cachedResponse.statusCode);

          if (cachedResponse.headers) {
            Object.keys(cachedResponse.headers).forEach((header) => {
              res.set(header, cachedResponse.headers[header]);
            });
          }

          res.send(cachedResponse.data);

          logger.info("Request served from cache", {
            method: req.method,
            url: req.originalUrl,
            cacheKey,
          });

          return;
        }
      }

      const response = await this.loadBalancer.forwardRequest(req, res);

      this.connectionManager.updateConnectionPool(
        response.serverUrl || "unknown",
        response.statusCode < 400,
        response.responseTime
      );

      if (
        this.cacheManager.isCacheable(req) &&
        this.cacheManager.isResponseCacheable({
          statusCode: response.statusCode,
          headers: response.headers,
        })
      ) {
        this.cacheManager.set(cacheKey, {
          statusCode: response.statusCode,
          headers: response.headers,
          data: response.data,
        });

        res.set("X-Proxy-Cache", "MISS");
      } else {
        res.set("X-Proxy-Cache", "SKIP");
      }

      res.status(response.statusCode);
      res.send(response.data);
    } catch (error) {
      this.handleProxyError(req, res, error);
    }
  }

  handleProxyError(req, res, error) {
    logger.errorWithStack(error, {
      method: req.method,
      url: req.originalUrl,
      connectionId: req.connectionId,
    });

    const statusCode = error.response?.status || 502;
    const errorResponse = responseFormatter.error(
      "Proxy error: Unable to reach backend servers",
      statusCode,
      {
        originalError: config.isDevelopment ? error.message : undefined,
        timestamp: new Date().toISOString(),
      }
    );

    const formatted = responseFormatter.format(
      errorResponse,
      req.get("Accept")
    );

    res.set("Content-Type", formatted.contentType);
    res.set("X-Proxy-Cache", "ERROR");
    res.status(statusCode).send(formatted.data);
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      const errorResponse = responseFormatter.error(
        "Proxy endpoint not found",
        404,
        { path: req.path, method: req.method }
      );

      const formatted = responseFormatter.format(
        errorResponse,
        req.get("Accept")
      );
      res.set("Content-Type", formatted.contentType);
      res.status(404).send(formatted.data);
    });

    this.app.use((error, req, res, _next) => {
      logger.errorWithStack(error, {
        method: req.method,
        url: req.url,
        connectionId: req.connectionId,
      });

      const errorResponse = responseFormatter.error(
        config.isDevelopment ? error.message : "Internal proxy error",
        500,
        { connectionId: req.connectionId }
      );

      const formatted = responseFormatter.format(
        errorResponse,
        req.get("Accept")
      );
      res.set("Content-Type", formatted.contentType);
      res.status(500).send(formatted.data);
    });

    logger.info("Proxy error handling setup completed");
  }

  async start(port = config.proxy.port, host = config.proxy.host) {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          logger.info("Reverse Proxy Server started", {
            port,
            host,
            env: config.env,
            pid: process.pid,
            backendServers: this.loadBalancer.getStats().totalServers,
          });
          resolve();
        });

        this.server.on("error", (error) => {
          logger.error("Proxy server error", { error: error.message });
          reject(error);
        });

        process.on("SIGTERM", () => this.shutdown("SIGTERM"));
        process.on("SIGINT", () => this.shutdown("SIGINT"));
      } catch (error) {
        logger.error("Failed to start proxy server", { error: error.message });
        reject(error);
      }
    });
  }

  async shutdown(signal = "SHUTDOWN") {
    logger.info("Shutting down Reverse Proxy Server", { signal });

    return new Promise((resolve) => {
      if (this.cacheManager) {
        this.cacheManager.destroy();
      }

      if (this.loadBalancer) {
        this.loadBalancer.destroy();
      }

      if (this.connectionManager) {
        this.connectionManager.destroy();
      }

      if (this.server) {
        this.server.close(() => {
          logger.info("Reverse Proxy Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp() {
    return this.app;
  }

  getComponents() {
    return {
      cacheManager: this.cacheManager,
      loadBalancer: this.loadBalancer,
      connectionManager: this.connectionManager,
    };
  }
}

if (require.main === module) {
  const proxyServer = new ReverseProxyServer();

  proxyServer
    .start()
    .then(() => {
      logger.info("Reverse Proxy Server is ready to accept connections");
    })
    .catch((error) => {
      logger.error("Failed to start Reverse Proxy Server", {
        error: error.message,
      });
      process.exit(1);
    });
}

module.exports = ReverseProxyServer;
