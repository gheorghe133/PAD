const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "../../proto/message_broker.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const messagebroker =
  grpc.loadPackageDefinition(packageDefinition).messagebroker;

class GrpcMessageReceiver {
  constructor(options = {}) {
    this.brokerHost = options.brokerHost || "localhost";
    this.brokerPort = options.brokerPort || 50051;
    this.receiverId = options.receiverId || `receiver_${Date.now()}`;
    this.topics = options.topics || ["general"];

    this.client = null;
    this.messageStream = null;
    this.isConnected = false;

    this.stats = {
      messagesReceived: 0,
    };
  }

  /**
   * Connect to the gRPC broker
   */
  async connect() {
    const address = `${this.brokerHost}:${this.brokerPort}`;

    this.client = new messagebroker.MessageBroker(
      address,
      grpc.credentials.createInsecure()
    );

    console.log(`Connecting to gRPC broker at ${address}`);

    return new Promise((resolve, reject) => {
      this.client.RegisterClient(
        {
          client_type: "receiver",
          client_id: this.receiverId,
          topics: this.topics,
        },
        (error, response) => {
          if (error) {
            console.error("Failed to register with broker:", error);
            reject(error);
            return;
          }

          if (response.success) {
            console.log(`✓ Registered as receiver: ${response.assigned_id}`);
            this.isConnected = true;
            this.startReceiving();
            resolve();
          } else {
            console.error("Registration failed:", response.message);
            reject(new Error(response.message));
          }
        }
      );
    });
  }

  /**
   * Start receiving messages via streaming
   */
  startReceiving() {
    console.log("\n=== gRPC Message Receiver ===");
    console.log(`Subscribed to topics: ${this.topics.join(", ")}`);
    console.log("Waiting for messages...");
    console.log("Press Ctrl+C to exit.\n");

    this.messageStream = this.client.ReceiveMessages({
      receiver_id: this.receiverId,
    });

    this.messageStream.on("data", (message) => {
      this.handleIncomingMessage(message);
    });

    this.messageStream.on("end", () => {
      console.log("Message stream ended");
    });

    this.messageStream.on("error", (error) => {
      console.error("Message stream error:", error);
    });

    this.messageStream.on("status", (status) => {
      console.log("Stream status:", status);
    });
  }

  /**
   * Handle incoming messages
   */
  handleIncomingMessage(message) {
    this.stats.messagesReceived++;

    console.log(`\n← Received message: ${message.id}`);
    console.log(`   From: ${message.sender}`);
    console.log(`   Topic: ${message.topic || "no-topic"}`);
    console.log(`   Text: ${message.text}`);
    console.log(
      `   Timestamp: ${new Date(parseInt(message.timestamp)).toLocaleString()}`
    );

    this.sendAcknowledgment(message.id);
  }

  /**
   * Send acknowledgment for received message
   */
  sendAcknowledgment(messageId) {
    this.client.AckMessage(
      {
        message_id: messageId,
        receiver_id: this.receiverId,
        status: "received",
      },
      (error, response) => {
        if (error) {
          console.error("Failed to send acknowledgment:", error);
        } else if (response.success) {
          console.log(`   ✓ Sent acknowledgment for message: ${messageId}`);
        }
      }
    );
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.messageStream) {
      this.messageStream.cancel();
      this.messageStream = null;
    }

    if (this.client) {
      this.client.close();
    }

    this.isConnected = false;
    console.log("Disconnected from gRPC broker");
  }
}

if (require.main === module) {
  const topics = process.env.TOPICS
    ? process.env.TOPICS.split(",")
    : ["general"];

  const receiver = new GrpcMessageReceiver({
    brokerHost: process.env.GRPC_HOST || "localhost",
    brokerPort: process.env.GRPC_PORT || 50051,
    receiverId: process.env.RECEIVER_ID || `receiver_${Date.now()}`,
    topics: topics,
  });

  async function main() {
    try {
      await receiver.connect();

      process.on("SIGINT", () => {
        console.log("\nShutting down gRPC receiver...");
        receiver.disconnect();
        process.exit(0);
      });

      process.on("exit", () => {
        receiver.disconnect();
      });
    } catch (error) {
      console.error("gRPC Receiver error:", error);
      process.exit(1);
    }
  }

  main();
}

module.exports = GrpcMessageReceiver;
