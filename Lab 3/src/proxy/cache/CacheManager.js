const config = require("../../config/config");
const logger = require("../../utils/logger");

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
    this.accessTimes = new Map();
    this.maxSize = config.cache.maxSize;
    this.defaultTTL = config.cache.defaultTTL * 1000;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, config.cache.checkPeriod * 1000);

    logger.info("Cache Manager initialized", {
      maxSize: this.maxSize,
      defaultTTL: config.cache.defaultTTL,
      checkPeriod: config.cache.checkPeriod,
    });
  }

  generateKey(req) {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const acceptHeader = req.get("Accept") || "application/json";

    const relevantHeaders = {
      accept: acceptHeader,
      "accept-encoding": req.get("Accept-Encoding"),
    };

    const keyData = {
      method,
      url,
      headers: relevantHeaders,
    };

    return `${method}:${url}:${Buffer.from(JSON.stringify(keyData)).toString(
      "base64"
    )}`;
  }

  isCacheable(req) {
    if (req.method !== "GET") {
      return false;
    }

    const dynamicParams = ["timestamp", "random", "nocache", "_"];
    const queryKeys = Object.keys(req.query || {});

    return !queryKeys.some((key) => dynamicParams.includes(key.toLowerCase()));
  }

  isResponseCacheable(response) {
    const statusCode = response.statusCode;

    if (statusCode < 200 || statusCode >= 300) {
      return false;
    }

    const headers = response.headers || {};
    const cacheControl = headers["cache-control"];
    if (cacheControl) {
      if (
        cacheControl.includes("no-cache") ||
        cacheControl.includes("no-store") ||
        cacheControl.includes("private")
      ) {
        return false;
      }
    }

    return true;
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const expiryTime = this.ttlMap.get(key);
    const now = Date.now();

    if (expiryTime && now > expiryTime) {
      this.delete(key);
      logger.debug("Cache miss - expired", { key });
      return null;
    }

    this.accessTimes.set(key, now);

    const cachedData = this.cache.get(key);
    logger.debug("Cache hit", {
      key,
      age: now - (cachedData.timestamp || now),
    });

    return cachedData;
  }

  set(key, data, ttl = null) {
    const now = Date.now();
    const timeToLive = (ttl || config.cache.defaultTTL) * 1000;
    const expiryTime = now + timeToLive;

    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const cacheEntry = {
      ...data,
      timestamp: now,
      ttl: timeToLive,
    };

    this.cache.set(key, cacheEntry);
    this.ttlMap.set(key, expiryTime);
    this.accessTimes.set(key, now);

    logger.debug("Cache set", {
      key,
      ttl: ttl || config.cache.defaultTTL,
      size: this.cache.size,
    });
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    this.ttlMap.delete(key);
    this.accessTimes.delete(key);

    if (deleted) {
      logger.debug("Cache delete", { key, size: this.cache.size });
    }

    return deleted;
  }

  clear() {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.ttlMap.clear();
    this.accessTimes.clear();

    logger.info("Cache cleared", { previousSize });
  }

  evictLRU() {
    if (this.accessTimes.size === 0) {
      return;
    }

    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      logger.debug("Cache LRU eviction", { evictedKey: oldestKey });
    }
  }

  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, expiryTime] of this.ttlMap.entries()) {
      if (now > expiryTime) {
        this.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug("Cache cleanup completed", {
        expiredCount,
        remainingSize: this.cache.size,
      });
    }
  }

  getStats() {
    const now = Date.now();
    let expiredCount = 0;

    for (const expiryTime of this.ttlMap.values()) {
      if (now > expiryTime) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredEntries: expiredCount,
    };
  }

  invalidatePattern(pattern) {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    let invalidatedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        invalidatedCount++;
      }
    }

    logger.info("Cache pattern invalidation", {
      pattern: pattern.toString(),
      invalidatedCount,
    });

    return invalidatedCount;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clear();
    logger.info("Cache Manager destroyed");
  }
}

module.exports = CacheManager;
