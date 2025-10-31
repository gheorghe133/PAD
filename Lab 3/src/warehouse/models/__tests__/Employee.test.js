const Employee = require("../Employee");

describe("Employee Model", () => {
  describe("Constructor", () => {
    test("should create employee with provided data", () => {
      const data = {
        id: "test-123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        department: "IT",
        position: "Developer",
        salary: 50000,
      };

      const employee = new Employee(data);

      expect(employee.id).toBe("test-123");
      expect(employee.firstName).toBe("John");
      expect(employee.lastName).toBe("Doe");
      expect(employee.email).toBe("john@example.com");
      expect(employee.department).toBe("IT");
      expect(employee.position).toBe("Developer");
      expect(employee.salary).toBe(50000);
    });

    test("should generate UUID if no id provided", () => {
      const employee = new Employee({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      });

      expect(employee.id).toBeDefined();
      expect(employee.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test("should set default values for missing fields", () => {
      const employee = new Employee({});

      expect(employee.firstName).toBe("");
      expect(employee.lastName).toBe("");
      expect(employee.email).toBe("");
      expect(employee.department).toBe("");
      expect(employee.position).toBe("");
      expect(employee.salary).toBe(0);
      expect(employee.isActive).toBe(true);
    });
  });

  describe("Validation", () => {
    test("should validate correct employee data", () => {
      const employee = new Employee({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        department: "IT",
        position: "Developer",
        salary: 50000,
      });

      const result = employee.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should return error for missing firstName", () => {
      const employee = new Employee({
        lastName: "Doe",
        email: "john@example.com",
        department: "IT",
        position: "Developer",
      });

      const result = employee.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("First name is required");
    });

    test("should return error for missing lastName", () => {
      const employee = new Employee({
        firstName: "John",
        email: "john@example.com",
        department: "IT",
        position: "Developer",
      });

      const result = employee.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Last name is required");
    });

    test("should return error for missing email", () => {
      const employee = new Employee({
        firstName: "John",
        lastName: "Doe",
        department: "IT",
        position: "Developer",
      });

      const result = employee.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email is required");
    });

    test("should return error for invalid email format", () => {
      const employee = new Employee({
        firstName: "John",
        lastName: "Doe",
        email: "invalid-email",
        department: "IT",
        position: "Developer",
      });

      const result = employee.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid email format");
    });

    test("should return multiple errors for multiple issues", () => {
      const employee = new Employee({
        email: "invalid-email",
      });

      const result = employee.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("First name is required");
      expect(result.errors).toContain("Last name is required");
      expect(result.errors).toContain("Invalid email format");
    });
  });

  describe("toObject", () => {
    test("should return object representation", () => {
      const employee = new Employee({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        department: "IT",
        position: "Developer",
        salary: 50000,
      });

      const obj = employee.toObject();

      expect(obj).toHaveProperty("id");
      expect(obj).toHaveProperty("firstName", "John");
      expect(obj).toHaveProperty("lastName", "Doe");
      expect(obj).toHaveProperty("email", "john@example.com");
      expect(obj).toHaveProperty("department", "IT");
      expect(obj).toHaveProperty("position", "Developer");
      expect(obj).toHaveProperty("salary", 50000);
      expect(obj).toHaveProperty("isActive", true);
      expect(obj).toHaveProperty("createdAt");
      expect(obj).toHaveProperty("updatedAt");
    });
  });

});
