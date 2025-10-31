const axios = require("axios");
const config = require("../config/config");

class TestClient {
  constructor(proxyUrl = `http://${config.proxy.host}:${config.proxy.port}`) {
    this.proxyUrl = proxyUrl;
    this.warehouseUrl = `http://${config.warehouse.host}:${config.warehouse.port}`;
  }

  async testDirectConnection() {
    console.log("\n=== Testing Direct Connection to Data Warehouse ===");

    try {
      const response = await axios.get(`${this.warehouseUrl}/employees`);
      console.log("[PASS] Direct connection successful");
      console.log(`Status: ${response.status}`);
      console.log(`Employees count: ${response.data.data.length}`);
      console.log(`Response time: ${response.headers["x-response-time"]}`);
    } catch (error) {
      console.log("[FAIL] Direct connection failed:", error.message);
    }
  }

  async testProxyConnection() {
    console.log("\n=== Testing Proxy Connection ===");

    try {
      const response = await axios.get(`${this.proxyUrl}/employees`);
      console.log("[PASS] Proxy connection successful");
      console.log(`Status: ${response.status}`);
      console.log(`Employees count: ${response.data.data.length}`);
      console.log(`Response time: ${response.headers["x-response-time"]}`);
      console.log(`Cache status: ${response.headers["x-proxy-cache"]}`);
      console.log(`Connection ID: ${response.headers["x-connection-id"]}`);
      console.log(`Proxy server: ${response.headers["x-proxy-server"]}`);
    } catch (error) {
      console.log("[FAIL] Proxy connection failed:", error.message);
    }
  }

  async testCaching() {
    console.log("\n=== Testing Caching Functionality ===");

    try {
      console.log("Making first request...");
      const response1 = await axios.get(`${this.proxyUrl}/employees/1`);
      console.log(
        `First request - Cache: ${response1.headers["x-proxy-cache"]}`
      );
      console.log(`Response time: ${response1.headers["x-response-time"]}`);

      console.log("Making second request...");
      const response2 = await axios.get(`${this.proxyUrl}/employees/1`);
      console.log(
        `Second request - Cache: ${response2.headers["x-proxy-cache"]}`
      );
      console.log(`Response time: ${response2.headers["x-response-time"]}`);
      console.log(`Cache age: ${response2.headers["x-cache-age"]} seconds`);

      console.log("[PASS] Caching test completed");
    } catch (error) {
      console.log("[FAIL] Caching test failed:", error.message);
    }
  }

  async testLoadBalancing() {
    console.log("\n=== Testing Load Balancing ===");

    try {
      const servers = new Set();
      const requests = 10;

      console.log(`Making ${requests} requests to test load balancing...`);

      for (let i = 0; i < requests; i++) {
        const response = await axios.get(
          `${this.proxyUrl}/employees?nocache=${i}`
        );
        const server = response.headers["x-proxy-server"];
        if (server) {
          servers.add(server);
        }
        console.log(`Request ${i + 1}: Server ${server}`);
      }

      console.log(`[PASS] Load balancing test completed`);
      console.log(`Unique servers used: ${servers.size}`);
      console.log(`Servers: ${Array.from(servers).join(", ")}`);
    } catch (error) {
      console.log("[FAIL] Load balancing test failed:", error.message);
    }
  }

  async testXMLFormat() {
    console.log("\n=== Testing XML Format Support ===");

    try {
      const response = await axios.get(`${this.proxyUrl}/employees/1`, {
        headers: { Accept: "application/xml" },
      });

      console.log("[PASS] XML format test successful");
      console.log(`Content-Type: ${response.headers["content-type"]}`);
      console.log("Response preview:", response.data.substring(0, 200) + "...");
    } catch (error) {
      console.log("[FAIL] XML format test failed:", error.message);
    }
  }

