const net = require("net");

class MessageReceiver {
  constructor(options = {}) {
    this.brokerHost = options.brokerHost || "localhost";
    this.brokerTcpPort = options.brokerTcpPort || 8080;
    this.receiverId = options.receiverId || `receiver_${Date.now()}`;
    this.topics = options.topics || ["general"];

    this.tcpSocket = null;
    this.isConnected = false;

    this.stats = {
      messagesReceived: 0,
    };
  }

  /**
   * Connect to the broker
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.tcpSocket = new net.Socket();

      this.tcpSocket.connect(this.brokerTcpPort, this.brokerHost, () => {
        console.log(
          `Connected to broker at ${this.brokerHost}:${this.brokerTcpPort}`
        );

        const identifyMessage = {
          clientType: "receiver",
          receiverId: this.receiverId,
          topics: this.topics,
        };
        this.tcpSocket.write(JSON.stringify(identifyMessage) + "\n");
        this.isConnected = true;
        resolve();
      });

      let buffer = "";
      this.tcpSocket.on("data", (data) => {
        buffer += data.toString();
        const messages = buffer.split("\n");
        buffer = messages.pop();

        for (const messageStr of messages) {
          if (messageStr.trim()) {
            this.handleIncomingMessage(messageStr);
          }
        }
      });

      this.tcpSocket.on("close", () => {
        console.log("Connection closed");
        this.isConnected = false;
      });

      this.tcpSocket.on("error", (error) => {
        console.error("Connection error:", error);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  /**
   * Handle incoming messages from broker
   */
  handleIncomingMessage(messageStr) {
    try {
      this.stats.messagesReceived++;
      const message = JSON.parse(messageStr);

      if (message.type === "welcome") {
        console.log(`✓ Connected as ${message.role}`);
        if (message.topics) {
          console.log(`✓ Subscribed to topics: ${message.topics.join(", ")}`);
        }
        return;
      }

      if (message.type === "error") {
        console.error(`✗ Broker error: ${message.error}`);
        return;
      }

      console.log(`\n← Received message: ${message.id}`);
      console.log(`   From: ${message.sender}`);
      console.log(`   Topic: ${message.topic || "no-topic"}`);
      console.log(`   Text: ${message.text}`);
      console.log(
        `   Timestamp: ${new Date(message.timestamp).toLocaleString()}`
      );
    } catch (error) {
      console.error("Error handling incoming message:", error);
    }
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.tcpSocket) {
      this.tcpSocket.end();
    }
    this.isConnected = false;
    console.log("Disconnected from broker");
  }

  /**
   * Start listening for messages
   */
  startListening() {
    console.log("\n=== Simple Message Receiver ===");
    console.log(`Subscribed to topics: ${this.topics.join(", ")}`);
    console.log("Waiting for messages...");
    console.log("Press Ctrl+C to exit.\n");
  }
}

if (require.main === module) {
  const topics = process.env.TOPICS
    ? process.env.TOPICS.split(",")
    : ["general"];

  const receiver = new MessageReceiver({
    brokerHost: process.env.BROKER_HOST || "localhost",
    brokerTcpPort: process.env.BROKER_TCP_PORT || 8080,
    receiverId: process.env.RECEIVER_ID || `receiver_${Date.now()}`,
    topics: topics,
  });

  async function main() {
    try {
      await receiver.connect();
      receiver.startListening();

      process.on("SIGINT", () => {
        console.log("\nShutting down receiver...");
        receiver.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error("Receiver error:", error);
      process.exit(1);
    }
  }

  main();
}
