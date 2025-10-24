const CacheManager = require("../src/proxy/cache/CacheManager");

describe("Cache Manager", () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy();
    }
  });

  describe("Cache Key Generation", () => {
    test("should generate consistent cache keys", () => {
      const req1 = {
        method: "GET",
        originalUrl: "/employees/1",
        get: jest.fn().mockReturnValue("application/json"),
      };

      const req2 = {
        method: "GET",
        originalUrl: "/employees/1",
        get: jest.fn().mockReturnValue("application/json"),
      };

      const key1 = cacheManager.generateKey(req1);
      const key2 = cacheManager.generateKey(req2);

      expect(key1).toBe(key2);
    });

    test("should generate different keys for different requests", () => {
      const req1 = {
        method: "GET",
        originalUrl: "/employees/1",
        get: jest.fn().mockReturnValue("application/json"),
      };

      const req2 = {
        method: "GET",
        originalUrl: "/employees/2",
        get: jest.fn().mockReturnValue("application/json"),
      };

      const key1 = cacheManager.generateKey(req1);
      const key2 = cacheManager.generateKey(req2);

      expect(key1).not.toBe(key2);
    });
  });

  describe("Cache Operations", () => {
    test("should store and retrieve cached data", () => {
      const key = "test-key";
      const data = { message: "test data", timestamp: Date.now() };

      cacheManager.set(key, data);
      const retrieved = cacheManager.get(key);

      expect(retrieved).toMatchObject(data);
      expect(retrieved.timestamp).toBeDefined();
    });

    test("should return null for non-existent keys", () => {
      const result = cacheManager.get("non-existent-key");
      expect(result).toBeNull();
    });

    test("should delete cached entries", () => {
      const key = "test-key";
      const data = { message: "test data" };

      cacheManager.set(key, data);
      expect(cacheManager.get(key)).toBeTruthy();

      const deleted = cacheManager.delete(key);
      expect(deleted).toBe(true);
      expect(cacheManager.get(key)).toBeNull();
    });

    test("should clear all cached entries", () => {
      cacheManager.set("key1", { data: "test1" });
      cacheManager.set("key2", { data: "test2" });

      cacheManager.clear();

      expect(cacheManager.get("key1")).toBeNull();
      expect(cacheManager.get("key2")).toBeNull();
    });
  });

  describe("TTL (Time To Live)", () => {
    test("should expire entries after TTL", (done) => {
      const key = "test-key";
      const data = { message: "test data" };
      const ttl = 0.1;

      cacheManager.set(key, data, ttl);
      expect(cacheManager.get(key)).toBeTruthy();

      setTimeout(() => {
        expect(cacheManager.get(key)).toBeNull();
        done();
      }, 150);
    });

    test("should not expire entries before TTL", () => {
      const key = "test-key";
      const data = { message: "test data" };
      const ttl = 10;

      cacheManager.set(key, data, ttl);
      expect(cacheManager.get(key)).toBeTruthy();
    });
  });

  describe("Cache Policies", () => {
    test("should identify cacheable requests", () => {
      const cacheableReq = {
        method: "GET",
        query: { id: "1" },
      };

      const nonCacheableReq = {
        method: "POST",
        query: {},
      };

      expect(cacheManager.isCacheable(cacheableReq)).toBe(true);
      expect(cacheManager.isCacheable(nonCacheableReq)).toBe(false);
    });

    test("should not cache requests with dynamic parameters", () => {
      const dynamicReq = {
        method: "GET",
        query: { timestamp: Date.now() },
      };

      expect(cacheManager.isCacheable(dynamicReq)).toBe(false);
    });

    test("should identify cacheable responses", () => {
      const cacheableResponse = {
        statusCode: 200,
        headers: {},
      };

      const nonCacheableResponse = {
        statusCode: 500,
        headers: {},
      };

      expect(cacheManager.isResponseCacheable(cacheableResponse)).toBe(true);
      expect(cacheManager.isResponseCacheable(nonCacheableResponse)).toBe(
        false
      );
    });

    test("should respect Cache-Control headers", () => {
      const noCacheResponse = {
        statusCode: 200,
        headers: { "cache-control": "no-cache" },
      };

      expect(cacheManager.isResponseCacheable(noCacheResponse)).toBe(false);
    });
  });

  describe("LRU Eviction", () => {
    test("should have eviction mechanism", () => {
      expect(cacheManager.evictLRU).toBeDefined();
      expect(typeof cacheManager.evictLRU).toBe("function");
    });
  });

  describe("Pattern Invalidation", () => {
    test("should invalidate entries by pattern", () => {
      cacheManager.set("employees:1", { data: "emp1" });
      cacheManager.set("employees:2", { data: "emp2" });
      cacheManager.set("departments:1", { data: "dept1" });

      const invalidated = cacheManager.invalidatePattern(/^employees:/);

      expect(invalidated).toBe(2);
      expect(cacheManager.get("employees:1")).toBeNull();
      expect(cacheManager.get("employees:2")).toBeNull();
      expect(cacheManager.get("departments:1")).toBeTruthy();
    });
  });

  describe("Statistics", () => {
    test("should provide cache statistics", () => {
      cacheManager.set("key1", { data: "test1" });
      cacheManager.set("key2", { data: "test2" });

      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("expiredEntries");
      expect(stats.size).toBe(2);
    });
  });

  describe("Cleanup Process", () => {
    test("should clean up expired entries", (done) => {
      const key1 = "key1";
      const key2 = "key2";

      cacheManager.set(key1, { data: "test1" }, 0.1);
      cacheManager.set(key2, { data: "test2" }, 10);

      setTimeout(() => {
        cacheManager.cleanup();

        expect(cacheManager.get(key1)).toBeNull();
        expect(cacheManager.get(key2)).toBeTruthy();
        done();
      }, 150);
    });
  });
});
