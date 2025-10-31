const EmployeeService = require("../services/EmployeeService");
const Employee = require("../models/Employee");

describe("Data Warehouse Service", () => {
  let employeeService;

  beforeEach(() => {
    employeeService = new EmployeeService();
  });

  describe("getAllEmployees", () => {
    test("should return list of employees", async () => {
      const result = await employeeService.getAllEmployees(0, 10);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("offset", 0);
      expect(result).toHaveProperty("limit", 10);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe("getEmployeeById", () => {
    test("should return null for non-existent employee", async () => {
      const employee = await employeeService.getEmployeeById("non-existent-id");
      expect(employee).toBeNull();
    });
  });

  describe("createEmployee", () => {
    test("should create new employee with valid data", async () => {
      const newEmployee = {
        id: "test-id-123",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        department: "IT",
        position: "Tester",
        salary: 45000,
      };

      const created = await employeeService.createEmployee(newEmployee);

      expect(created).toHaveProperty("id", "test-id-123");
      expect(created).toHaveProperty("firstName", "Test");
      expect(created).toHaveProperty("lastName", "User");
      expect(created).toHaveProperty("email", "test@example.com");
    });

    test("should throw error for invalid employee data", async () => {
      const invalidEmployee = {
        id: "test-id-456",
        firstName: "",
        email: "invalid-email",
      };

      await expect(
        employeeService.createEmployee(invalidEmployee)
      ).rejects.toThrow();
    });
  });

  describe("updateEmployee", () => {
    test("should return null when updating non-existent employee", async () => {
      const updates = {
        salary: 55000,
      };

      const updated = await employeeService.updateEmployee(
        "non-existent-id",
        updates
      );
      expect(updated).toBeNull();
    });
  });

  describe("deleteEmployee", () => {
    test("should return false when deleting non-existent employee", async () => {
      const deleted = await employeeService.deleteEmployee("non-existent-id");
      expect(deleted).toBe(false);
    });
  });
});
