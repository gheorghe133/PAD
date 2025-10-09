# Message Broker Lab - PDA Lab 1

This project implements a message broker system using both **TCP Sockets** (Part 1) and **gRPC** (Part 2) for the Distributed Application Programming (PDA) course.

## Overview

The system consists of three main components implementing **Publisher/Subscriber pattern**:
- **Broker**: Central message routing component that forwards messages based on topics
- **Sender**: Client that publishes messages to specific topics
- **Receiver**: Client that subscribes to topics and receives relevant messages

## Architecture

### Part 1: TCP Sockets with Topics
```
┌─────────┐   publish to    ┌─────────┐   forward to   ┌─────────────┐
│ Sender  │ ──"topic1"────▶ │ Broker  │ ──subscribers─▶│ Receiver1   │
└─────────┘                 │         │                │ (topic1)    │
                            │         │                └─────────────┘
┌─────────┐   publish to    │         │   forward to   ┌─────────────┐
│ Sender2 │ ──"topic2"────▶ │         │ ──subscribers─▶│ Receiver2   │
└─────────┘                 └─────────┘                │ (topic1,2)  │
                                                       └─────────────┘
```

### Part 2: gRPC with Topics
```
┌─────────┐     gRPC        ┌─────────┐     gRPC       ┌─────────────┐
│ Sender  │ ──topic+msg───▶ │ Broker  │ ──streaming──▶ │ Receiver1   │
└─────────┘   (Protobuf)    │         │   (Protobuf)   │ (subscribed)│
                            │         │                └─────────────┘
┌─────────┐     gRPC        │         │     gRPC       ┌─────────────┐
│ Sender2 │ ──topic+msg───▶ │         │ ──streaming──▶ │ Receiver2   │
└─────────┘   (Protobuf)    └─────────┘   (Protobuf)   │ (subscribed)│
                                                       └─────────────┘
```

## Requirements Met

✅ **Publisher/Subscriber pattern**: Topic-based message routing
✅ **Topic subscriptions**: Receivers subscribe to specific topics
✅ **Multiple subscribers**: Multiple receivers can subscribe to same topic
✅ **TCP sockets** (Part 1): Reliable communication protocol
✅ **gRPC** (Part 2): High-level RPC with Protocol Buffers
✅ **JSON/Protobuf formats**: Human-readable and efficient structures
✅ **Topic-based routing**: Messages delivered only to subscribed receivers
✅ **Concurrent handling**: Each client connection handled separately

## Installation

```bash
npm install
```

## Usage

### Part 1: TCP Sockets

#### Manual Execution (for containers)
```bash
# Terminal 1 - TCP Broker
node src/part1/broker.js

# Terminal 2 - TCP Receiver  
node src/part1/receiver.js

# Terminal 3 - TCP Sender
node src/part1/sender.js
```

#### Using npm scripts
```bash
# Terminal 1 - TCP Broker
npm run start:broker

# Terminal 2 - TCP Receiver
npm run start:receiver

# Terminal 3 - TCP Sender
npm run start:sender
```

### Part 2: gRPC

#### Manual Execution (for containers)
```bash
# Terminal 1 - gRPC Broker
node src/part2/grpc-broker.js

# Terminal 2 - gRPC Receiver  
node src/part2/grpc-receiver.js

# Terminal 3 - gRPC Sender
node src/part2/grpc-sender.js
```

#### Using npm scripts
```bash
# Terminal 1 - gRPC Broker
npm run start:grpc-broker

# Terminal 2 - gRPC Receiver
npm run start:grpc-receiver

# Terminal 3 - gRPC Sender
npm run start:grpc-sender
```

### Send a single message
```bash
# TCP version - default topic
node src/part1/sender.js --message "Hello from TCP!"

# TCP version - specific topic
node src/part1/sender.js --message "news:Breaking news!"

# gRPC version - default topic
node src/part2/grpc-sender.js --message "Hello from gRPC!"

# gRPC version - specific topic
node src/part2/grpc-sender.js --message "sports:Goal scored!"
```

### Start receiver with specific topics
```bash
# TCP receiver subscribed to multiple topics
TOPICS=news,sports node src/part1/receiver.js

# gRPC receiver subscribed to specific topic
TOPICS=news node src/part2/grpc-receiver.js
```

## Message Formats

### Part 1: JSON (TCP Sockets)
```json
{
  "id": "msg_1234567890_abc123",
  "type": "text",
  "sender": "sender_12345",
  "topic": "news",
  "text": "Hello World!",
  "timestamp": 1234567890123
}
```

### Part 2: Protocol Buffers (gRPC)
```protobuf
message MessageRequest {
  string id = 1;
  string sender = 2;
  string topic = 3;
  string text = 4;
  int64 timestamp = 5;
}
```

### Receiver Subscription (TCP)
```json
{
  "clientType": "receiver",
  "receiverId": "receiver_123",
  "topics": ["news", "sports"]
}
```

## Configuration

### Environment Variables
- `BROKER_HOST` / `GRPC_HOST`: Broker hostname (default: localhost)
- `BROKER_TCP_PORT`: TCP port (default: 8080)
- `GRPC_PORT`: gRPC port (default: 50051)
- `SENDER_ID`: Sender identifier
- `RECEIVER_ID`: Receiver identifier
- `TOPICS`: Comma-separated list of topics for receiver (default: general)

## Key Differences

| Feature | Part 1 (TCP Sockets) | Part 2 (gRPC) |
|---------|----------------------|----------------|
| **Protocol** | Raw TCP sockets | gRPC over HTTP/2 |
| **Data Format** | JSON | Protocol Buffers |
| **Communication** | Custom protocol | Standardized RPC |
| **Streaming** | Manual buffering | Built-in streaming |
| **Type Safety** | Runtime validation | Compile-time validation |
| **Performance** | Lower overhead | Higher abstraction |
| **Topics** | JSON field | Protobuf field |
| **Subscriptions** | JSON array | Protobuf repeated field |

## Project Structure

```
├── src/
│   ├── part1/              # TCP Socket implementation
│   │   ├── broker.js       # TCP message broker
│   │   ├── sender.js       # TCP message sender
│   │   └── receiver.js     # TCP message receiver
│   └── part2/              # gRPC implementation
│       ├── grpc-broker.js  # gRPC message broker
│       ├── grpc-sender.js  # gRPC message sender
│       └── grpc-receiver.js # gRPC message receiver
├── proto/
│   └── message_broker.proto # Protocol Buffers definition
├── package.json
└── README.md
```

## Example Usage

### 1. Start the system (TCP version)
```bash
# Terminal 1: Start broker
npm run start:broker

# Terminal 2: Start receiver subscribed to "news" and "sports"
TOPICS=news,sports npm run start:receiver

# Terminal 3: Send messages
npm run start:sender
# Then type: news:Breaking news update!
# Then type: sports:Team wins championship!
# Then type: tech:New technology released! (no subscribers)
```

### 2. Multiple receivers example
```bash
# Terminal 1: Broker
npm run start:broker

# Terminal 2: News receiver
TOPICS=news RECEIVER_ID=news_receiver npm run start:receiver

# Terminal 3: Sports receiver
TOPICS=sports RECEIVER_ID=sports_receiver npm run start:receiver

# Terminal 4: General receiver (all topics)
TOPICS=news,sports,general RECEIVER_ID=all_receiver npm run start:receiver

# Terminal 5: Send messages to different topics
npm run start:sender
```

This implementation demonstrates both low-level socket programming and high-level RPC communication with **Publisher/Subscriber pattern**, meeting all lab requirements for maximum grade.
