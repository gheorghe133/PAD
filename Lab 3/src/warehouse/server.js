const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("../config/config");
const logger = require("../utils/logger");

const EmployeeController = require("./controllers/EmployeeController");

class DataWarehouseServer {
  constructor() {
    this.app = express();
    this.employeeController = new EmployeeController();
    this.server = null;

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
      req.setTimeout(config.warehouse.requestTimeout);
      res.setTimeout(config.warehouse.requestTimeout);
      next();
    });

    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      res.set("X-Request-ID", req.requestId);
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

    logger.info("Middleware setup completed");
  }

  setupRoutes() {
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require("../../package.json").version,
      });
    });

    // API info endpoint
    this.app.get("/api/info", (_req, res) => {
      res.json({
        name: "Data Warehouse API",
        version: require("../../package.json").version,
        description: "HTTP API for employee data management",
        endpoints: {
          "GET /employees": "Get all employees (with pagination)",
          "GET /employees/:id": "Get employee by ID",
          "PUT /employees/:id": "Create or update employee",
          "POST /employees": "Create new employee",
          "POST /employees/:id": "Update existing employee",
          "DELETE /employees/:id": "Delete employee",
          "GET /employees/search": "Search employees",
          "GET /employees/stats": "Get employee statistics",
        },
        supportedFormats: ["application/json", "application/xml"],
      });
    });

    // Employee routes
    const router = express.Router();

    router.get(
      "/",
      this.employeeController.getAllEmployees.bind(this.employeeController)
    );
    router.get(
      "/search",
      this.employeeController.searchEmployees.bind(this.employeeController)
    );
    router.get(
      "/stats",
      this.employeeController.getStatistics.bind(this.employeeController)
    );
    router.get(
      "/:id",
      this.employeeController.getEmployeeById.bind(this.employeeController)
    );
    router.put(
      "/:id",
      this.employeeController.updateEmployee.bind(this.employeeController)
    );
    router.post(
      "/",
      this.employeeController.createEmployee.bind(this.employeeController)
    );
    router.post(
      "/:id",
      this.employeeController.updateEmployee.bind(this.employeeController)
    );
    router.delete(
      "/:id",
      this.employeeController.deleteEmployee.bind(this.employeeController)
    );

    this.app.use("/employees", router);

    this.app.get("/", (_req, res) => {
      res.redirect("/api/info");
    });

    logger.info("Routes setup completed");
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          message: "Endpoint not found",
          code: 404,
          path: req.path,
          method: req.method,
        },
        timestamp: new Date().toISOString(),
      });
    });

    this.app.use((error, req, res, _next) => {
      logger.errorWithStack(error, {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
      });

      res.status(500).json({
        success: false,
        error: {
          message: config.isDevelopment
            ? error.message
            : "Internal server error",
          code: 500,
          requestId: req.requestId,
        },
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("Error handling setup completed");
  }

  async start(port = config.warehouse.port, host = config.warehouse.host) {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          logger.info("Data Warehouse Server started", {
            port,
            host,
            env: config.env,
            pid: process.pid,
          });
          resolve();
        });

        this.server.on("error", (error) => {
          logger.error("Server error", { error: error.message });
          reject(error);
        });

        // Handle server shutdown gracefully
        process.on("SIGTERM", () => this.shutdown("SIGTERM"));
        process.on("SIGINT", () => this.shutdown("SIGINT"));
      } catch (error) {
        logger.error("Failed to start server", { error: error.message });
        reject(error);
      }
    });
  }

  async shutdown(signal = "SHUTDOWN") {
    logger.info("Shutting down Data Warehouse Server", { signal });

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info("Data Warehouse Server stopped");
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
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new DataWarehouseServer();

  server
    .start()
    .then(() => {
      logger.info("Data Warehouse Server is ready to accept connections");
    })
    .catch((error) => {
      logger.error("Failed to start Data Warehouse Server", {
        error: error.message,
      });
      process.exit(1);
    });
}

module.exports = DataWarehouseServer;
