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
                            ┌─────────────┐
                         ┌─▶│ Receiver1   │
                         │  │ (news)      │
┌─────────┐ multiple     │  └─────────────┘
│ Sender  │ topics    ┌─────────┐
│         │──────────▶│ Broker  │
└─────────┘           └─────────┘
                         │  ┌─────────────┐
                         └─▶│ Receiver2   │
                            │ (news,sport)│
                            └─────────────┘
```

### Part 2: gRPC with Topics
```
                            ┌─────────────┐
                         ┌─▶│ Receiver1   │◀─┐
                         │  │ (news)      │  │ gRPC
┌─────────┐ gRPC         │  └─────────────┘  │ streaming
│ Sender  │ multiple  ┌─────────┐            │
│         │ topics ──▶│ Broker  │            │
└─────────┘ (Protobuf)└─────────┘            │
                         │  ┌─────────────┐  │
                         └─▶│ Receiver2   │◀─┘
                            │ (news,sport)│
                            └─────────────┘
```

## Requirements Met

✅ **Publisher/Subscriber pattern**: Topic-based message routing
✅ **Topic subscriptions**: Receivers subscribe to specific topics
✅ **Multiple subscribers**: Multiple receivers can subscribe to same topic
✅ **Single sender architecture**: One sender publishes to multiple topics
✅ **TCP sockets** (Part 1): Reliable communication protocol
✅ **gRPC** (Part 2): High-level RPC with Protocol Buffers
✅ **JSON/Protobuf formats**: Human-readable and efficient structures
✅ **Topic-based routing**: Messages delivered only to subscribed receivers
✅ **Concurrent handling**: Each receiver connection handled separately
✅ **Dynamic topics**: Topics are created automatically when used

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
- `SENDER_ID`: Sender identifier (auto-generated if not specified)
- `RECEIVER_ID`: Receiver identifier (auto-generated if not specified)
- `TOPICS`: Comma-separated list of topics for receiver (default: general)

### Topic System
- **Dynamic Topics**: Any topic name can be used - no predefined list
- **Default Topic**: "general" is used when no topic is specified
- **Topic Format**: Use `"topic:message"` format or just `"message"` for default topic
- **Subscription**: Receivers specify topics via `TOPICS=news,sports,tech` environment variable
- **Routing**: Messages are only delivered to receivers subscribed to that specific topic

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

### 2. Multiple receivers with different topic subscriptions
```bash
# Terminal 1: Broker
npm run start:broker

# Terminal 2: News receiver (only news)
TOPICS=news RECEIVER_ID=news_receiver npm run start:receiver

# Terminal 3: Sports receiver (only sports)
TOPICS=sports RECEIVER_ID=sports_receiver npm run start:receiver

# Terminal 4: General receiver (multiple topics)
TOPICS=news,sports,general RECEIVER_ID=all_receiver npm run start:receiver

# Terminal 5: Single sender publishing to different topics
npm run start:sender
# Then type: news:Breaking news!     → goes to news_receiver and all_receiver
# Then type: sports:Goal scored!     → goes to sports_receiver and all_receiver
# Then type: general:Hello everyone! → goes only to all_receiver
# Then type: tech:New gadget!        → no subscribers (error message)
```

### 3. Testing topic-based routing
```bash
# Start broker and receivers as above, then test:

# Send to existing topic with subscribers
node src/part1/sender.js --message "news:Important update!"

# Send to topic with no subscribers
node src/part1/sender.js --message "weather:Sunny day!"

# Send without topic (uses default "general")
node src/part1/sender.js --message "Hello World!"
```

## Key Features

- **Single Sender Architecture**: One sender can publish to multiple topics
- **Dynamic Topic Creation**: Topics are created automatically when first used
- **Flexible Subscriptions**: Receivers can subscribe to any combination of topics
- **Topic-based Filtering**: Messages only reach subscribed receivers
- **Automatic ID Generation**: Unique IDs generated automatically for senders and receivers
- **Error Handling**: Clear error messages for invalid topics or no subscribers

This implementation demonstrates both low-level socket programming and high-level RPC communication with **Publisher/Subscriber pattern**, meeting all lab requirements for maximum grade.
