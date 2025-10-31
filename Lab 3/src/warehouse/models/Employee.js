const { v4: uuidv4 } = require("uuid");

class Employee {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.firstName = data.firstName || "";
    this.lastName = data.lastName || "";
    this.email = data.email || "";
    this.department = data.department || "";
    this.position = data.position || "";
    this.salary = data.salary || 0;
    this.hireDate = data.hireDate || new Date().toISOString();
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push("First name is required");
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push("Last name is required");
    }

    if (!this.email || this.email.trim().length === 0) {
      errors.push("Email is required");
    } else if (!this.isValidEmail(this.email)) {
      errors.push("Invalid email format");
    }

    if (!this.department || this.department.trim().length === 0) {
      errors.push("Department is required");
    }

    if (!this.position || this.position.trim().length === 0) {
      errors.push("Position is required");
    }

    if (this.salary < 0) {
      errors.push("Salary must be non-negative");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  update(data) {
    const allowedFields = [
      "firstName",
      "lastName",
      "email",
      "department",
      "position",
      "salary",
      "isActive",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    });

    this.updatedAt = new Date().toISOString();
    return this;
  }

  toObject() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      department: this.department,
      position: this.position,
      salary: this.salary,
      hireDate: this.hireDate,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

}

module.exports = Employee;
