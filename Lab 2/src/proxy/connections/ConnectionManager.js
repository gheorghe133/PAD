const { v4: uuidv4 } = require("uuid");
const config = require("../../config/config");
const logger = require("../../utils/logger");

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.connectionPools = new Map();
    this.cleanupInterval = null;
    this.maxConnections = config.proxy.maxConnections || 1000;
    this.connectionTimeout = 300000; // 5 minutes

    this.startCleanupProcess();

    logger.info("Connection Manager initialized", {
      maxConnections: this.maxConnections,
      connectionTimeout: this.connectionTimeout,
    });
  }

  registerConnection(req, res) {
    const connectionId = uuidv4();
    const clientInfo = this.extractClientInfo(req);

    const connection = {
      id: connectionId,
      clientInfo,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requestCount: 0,
      isActive: true,
      req,
      res,
    };

    if (this.connections.size >= this.maxConnections) {
      this.evictOldestConnection();
    }

    this.connections.set(connectionId, connection);
    res.set("X-Connection-ID", connectionId);

    logger.debug("Client connection registered", {
      connectionId,
      clientIP: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      totalConnections: this.connections.size,
    });

    return connectionId;
  }

  updateConnectionActivity(connectionId) {
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.lastActivity = Date.now();
      connection.requestCount++;

      logger.debug("Connection activity updated", {
        connectionId,
        requestCount: connection.requestCount,
      });
    }
  }

  getConnection(connectionId) {
    return this.connections.get(connectionId) || null;
  }

  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.isActive = false;
      this.connections.delete(connectionId);

      logger.debug("Connection closed", {
        connectionId,
        duration: Date.now() - connection.createdAt,
        requestCount: connection.requestCount,
      });

      return true;
    }

    return false;
  }

  extractClientInfo(req) {
    return {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "Unknown",
      host: req.get("Host"),
      referer: req.get("Referer"),
      acceptLanguage: req.get("Accept-Language"),
      acceptEncoding: req.get("Accept-Encoding"),
    };
  }

  getConnectionPool(serverUrl) {
    if (!this.connectionPools.has(serverUrl)) {
      this.connectionPools.set(serverUrl, {
        serverUrl,
        activeConnections: 0,
        totalConnections: 0,
        lastUsed: Date.now(),
        avgResponseTime: 0,
        errorCount: 0,
      });
    }

    return this.connectionPools.get(serverUrl);
  }

  updateConnectionPool(serverUrl, success, responseTime) {
    const pool = this.getConnectionPool(serverUrl);

    pool.totalConnections++;
    pool.lastUsed = Date.now();

    if (success) {
      const totalResponseTime = pool.avgResponseTime;
      pool.avgResponseTime =
        (totalResponseTime + responseTime) / pool.totalConnections;
    } else {
      pool.errorCount++;
    }

    logger.debug("Connection pool updated", {
      serverUrl,
      totalConnections: pool.totalConnections,
      avgResponseTime: Math.round(pool.avgResponseTime),
      errorCount: pool.errorCount,
    });
  }

  getConnectionsByIP(clientIP) {
    const connections = [];

    for (const connection of this.connections.values()) {
      if (connection.clientInfo.ip === clientIP) {
        connections.push(connection);
      }
    }

    return connections;
  }

  getActiveConnectionsCount() {
    return this.connections.size;
  }

  getStats() {
    const now = Date.now();
    const connections = Array.from(this.connections.values());

    const stats = {
      totalConnections: connections.length,
      maxConnections: this.maxConnections,
      connectionPools: this.connectionPools.size,
      avgConnectionAge: 0,
      avgRequestsPerConnection: 0,
      clientIPs: new Set(),
      userAgents: new Set(),
    };

    if (connections.length > 0) {
      let totalAge = 0;
      let totalRequests = 0;

      connections.forEach((conn) => {
        totalAge += now - conn.createdAt;
        totalRequests += conn.requestCount;
        stats.clientIPs.add(conn.clientInfo.ip);
        stats.userAgents.add(conn.clientInfo.userAgent);
      });

      stats.avgConnectionAge = Math.round(totalAge / connections.length);
      stats.avgRequestsPerConnection = Math.round(
        totalRequests / connections.length
      );
    }

    stats.uniqueClientIPs = stats.clientIPs.size;
    stats.uniqueUserAgents = stats.userAgents.size;

    // Convert Sets to arrays for JSON serialization
    stats.clientIPs = Array.from(stats.clientIPs);
    stats.userAgents = Array.from(stats.userAgents);

    return stats;
  }

  getPoolStats() {
    const pools = Array.from(this.connectionPools.values());

    return {
      totalPools: pools.length,
      pools: pools.map((pool) => ({
        serverUrl: pool.serverUrl,
        totalConnections: pool.totalConnections,
        avgResponseTime: Math.round(pool.avgResponseTime),
        errorCount: pool.errorCount,
        errorRate:
          pool.totalConnections > 0
            ? pool.errorCount / pool.totalConnections
            : 0,
        lastUsed: new Date(pool.lastUsed).toISOString(),
      })),
    };
  }

  evictOldestConnection() {
    let oldestConnection = null;
    let oldestTime = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.lastActivity < oldestTime) {
        oldestTime = connection.lastActivity;
        oldestConnection = connection;
      }
    }

    if (oldestConnection) {
      this.closeConnection(oldestConnection.id);
      logger.debug("Evicted oldest connection", {
        connectionId: oldestConnection.id,
        age: Date.now() - oldestConnection.createdAt,
      });
    }
  }

  startCleanupProcess() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000); // Run every minute

    logger.info("Connection cleanup process started");
  }

  cleanupExpiredConnections() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      const age = now - connection.lastActivity;

      if (age > this.connectionTimeout) {
        this.connections.delete(connectionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug("Cleaned up expired connections", {
        cleanedCount,
        remainingConnections: this.connections.size,
      });
    }
  }

  stopCleanupProcess() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info("Connection cleanup process stopped");
    }
  }

  closeAllConnections() {
    const connectionCount = this.connections.size;
    this.connections.clear();
    this.connectionPools.clear();

    logger.info("All connections closed", { connectionCount });
  }

  destroy() {
    this.stopCleanupProcess();
    this.closeAllConnections();
    logger.info("Connection Manager destroyed");
  }
}

module.exports = ConnectionManager;
