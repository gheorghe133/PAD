# Message Broker Lab - PDA Lab 1

Message broker system implementing **Publisher/Subscriber pattern** using **TCP Sockets** and **gRPC**.

## Architecture

### Components
- **Broker**: Central message routing based on topics
- **Sender**: Publishes messages to topics
- **Receiver**: Subscribes to topics and receives messages

### Part 1: TCP Sockets
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

### Part 2: gRPC
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

## Usage

```bash
# Install dependencies
npm install

# TCP Version
npm run start:broker        # Terminal 1
npm run start:receiver      # Terminal 2
npm run start:sender        # Terminal 3

# gRPC Version
npm run start:grpc-broker   # Terminal 1
npm run start:grpc-receiver # Terminal 2
npm run start:grpc-sender   # Terminal 3

# Send single message
node src/part1/sender.js --message "news:Breaking news!"
node src/part2/grpc-sender.js --message "sports:Goal scored!"

# Receiver with specific topics
TOPICS=news,sports node src/part1/receiver.js
```

## Message Schemas

### TCP JSON Format
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

### gRPC Protocol Buffers
```protobuf
message MessageRequest {
  string id = 1;
  string sender = 2;
  string topic = 3;
  string text = 4;
  int64 timestamp = 5;
}
```

### Receiver Subscription
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
- `TOPICS`: Comma-separated topics for receiver (default: general)

### Topic System
- **Dynamic Topics**: Any topic name can be used
- **Default Topic**: "general" when no topic specified
- **Format**: `"topic:message"` or `"message"` for default
- **Routing**: Messages only reach subscribed receivers

## Implementation Comparison

| Feature | TCP Sockets | gRPC |
|---------|-------------|------|
| **Protocol** | Raw TCP | HTTP/2 |
| **Data Format** | JSON | Protocol Buffers |
| **Streaming** | Manual | Built-in |
| **Type Safety** | Runtime | Compile-time |

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
