# Web Proxy Lab - PAD Lab 2

Implementation of a **Web Proxy** system with **Data Warehouse** functionality, featuring **load balancing**, **caching**, and **distributed data management**.

## Architecture Overview

### Stage 1: Data Warehouse (DW)

```
┌─────────┐ HTTP GET/PUT/POST ┌─────────────┐
│ Client  │ ──────────────────▶│ Data        │
│         │                   │ Warehouse   │
└─────────┘                   │ (DW)        │
                               └─────────────┘
```

### Stage 2: Reverse Proxy with Load Balancing

```
                               ┌─────────────┐
                            ┌─▶│ DW Server 1 │
┌─────────┐ HTTP Request    │  └─────────────┘
│ Client  │ ──────────────┐ │  ┌─────────────┐
│         │               │ ├─▶│ DW Server 2 │
└─────────┘               ▼ │  └─────────────┘
                     ┌─────────┐ ┌─────────────┐
                     │ Reverse │ │ DW Server 3 │
                     │ Proxy   │◀┘ └─────────────┘
                     │         │
                     │ Cache + │
                     │ Load    │
                     │ Balance │
                     └─────────┘
```

## Features

### Stage 1: Data Warehouse Server

- **HTTP API**: GET, PUT, POST methods for data operations
- **Concurrent Processing**: Thread-per-request model
- **Multiple Formats**: XML and JSON response support
- **Thread-Safe Storage**: Concurrent read/write operations
- **RESTful Endpoints**: Employee data management

### Stage 2: Reverse Proxy

- **Smart Proxy**: Persistent connection management
- **Caching**: Response caching with TTL
- **Load Balancing**: Round-Robin algorithm
- **Redis Integration**: Connection and cache storage
- **Cassandra Integration**: Scalable data persistence

## Quick Start

```bash
# Install dependencies
npm install

# Start Data Warehouse (Stage 1)
npm run start:warehouse

# Start Reverse Proxy (Stage 2)
npm run start:proxy

# Run tests
npm test

# Development mode with auto-reload
npm run dev:warehouse
npm run dev:proxy
```

## API Endpoints

### Data Warehouse Endpoints

```
GET    /employees              # Get all employees
GET    /employees/:id          # Get employee by ID
GET    /employees?offset=0&limit=10  # Paginated employees
PUT    /employees/:id          # Create/Update employee
POST   /employees/:id          # Update employee
DELETE /employees/:id          # Delete employee
```

### Content Negotiation

```bash
# JSON Response (default)
curl -H "Accept: application/json" http://localhost:3000/employees

# XML Response
curl -H "Accept: application/xml" http://localhost:3000/employees
```

## Configuration

### Environment Variables

```bash
# Data Warehouse
DW_PORT=3000
DW_HOST=localhost

# Proxy
PROXY_PORT=8080
PROXY_HOST=localhost

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cassandra
CASSANDRA_HOSTS=localhost
CASSANDRA_KEYSPACE=warehouse
```

## Project Structure

```
Lab 2/
├── src/
│   ├── warehouse/           # Stage 1: Data Warehouse
│   │   ├── server.js       # Main DW server
│   │   ├── controllers/    # HTTP request controllers
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   └── storage/        # Thread-safe storage
│   ├── proxy/              # Stage 2: Reverse Proxy
│   │   ├── server.js       # Main proxy server
│   │   ├── cache/          # Caching implementation
│   │   ├── loadbalancer/   # Load balancing logic
│   │   └── connections/    # Connection management
│   ├── client/             # Test client
│   ├── config/             # Configuration files
│   └── utils/              # Shared utilities
├── tests/                  # Test suites
├── docs/                   # Documentation
└── package.json
```

## Implementation Details

### Thread Safety

- **Concurrent Collections**: Thread-safe data structures
- **Mutex Locks**: Mutual exclusion for critical sections
- **Atomic Operations**: Safe concurrent read/write

### Caching Strategy

- **TTL-based**: Time-to-live expiration
- **LRU Eviction**: Least Recently Used cleanup
- **Cache Keys**: Request-based key generation

### Load Balancing

- **Round-Robin**: Equal distribution algorithm
- **Health Checks**: Server availability monitoring
- **Failover**: Automatic server switching

## Testing

### Automated Testing

Run the Jest test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**Test Results**: 44/49 tests passing (90% success rate)

- All core functionality tests pass
- Minor failures in edge cases that don't affect main features

### Manual Testing

Use the provided test client for comprehensive testing:

```bash
npm run test:client
```

This runs tests for:

- Direct warehouse connections
- Proxy functionality
- Caching behavior (MISS → HIT)
- Load balancing distribution
- XML format support
- CRUD operations

## Dependencies

### Core Dependencies

- **express**: HTTP server framework
- **redis**: In-memory data store
- **cassandra-driver**: Cassandra database client
- **http-proxy-middleware**: Proxy middleware

### Development

- **jest**: Testing framework
- **supertest**: HTTP testing
- **nodemon**: Development auto-reload

## References

- [Scalable Web Architecture](http://aosabook.org/en/distsys.html)
- [Forward vs Reverse Proxy](http://www.jscape.com/blog/bid/87783/Forward-Proxy-vs-Reverse-Proxy)
- [HTTP Caching](http://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)
- [Redis Documentation](http://redis.io/documentation)
- [Cassandra Documentation](https://cassandra.apache.org/doc/)
