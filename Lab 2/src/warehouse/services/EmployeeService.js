const Employee = require("../models/Employee");
const ThreadSafeStorage = require("../storage/ThreadSafeStorage");
const logger = require("../../utils/logger");

class EmployeeService {
  constructor() {
    this.storage = new ThreadSafeStorage();
    this.initializeSampleData();
  }

  async initializeSampleData() {
    const sampleEmployees = [
      {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@company.com",
        department: "Engineering",
        position: "Software Engineer",
        salary: 75000,
        hireDate: "2022-01-15T00:00:00.000Z",
      },
      {
        id: "2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.com",
        department: "Marketing",
        position: "Marketing Manager",
        salary: 65000,
        hireDate: "2021-03-10T00:00:00.000Z",
      },
      {
        id: "3",
        firstName: "Bob",
        lastName: "Johnson",
        email: "bob.johnson@company.com",
        department: "Engineering",
        position: "Senior Developer",
        salary: 85000,
        hireDate: "2020-06-01T00:00:00.000Z",
      },
      {
        id: "4",
        firstName: "Alice",
        lastName: "Williams",
        email: "alice.williams@company.com",
        department: "HR",
        position: "HR Specialist",
        salary: 55000,
        hireDate: "2023-02-20T00:00:00.000Z",
      },
      {
        id: "5",
        firstName: "Charlie",
        lastName: "Brown",
        email: "charlie.brown@company.com",
        department: "Finance",
        position: "Financial Analyst",
        salary: 60000,
        hireDate: "2022-09-15T00:00:00.000Z",
      },
    ];

    for (const empData of sampleEmployees) {
      const employee = new Employee(empData);
      await this.storage.set(employee.id, employee);
    }

    logger.info("Sample employee data initialized", {
      count: sampleEmployees.length,
    });
  }

  async getAllEmployees(offset = 0, limit = 10) {
    try {
      const result = await this.storage.paginate(offset, limit);
      const employees = result.data.map((emp) => emp.toObject());

      logger.info("Retrieved employees", {
        offset,
        limit,
        total: result.total,
        returned: employees.length,
      });

      return {
        ...result,
        data: employees,
      };
    } catch (error) {
      logger.error("Error retrieving employees", { error: error.message });
      throw error;
    }
  }

  async getEmployeeById(id) {
    try {
      const employee = await this.storage.get(id);

      if (!employee) {
        logger.warn("Employee not found", { id });
        return null;
      }

      logger.info("Retrieved employee by ID", { id });
      return employee.toObject();
    } catch (error) {
      logger.error("Error retrieving employee by ID", {
        id,
        error: error.message,
      });
      throw error;
    }
  }

  async createEmployee(employeeData) {
    try {
      const employee = new Employee(employeeData);
      const validation = employee.validate();

      if (!validation.isValid) {
        const error = new Error("Validation failed");
        error.details = validation.errors;
        throw error;
      }

      const existingEmployees = await this.storage.values();
      const emailExists = existingEmployees.some(
        (emp) => emp.email === employee.email
      );

      if (emailExists) {
        const error = new Error("Email already exists");
        error.details = ["An employee with this email already exists"];
        throw error;
      }

      await this.storage.set(employee.id, employee);

      logger.info("Employee created", {
        id: employee.id,
        email: employee.email,
      });
      return employee.toObject();
    } catch (error) {
      logger.error("Error creating employee", {
        error: error.message,
        details: error.details,
      });
      throw error;
    }
  }

  async updateEmployee(id, updateData) {
    try {
      const employee = await this.storage.get(id);

      if (!employee) {
        logger.warn("Employee not found for update", { id });
        return null;
      }

      if (updateData.email && updateData.email !== employee.email) {
        const existingEmployees = await this.storage.values();
        const emailExists = existingEmployees.some(
          (emp) => emp.id !== id && emp.email === updateData.email
        );

        if (emailExists) {
          const error = new Error("Email already exists");
          error.details = ["An employee with this email already exists"];
          throw error;
        }
      }

      employee.update(updateData);
      const validation = employee.validate();

      if (!validation.isValid) {
        const error = new Error("Validation failed");
        error.details = validation.errors;
        throw error;
      }

      await this.storage.set(id, employee);

      logger.info("Employee updated", { id });
      return employee.toObject();
    } catch (error) {
      logger.error("Error updating employee", {
        id,
        error: error.message,
        details: error.details,
      });
      throw error;
    }
  }

  async deleteEmployee(id) {
    try {
      const exists = await this.storage.has(id);

      if (!exists) {
        logger.warn("Employee not found for deletion", { id });
        return false;
      }

      const deleted = await this.storage.delete(id);

      logger.info("Employee deleted", { id });
      return deleted;
    } catch (error) {
      logger.error("Error deleting employee", { id, error: error.message });
      throw error;
    }
  }

  async searchEmployees(criteria) {
    try {
      const employees = await this.storage.find((employee) => {
        return Object.keys(criteria).every((key) => {
          if (!employee[key]) return false;

          const employeeValue = employee[key].toString().toLowerCase();
          const searchValue = criteria[key].toString().toLowerCase();

          return employeeValue.includes(searchValue);
        });
      });

      const results = employees.map((emp) => emp.toObject());

      logger.info("Employee search completed", {
        criteria,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Error searching employees", {
        criteria,
        error: error.message,
      });
      throw error;
    }
  }

  async getEmployeesByDepartment(department) {
    return this.searchEmployees({ department });
  }

  async getStatistics() {
    try {
      const totalEmployees = await this.storage.size();
      const employees = await this.storage.values();

      const departments = {};
      const positions = {};
      let totalSalary = 0;
      let activeEmployees = 0;

      employees.forEach((emp) => {
        departments[emp.department] = (departments[emp.department] || 0) + 1;

        positions[emp.position] = (positions[emp.position] || 0) + 1;

        totalSalary += emp.salary;

        if (emp.isActive) activeEmployees++;
      });

      const stats = {
        totalEmployees,
        activeEmployees,
        averageSalary:
          totalEmployees > 0 ? Math.round(totalSalary / totalEmployees) : 0,
        departmentBreakdown: departments,
        positionBreakdown: positions,
      };

      logger.info("Generated employee statistics", stats);
      return stats;
    } catch (error) {
      logger.error("Error generating statistics", { error: error.message });
      throw error;
    }
  }
}

module.exports = EmployeeService;
