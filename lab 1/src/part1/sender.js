const net = require("net");
const readline = require("readline");

class MessageSender {
  constructor(options = {}) {
    this.brokerHost = options.brokerHost || "localhost";
    this.brokerTcpPort = options.brokerTcpPort || 8080;
    this.senderId = options.senderId || `sender_${Date.now()}`;

    this.tcpSocket = null;
    this.isConnected = false;

    this.stats = {
      messagesSent: 0,
      messagesAcked: 0,
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
          clientType: "sender",
          senderId: this.senderId,
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
            this.handleBrokerResponse(messageStr);
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
   * Handle responses from broker
   */
  handleBrokerResponse(data) {
    try {
      const response = JSON.parse(data);

      switch (response.type) {
        case "welcome":
          console.log(`✓ Connected as ${response.role}`);
          break;

        case "ack":
          this.stats.messagesAcked++;
          console.log(`✓ Message acknowledged: ${response.originalMessageId}`);
          if (response.subscribersCount !== undefined) {
            console.log(
              `  Delivered to ${response.subscribersCount} subscribers`
            );
          }
          break;

        case "error":
          console.error(`✗ Broker error: ${response.error}`);
          break;

        default:
          console.log("Received from broker:", response);
      }
    } catch (error) {
      console.error("Error parsing broker response:", error);
    }
  }

  /**
   * Send a message with topic to the broker
   */
  async sendMessage(text, topic = "general") {
    if (!this.isConnected) {
      throw new Error("Not connected to broker");
    }

    try {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: "text",
        sender: this.senderId,
        topic: topic,
        text: text,
        timestamp: Date.now(),
      };

      const messageStr = JSON.stringify(message) + "\n";
      this.tcpSocket.write(messageStr);

      this.stats.messagesSent++;
      console.log(`→ Sent message: ${message.id}`);
      console.log(`  Topic: ${topic}`);
      console.log(`  Text: ${text}`);

      return message.id;
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
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
   * Start interactive mode
   */
  startInteractiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n=== Simple Message Sender ===");
    console.log("Type your message and press Enter to send it.");
    console.log(
      "Format: 'topic:message' or just 'message' (uses 'general' topic)"
    );
    console.log("Type 'quit' to exit.");
    console.log("");

    const promptUser = () => {
      rl.question("Enter message: ", async (input) => {
        if (input.trim().toLowerCase() === "quit") {
          console.log("Goodbye!");
          rl.close();
          this.disconnect();
          process.exit(0);
        }

        try {
          const trimmedInput = input.trim();
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
        promptUser();
      });
    };

    promptUser();
    return rl;
  }
}

if (require.main === module) {
  const sender = new MessageSender({
    brokerHost: process.env.BROKER_HOST || "localhost",
    brokerTcpPort: process.env.BROKER_TCP_PORT || 8080,
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
          console.log("\nShutting down sender...");
          rl.close();
          sender.disconnect();
          process.exit(0);
        });
      }
    } catch (error) {
      console.error("Sender error:", error);
      process.exit(1);
    }
  }

  main();
}