  async testCRUDOperations() {
    console.log("\n=== Testing CRUD Operations Through Proxy ===");

    try {
      console.log("Creating new employee...");
      const createResponse = await axios.post(`${this.proxyUrl}/employees`, {
        firstName: "Proxy",
        lastName: "Test",
        email: "proxy.test@company.com",
        department: "Testing",
        position: "Test Engineer",
        salary: 80000,
      });

      const employeeId = createResponse.data.data.id;
      console.log(`[PASS] Employee created with ID: ${employeeId}`);

      console.log("Reading employee...");
      const readResponse = await axios.get(
        `${this.proxyUrl}/employees/${employeeId}`
      );
      console.log(
        `[PASS] Employee read: ${readResponse.data.data.firstName} ${readResponse.data.data.lastName}`
      );

      console.log("Updating employee...");
      const updateResponse = await axios.put(
        `${this.proxyUrl}/employees/${employeeId}`,
        {
          salary: 85000,
          position: "Senior Test Engineer",
        }
      );
      console.log(
        `[PASS] Employee updated: Salary ${updateResponse.data.data.salary}`
      );

      console.log("Deleting employee...");
      await axios.delete(`${this.proxyUrl}/employees/${employeeId}`);
      console.log(`[PASS] Employee deleted`);

      console.log("[PASS] CRUD operations test completed");
    } catch (error) {
      console.log("[FAIL] CRUD operations test failed:", error.message);
    }
  }

  async testProxyStatistics() {
    console.log("\n=== Testing Proxy Statistics ===");

    try {
      const response = await axios.get(`${this.proxyUrl}/proxy/stats`);
      console.log("[PASS] Proxy statistics retrieved");
      console.log("Cache stats:", response.data.cache);
      console.log("Load balancer stats:", response.data.loadBalancer);
      console.log("Connection stats:", response.data.connections);
    } catch (error) {
      console.log("[FAIL] Proxy statistics test failed:", error.message);
    }
  }

  async runAllTests() {
    console.log("[START] Starting Web Proxy Lab Tests");
    console.log(`Proxy URL: ${this.proxyUrl}`);
    console.log(`Warehouse URL: ${this.warehouseUrl}`);

    await this.testDirectConnection();
    await this.testProxyConnection();
    await this.testCaching();
    await this.testLoadBalancing();
    await this.testXMLFormat();
    await this.testCRUDOperations();
    await this.testProxyStatistics();

    console.log("\n[DONE] All tests completed!");
  }

  async performanceTest(requests = 100) {
    console.log(`\n=== Performance Test (${requests} requests) ===`);

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < requests; i++) {
      promises.push(
        axios
          .get(`${this.proxyUrl}/employees?test=${i}`)
          .then((response) => ({
            success: true,
            responseTime: parseInt(response.headers["x-response-time"]),
            cache: response.headers["x-proxy-cache"],
          }))
          .catch((error) => ({
            success: false,
            error: error.message,
          }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const cacheHits = successful.filter((r) => r.cache === "HIT");
    const cacheMisses = successful.filter((r) => r.cache === "MISS");

    const avgResponseTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.responseTime, 0) /
          successful.length
        : 0;

    console.log(
      `[PASS] Performance test completed in ${endTime - startTime}ms`
    );
    console.log(`Total requests: ${requests}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Cache hits: ${cacheHits.length}`);
    console.log(`Cache misses: ${cacheMisses.length}`);
    console.log(`Average response time: ${Math.round(avgResponseTime)}ms`);
    console.log(
      `Requests per second: ${Math.round(
        requests / ((endTime - startTime) / 1000)
      )}`
    );
  }
}

if (require.main === module) {
  const productionProxyUrl = "https://reverse-proxy-server.up.railway.app";
  const client = new TestClient(productionProxyUrl);

  const args = process.argv.slice(2);
  const testType = args[0] || "all";

  switch (testType) {
    case "direct":
      client.testDirectConnection();
      break;
    case "proxy":
      client.testProxyConnection();
      break;
    case "cache":
      client.testCaching();
      break;
    case "balance":
      client.testLoadBalancing();
      break;
    case "xml":
      client.testXMLFormat();
      break;
    case "crud":
      client.testCRUDOperations();
      break;
    case "stats":
      client.testProxyStatistics();
      break;
    case "performance":
      const requests = parseInt(args[1]) || 100;
      client.performanceTest(requests);
      break;
    case "all":
    default:
      client.runAllTests();
      break;
  }
}

module.exports = TestClient;
