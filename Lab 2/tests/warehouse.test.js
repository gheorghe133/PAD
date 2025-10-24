const request = require("supertest");
const DataWarehouseServer = require("../src/warehouse/server");

describe("Data Warehouse Server", () => {
  let server;
  let app;

  beforeAll(async () => {
    server = new DataWarehouseServer();
    app = server.getApp();
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  describe("Health Check", () => {
    test("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
    });
  });

  describe("API Info", () => {
    test("should return API information", async () => {
      const response = await request(app).get("/api/info").expect(200);

      expect(response.body).toHaveProperty("name", "Data Warehouse API");
      expect(response.body).toHaveProperty("endpoints");
      expect(response.body).toHaveProperty("supportedFormats");
    });
  });

  describe("Employee Operations", () => {
    test("should get all employees", async () => {
      const response = await request(app).get("/employees").expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test("should get employee by ID", async () => {
      const response = await request(app).get("/employees/1").expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("id", "1");
      expect(response.body.data).toHaveProperty("firstName");
      expect(response.body.data).toHaveProperty("lastName");
    });

    test("should return 404 for non-existent employee", async () => {
      const response = await request(app).get("/employees/999").expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty(
        "message",
        "Employee not found"
      );
    });

    test("should create new employee", async () => {
      const newEmployee = {
        firstName: "Test",
        lastName: "Employee",
        email: "test.employee@company.com",
        department: "Testing",
        position: "Test Engineer",
        salary: 75000,
      };

      const response = await request(app)
        .post("/employees")
        .send(newEmployee)
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("firstName", "Test");
      expect(response.body.data).toHaveProperty(
        "email",
        "test.employee@company.com"
      );
    });

    test("should validate employee data", async () => {
      const invalidEmployee = {
        firstName: "",
        lastName: "",
        email: "invalid-email",
        department: "",
        position: "",
        salary: -1000,
      };

      const response = await request(app)
        .post("/employees")
        .send(invalidEmployee)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty(
        "message",
        "Validation failed"
      );
    });

    test("should update employee", async () => {
      const updateData = {
        salary: 80000,
        position: "Senior Engineer",
      };

      const response = await request(app)
        .put("/employees/1")
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("salary", 80000);
      expect(response.body.data).toHaveProperty("position", "Senior Engineer");
    });

    test("should search employees", async () => {
      const response = await request(app)
        .get("/employees/search?department=Engineering")
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty(
          "department",
          "Engineering"
        );
      }
    });

    test("should get employee statistics", async () => {
      const response = await request(app).get("/employees/stats").expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("totalEmployees");
      expect(response.body.data).toHaveProperty("activeEmployees");
      expect(response.body.data).toHaveProperty("averageSalary");
    });
  });

  describe("Content Negotiation", () => {
    test("should return JSON by default", async () => {
      const response = await request(app).get("/employees/1").expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    test("should return XML when requested", async () => {
      const response = await request(app)
        .get("/employees/1")
        .set("Accept", "application/xml")
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/xml/);
      expect(response.text).toContain("<response>");
    });
  });

  describe("Pagination", () => {
    test("should support pagination parameters", async () => {
      const response = await request(app)
        .get("/employees?offset=0&limit=2")
        .expect(200);

      expect(response.body.pagination).toHaveProperty("offset", 0);
      expect(response.body.pagination).toHaveProperty("limit", 2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    test("should limit maximum page size", async () => {
      const response = await request(app)
        .get("/employees?limit=1000")
        .expect(200);

      expect(response.body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe("Error Handling", () => {
    test("should handle 404 for unknown endpoints", async () => {
      const response = await request(app).get("/unknown-endpoint").expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty(
        "message",
        "Endpoint not found"
      );
    });

    test("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/employees")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect([400, 500]).toContain(response.status);
    });
  });
});
