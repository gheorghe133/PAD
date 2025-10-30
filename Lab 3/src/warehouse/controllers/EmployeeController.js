const EmployeeService = require("../services/EmployeeService");
const responseFormatter = require("../../utils/responseFormatter");
const logger = require("../../utils/logger");

class EmployeeController {
  constructor() {
    this.employeeService = new EmployeeService();
  }

  async getAllEmployees(req, res) {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const limit = Math.min(parseInt(req.query.limit) || 10, 100);

      const result = await this.employeeService.getAllEmployees(offset, limit);
      const response = responseFormatter.paginated(
        result.data,
        result.total,
        result.offset,
        result.limit
      );

      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("GET /employees completed", {
        offset,
        limit,
        total: result.total,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async getEmployeeById(req, res) {
    try {
      const { id } = req.params;
      const employee = await this.employeeService.getEmployeeById(id);

      if (!employee) {
        const response = responseFormatter.error("Employee not found", 404);
        const formatted = responseFormatter.format(response, req.get("Accept"));

        res.set("Content-Type", formatted.contentType);
        res.status(404).send(formatted.data);
        return;
      }

      const response = responseFormatter.success(
        employee,
        "Employee retrieved successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("GET /employees/:id completed", {
        id,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async createEmployee(req, res) {
    try {
      const employeeData = req.body;

      if (req.params.id) {
        employeeData.id = req.params.id;
      }

      const employee = await this.employeeService.createEmployee(employeeData);
      const response = responseFormatter.success(
        employee,
        "Employee created successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(201).send(formatted.data);

      logger.info("Employee created via HTTP", {
        id: employee.id,
        method: req.method,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      let employee = await this.employeeService.updateEmployee(id, updateData);

      if (!employee && req.method === "PUT") {
        updateData.id = id;
        employee = await this.employeeService.createEmployee(updateData);

        const response = responseFormatter.success(
          employee,
          "Employee created successfully"
        );
        const formatted = responseFormatter.format(response, req.get("Accept"));

        res.set("Content-Type", formatted.contentType);
        res.status(201).send(formatted.data);

        logger.info("Employee created via PUT", {
          id,
          contentType: formatted.contentType,
        });
        return;
      }

      if (!employee) {
        const response = responseFormatter.error("Employee not found", 404);
        const formatted = responseFormatter.format(response, req.get("Accept"));

        res.set("Content-Type", formatted.contentType);
        res.status(404).send(formatted.data);
        return;
      }

      const response = responseFormatter.success(
        employee,
        "Employee updated successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("Employee updated via HTTP", {
        id,
        method: req.method,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.employeeService.deleteEmployee(id);

      if (!deleted) {
        const response = responseFormatter.error("Employee not found", 404);
        const formatted = responseFormatter.format(response, req.get("Accept"));

        res.set("Content-Type", formatted.contentType);
        res.status(404).send(formatted.data);
        return;
      }

      const response = responseFormatter.success(
        null,
        "Employee deleted successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("Employee deleted via HTTP", {
        id,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async searchEmployees(req, res) {
    try {
      const criteria = req.query;
      delete criteria.offset;
      delete criteria.limit;

      if (Object.keys(criteria).length === 0) {
        const response = responseFormatter.error(
          "Search criteria required",
          400
        );
        const formatted = responseFormatter.format(response, req.get("Accept"));

        res.set("Content-Type", formatted.contentType);
        res.status(400).send(formatted.data);
        return;
      }

      const employees = await this.employeeService.searchEmployees(criteria);
      const response = responseFormatter.success(
        employees,
        "Search completed successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("Employee search completed", {
        criteria,
        resultCount: employees.length,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  async getStatistics(req, res) {
    try {
      const stats = await this.employeeService.getStatistics();
      const response = responseFormatter.success(
        stats,
        "Statistics retrieved successfully"
      );
      const formatted = responseFormatter.format(response, req.get("Accept"));

      res.set("Content-Type", formatted.contentType);
      res.status(200).send(formatted.data);

      logger.info("Employee statistics retrieved", {
        totalEmployees: stats.totalEmployees,
        contentType: formatted.contentType,
      });
    } catch (error) {
      this.handleError(res, error, req.get("Accept"));
    }
  }

  handleError(res, error, acceptHeader) {
    logger.errorWithStack(error, { endpoint: "EmployeeController" });

    let statusCode = 500;
    let message = "Internal server error";
    let details = {};

    if (
      error.message === "Validation failed" ||
      error.message === "Email already exists"
    ) {
      statusCode = 400;
      message = error.message;
      details = { errors: error.details };
    }

    const response = responseFormatter.error(message, statusCode, details);
    const formatted = responseFormatter.format(response, acceptHeader);

    res.set("Content-Type", formatted.contentType);
    res.status(statusCode).send(formatted.data);
  }
}

module.exports = EmployeeController;
