const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const readline = require("readline");
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

class GrpcMessageSender {
  constructor(options = {}) {
    this.brokerHost = options.brokerHost || "localhost";
    this.brokerPort = options.brokerPort || 50051;
    this.senderId = options.senderId || `sender_${Date.now()}`;

    this.client = null;
    this.isConnected = false;

    this.stats = {
      messagesSent: 0,
      messagesAcked: 0,
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
          client_type: "sender",
          client_id: this.senderId,
        },
        (error, response) => {
          if (error) {
            console.error("Failed to register with broker:", error);
            reject(error);
            return;
          }

          if (response.success) {
            console.log(`✓ Registered as sender: ${response.assigned_id}`);
            this.isConnected = true;
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
   * Send a message with topic to the broker
   */
  async sendMessage(text, topic = "general") {
    if (!this.isConnected) {
      throw new Error("Not connected to broker");
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sender: this.senderId,
      topic: topic,
      text: text,
      timestamp: Date.now().toString(),
    };

    return new Promise((resolve, reject) => {
      this.client.SendMessage(message, (error, response) => {
        if (error) {
          console.error("Failed to send message:", error);
          reject(error);
          return;
        }

        this.stats.messagesSent++;

        if (response.success) {
          this.stats.messagesAcked++;
          console.log(`→ Sent message: ${message.id}`);
          console.log(`  Topic: ${topic}`);
          console.log(`  Text: ${text}`);
          console.log(`✓ ${response.message}`);
        } else {
          console.log(`→ Sent message: ${message.id}`);
          console.log(`  Topic: ${topic}`);
          console.log(`  Text: ${text}`);
          console.log(`✗ ${response.message}`);
        }

        resolve(message.id);
      });
    });
  }

  /**
   * Start interactive mode
   */
  startInteractiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n=== gRPC Message Sender ===");
    console.log("Type your message and press Enter to send it.");
    console.log(
      "Format: 'topic:message' or just 'message' (uses 'general' topic)"
    );
    console.log("Type 'stats' to see statistics.");
    console.log("Type 'quit' to exit.");
    console.log("");

    const promptUser = () => {
      rl.question("Enter message: ", async (input) => {
        const trimmedInput = input.trim();

        if (trimmedInput.toLowerCase() === "quit") {
          console.log("Goodbye!");
          rl.close();
          this.disconnect();
          process.exit(0);
        }

        if (trimmedInput.toLowerCase() === "stats") {
          console.log("Statistics:", this.stats);
          promptUser();
          return;
        }

        if (trimmedInput) {
          try {
            let topic = "general";
            let message = trimmedInput;

            if (trimmedInput.includes(":")) {
              const parts = trimmedInput.split(":", 2);
              topic = parts[0].trim();
              message = parts[1].trim();
            }

            await this.sendMessage(message, topic);
          } catch (error) {
            console.error("Error sending message:", error.message);
          }
        }

        promptUser();
      });
    };

    promptUser();
    return rl;
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.client) {
      this.client.close();
    }
    this.isConnected = false;
    console.log("Disconnected from gRPC broker");
  }
}

if (require.main === module) {
  const sender = new GrpcMessageSender({
    brokerHost: process.env.GRPC_HOST || "localhost",
    brokerPort: process.env.GRPC_PORT || 50051,
    senderId: process.env.SENDER_ID || `sender_${Date.now()}`,
  });

  async function main() {
    try {
      await sender.connect();

      const messageIndex = process.argv.findIndex((arg) => arg === "--message");
      if (messageIndex !== -1 && process.argv[messageIndex + 1]) {
        const input = process.argv[messageIndex + 1];

        let topic = "general";
        let message = input;

        if (input.includes(":")) {
          const parts = input.split(":", 2);
          topic = parts[0].trim();
          message = parts[1].trim();
        }

        await sender.sendMessage(message, topic);
        console.log("Message sent successfully");
        sender.disconnect();
        process.exit(0);
      } else {
        const rl = sender.startInteractiveMode();

        process.on("SIGINT", () => {
          console.log("\nShutting down gRPC sender...");
          rl.close();
          sender.disconnect();
          process.exit(0);
        });
      }
    } catch (error) {
      console.error("gRPC Sender error:", error);
      process.exit(1);
    }
  }

  main();
}

module.exports = GrpcMessageSender;
