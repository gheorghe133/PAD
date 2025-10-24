process.env.DW_SERVERS = "localhost:3010";

const request = require("supertest");
const ReverseProxyServer = require("../src/proxy/server");
const DataWarehouseServer = require("../src/warehouse/server");

describe("Reverse Proxy Server", () => {
  let proxyServer;
  let warehouseServer;
  let proxyApp;

  beforeAll(async () => {
    warehouseServer = new DataWarehouseServer();
    await warehouseServer.start(3010, "localhost");

    proxyServer = new ReverseProxyServer();
    proxyApp = proxyServer.getApp();
  });

  afterAll(async () => {
    if (proxyServer) {
      await proxyServer.shutdown();
    }
    if (warehouseServer) {
      await warehouseServer.shutdown();
    }
  });

  describe("Proxy Health Check", () => {
    test("should return proxy health status", async () => {
      const response = await request(proxyApp).get("/proxy/health").expect(200);

      expect(response.body).toHaveProperty("proxy");
      expect(response.body).toHaveProperty("cache");
      expect(response.body).toHaveProperty("loadBalancer");
      expect(response.body.proxy).toHaveProperty("status", "healthy");
    });
  });

  describe("Proxy Statistics", () => {
    test("should return proxy statistics", async () => {
      const response = await request(proxyApp).get("/proxy/stats").expect(200);

      expect(response.body).toHaveProperty("cache");
      expect(response.body).toHaveProperty("loadBalancer");
      expect(response.body).toHaveProperty("connections");
      expect(response.body).toHaveProperty("connectionPools");
    });
  });

  describe("Request Forwarding", () => {
    test("should forward GET requests to backend", async () => {
      const response = await request(proxyApp).get("/employees").expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.headers).toHaveProperty("x-proxy-cache");
      expect(response.headers).toHaveProperty("x-connection-id");
    });

    test("should forward POST requests to backend", async () => {
      const newEmployee = {
        firstName: "Proxy",
        lastName: "Test",
        email: `proxy.test.${Date.now()}@company.com`,
        department: "Testing",
        position: "Test Engineer",
        salary: 75000,
      };

      const response = await request(proxyApp)
        .post("/employees")
        .send(newEmployee)
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("firstName", "Proxy");
    });

    test("should handle backend errors gracefully", async () => {
      const response = await request(proxyApp)
        .get("/employees/nonexistent")
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("Caching Functionality", () => {
    test("should cache GET requests", async () => {
      const response1 = await request(proxyApp).get("/employees/1").expect(200);

      expect(response1.headers["x-proxy-cache"]).toBe("MISS");

      const response2 = await request(proxyApp).get("/employees/1").expect(200);

      expect(response2.headers["x-proxy-cache"]).toBe("HIT");
      expect(response2.headers).toHaveProperty("x-cache-age");
    });

    test("should not cache non-GET requests", async () => {
      const newEmployee = {
        firstName: "Cache",
        lastName: "Test",
        email: `cache.test.${Date.now()}@company.com`,
        department: "Testing",
        position: "Test Engineer",
        salary: 75000,
      };

      const response = await request(proxyApp)
        .post("/employees")
        .send(newEmployee)
        .expect(201);

      expect(response.headers["x-proxy-cache"]).toBe("SKIP");
    });

    test("should not cache requests with dynamic parameters", async () => {
      const response = await request(proxyApp)
        .get("/employees?timestamp=" + Date.now())
        .expect(200);

      expect(response.headers["x-proxy-cache"]).toBe("SKIP");
    });
  });

  describe("Cache Management", () => {
    test("should clear cache", async () => {
      const response = await request(proxyApp)
        .delete("/proxy/cache")
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message", "Cache cleared");
    });

    test("should invalidate cache by pattern", async () => {
      const response = await request(proxyApp)
        .delete("/proxy/cache/employees")
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("invalidatedCount");
    });
  });

  describe("Connection Management", () => {
    test("should assign connection IDs", async () => {
      const response = await request(proxyApp).get("/employees").expect(200);

      expect(response.headers).toHaveProperty("x-connection-id");
      expect(response.headers["x-connection-id"]).toMatch(/^[a-f0-9-]{36}$/);
    });

    test("should track response times", async () => {
      const response = await request(proxyApp).get("/employees").expect(200);

      expect(response.headers).toHaveProperty("x-response-time");
      expect(response.headers["x-response-time"]).toMatch(/^\d+ms$/);
    });
  });

  describe("Content Type Support", () => {
    test("should support JSON responses", async () => {
      const response = await request(proxyApp)
        .get("/employees/1")
        .set("Accept", "application/json")
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    test("should support XML responses", async () => {
      const response = await request(proxyApp)
        .get("/employees/1")
        .set("Accept", "application/xml")
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/xml/);
    });
  });

  describe("Error Handling", () => {
    test("should handle backend errors gracefully", async () => {
      const response = await request(proxyApp).get("/nonexistent-endpoint");

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("Load Balancer Integration", () => {
    test("should include server information in headers", async () => {
      const response = await request(proxyApp)
        .get("/employees?test=loadbalancer")
        .expect(200);

      expect(response.headers).toHaveProperty("x-proxy-server");

      expect(response.headers["x-proxy-server"]).toMatch(/localhost:\d+/);
    });
  });
});
