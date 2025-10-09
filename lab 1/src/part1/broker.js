const net = require("net");

class MessageBroker {
  constructor(options = {}) {
    this.tcpPort = options.tcpPort || 8080;
    this.host = options.host || "localhost";

    this.senderSocket = null;
    this.receivers = new Map();
    this.topicSubscriptions = new Map();

    this.tcpServer = null;

    this.stats = {
      messagesReceived: 0,
      messagesDelivered: 0,
    };
  }

  /**
   * Start the broker server
   */
  async start() {
    try {
      await this.startTcpServer();
      console.log(`Message Broker started on ${this.host}:${this.tcpPort}`);
    } catch (error) {
      console.error("Failed to start broker:", error);
      throw error;
    }
  }

  /**
   * Identify client type based on first message
   */
  identifyClient(socket, data) {
    try {
      const message = JSON.parse(data.toString().trim());
      if (message.clientType === "sender") {
        this.senderSocket = socket;
        console.log("Sender connected");
        socket.write(
          JSON.stringify({ type: "welcome", role: "sender" }) + "\n"
        );
      } else if (message.clientType === "receiver") {
        const receiverId = message.receiverId;
        const topics = message.topics || [];

        this.receivers.set(receiverId, { socket, topics });

        topics.forEach((topic) => {
          if (!this.topicSubscriptions.has(topic)) {
            this.topicSubscriptions.set(topic, new Set());
          }
          this.topicSubscriptions.get(topic).add(receiverId);
        });

        console.log(
          `Receiver connected: ${receiverId}, subscribed to: ${topics.join(
            ", "
          )}`
        );
        socket.write(
          JSON.stringify({ type: "welcome", role: "receiver", topics }) + "\n"
        );
      }
    } catch (error) {
      console.error("Error identifying client:", error);
    }
  }

  /**
   * Start TCP server
   */
  startTcpServer() {
    return new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => {
        console.log(
          `Client connected: ${socket.remoteAddress}:${socket.remotePort}`
        );

        let buffer = "";
        let clientIdentified = false;

        socket.on("data", (data) => {
          buffer += data.toString();

          const messages = buffer.split("\n");
          buffer = messages.pop();

          for (const messageStr of messages) {
            if (messageStr.trim()) {
              if (!clientIdentified) {
                this.identifyClient(socket, messageStr);
                clientIdentified = true;
              } else {
                this.handleMessage(messageStr, socket);
              }
            }
          }
        });

        socket.on("close", () => {
          console.log("Client disconnected");
          if (socket === this.senderSocket) {
            this.senderSocket = null;
          } else {
            for (const [receiverId, receiverData] of this.receivers.entries()) {
              if (receiverData.socket === socket) {
                receiverData.topics.forEach((topic) => {
                  const subscribers = this.topicSubscriptions.get(topic);
                  if (subscribers) {
                    subscribers.delete(receiverId);
                    if (subscribers.size === 0) {
                      this.topicSubscriptions.delete(topic);
                    }
                  }
                });
                this.receivers.delete(receiverId);
                console.log(`Receiver ${receiverId} disconnected`);
                break;
              }
            }
          }
        });

        socket.on("error", (error) => {
          console.error("Client error:", error);
        });
      });

      this.tcpServer.listen(this.tcpPort, this.host, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming message and route to subscribers
   */
  handleMessage(messageStr, senderSocket) {
    try {
      const message = JSON.parse(messageStr);
      this.stats.messagesReceived++;

      console.log(
        `Received message: ${message.id || "no-id"} for topic: ${
          message.topic || "no-topic"
        }`
      );

      const topic = message.topic;
      if (!topic) {
        console.log("Message has no topic, dropping");
        const error = {
          type: "error",
          error: "Message must have a topic",
        };
        senderSocket.write(JSON.stringify(error) + "\n");
        return;
      }

      const subscribers = this.topicSubscriptions.get(topic);
      if (!subscribers || subscribers.size === 0) {
        console.log(`No subscribers for topic: ${topic}`);
        const error = {
          type: "error",
          error: `No subscribers for topic: ${topic}`,
        };
        senderSocket.write(JSON.stringify(error) + "\n");
        return;
      }

      let deliveredCount = 0;
      subscribers.forEach((receiverId) => {
        const receiverData = this.receivers.get(receiverId);
        if (receiverData && receiverData.socket) {
          receiverData.socket.write(messageStr + "\n");
          deliveredCount++;
        }
      });

      this.stats.messagesDelivered += deliveredCount;
      console.log(
        `Message forwarded to ${deliveredCount} subscribers of topic: ${topic}`
      );

      const ack = {
        type: "ack",
        originalMessageId: message.id,
        status: "delivered",
        subscribersCount: deliveredCount,
      };
      senderSocket.write(JSON.stringify(ack) + "\n");
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  /**
   * Stop the broker
   */
  stop() {
    if (this.tcpServer) {
      this.tcpServer.close();
    }
    console.log("Message Broker stopped");
  }
}

if (require.main === module) {
  const broker = new MessageBroker({
    tcpPort: process.env.BROKER_TCP_PORT || 8080,
    host: process.env.BROKER_HOST || "0.0.0.0",
  });

  broker.start().catch(console.error);

  process.on("SIGINT", () => {
    console.log("\nShutting down broker...");
    broker.stop();
    process.exit(0);
  });
}

module.exports = MessageBroker;
