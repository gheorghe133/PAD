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

class GrpcMessageBroker {
  constructor(options = {}) {
    this.port = options.port || 50051;
    this.host = options.host || "0.0.0.0";

    this.senderClient = null;
    this.receivers = new Map();
    this.topicSubscriptions = new Map();

    this.stats = {
      messagesReceived: 0,
      messagesDelivered: 0,
      clientsRegistered: 0,
    };

    this.server = new grpc.Server();
    this.setupServices();
  }

  /**
   * Setup gRPC service implementations
   */
  setupServices() {
    this.server.addService(messagebroker.MessageBroker.service, {
      RegisterClient: this.registerClient.bind(this),
      SendMessage: this.sendMessage.bind(this),
      ReceiveMessages: this.receiveMessages.bind(this),
      AckMessage: this.ackMessage.bind(this),
    });
  }

  /**
   * Register a client (sender or receiver)
   */
  registerClient(call, callback) {
    const { client_type, client_id, topics } = call.request;

    console.log(`Registering ${client_type}: ${client_id}`);

    if (client_type === "sender") {
      this.senderClient = { id: client_id, call };
    } else if (client_type === "receiver") {
      const receiverTopics = topics || ["general"];

      this.receivers.set(client_id, { stream: null, topics: receiverTopics });

      receiverTopics.forEach((topic) => {
        if (!this.topicSubscriptions.has(topic)) {
          this.topicSubscriptions.set(topic, new Set());
        }
        this.topicSubscriptions.get(topic).add(client_id);
      });

      console.log(
        `Receiver subscribed to topics: ${receiverTopics.join(", ")}`
      );
    }

    this.stats.clientsRegistered++;

    callback(null, {
      success: true,
      message: `${client_type} registered successfully`,
      assigned_id: client_id,
    });
  }

  /**
   * Handle message sending from sender
   */
  sendMessage(call, callback) {
    const message = call.request;
    this.stats.messagesReceived++;

    console.log(
      `Received message: ${message.id} for topic: ${
        message.topic || "no-topic"
      }`
    );
    console.log(`  Text: ${message.text}`);

    const topic = message.topic;
    if (!topic) {
      console.log("Message has no topic, dropping");
      callback(null, {
        success: false,
        message: "Message must have a topic",
        message_id: message.id,
      });
      return;
    }

    const subscribers = this.topicSubscriptions.get(topic);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for topic: ${topic}`);
      callback(null, {
        success: false,
        message: `No subscribers for topic: ${topic}`,
        message_id: message.id,
      });
      return;
    }

    let deliveredCount = 0;
    subscribers.forEach((receiverId) => {
      const receiverData = this.receivers.get(receiverId);
      if (receiverData && receiverData.stream) {
        try {
          receiverData.stream.write({
            id: message.id,
            sender: message.sender,
            topic: message.topic,
            text: message.text,
            timestamp: message.timestamp,
          });
          deliveredCount++;
        } catch (error) {
          console.error(`Error forwarding to ${receiverId}:`, error);
        }
      }
    });

    this.stats.messagesDelivered += deliveredCount;
    console.log(
      `Message forwarded to ${deliveredCount} subscribers of topic: ${topic}`
    );

    callback(null, {
      success: true,
      message: "Message delivered successfully",
      message_id: message.id,
    });
  }

  /**
   * Handle receiver connection for streaming messages
   */
  receiveMessages(call) {
    const { receiver_id } = call.request;
    console.log(`Receiver ${receiver_id} connected for streaming`);

    const receiverData = this.receivers.get(receiver_id);
    if (receiverData) {
      receiverData.stream = call;
    }

    call.on("cancelled", () => {
      console.log(`Receiver ${receiver_id} disconnected`);
      const receiverData = this.receivers.get(receiver_id);
      if (receiverData) {
        receiverData.topics.forEach((topic) => {
          const subscribers = this.topicSubscriptions.get(topic);
          if (subscribers) {
            subscribers.delete(receiver_id);
            if (subscribers.size === 0) {
              this.topicSubscriptions.delete(topic);
            }
          }
        });
        this.receivers.delete(receiver_id);
      }
    });

    call.on("error", (error) => {
      console.error(`Receiver stream error:`, error);
      const receiverData = this.receivers.get(receiver_id);
      if (receiverData) {
        receiverData.stream = null;
      }
    });
  }

  /**
   * Handle message acknowledgments
   */
  ackMessage(call, callback) {
    const { message_id, receiver_id, status } = call.request;
    console.log(
      `Received ACK for message ${message_id} from ${receiver_id}: ${status}`
    );

    callback(null, {
      success: true,
      message: "Acknowledgment received",
    });
  }

  /**
   * Start the gRPC server
   */
  start() {
    return new Promise((resolve, reject) => {
      const bindAddress = `${this.host}:${this.port}`;

      this.server.bindAsync(
        bindAddress,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            reject(error);
            return;
          }

          this.server.start();
          console.log(`gRPC Message Broker started on ${bindAddress}`);
          console.log(`Server listening on port ${port}`);
          resolve();
        }
      );
    });
  }

  /**
   * Stop the gRPC server
   */
  stop() {
    return new Promise((resolve) => {
      this.server.tryShutdown((error) => {
        if (error) {
          console.error("Error stopping server:", error);
        } else {
          console.log("gRPC Message Broker stopped");
        }
        resolve();
      });
    });
  }
}

if (require.main === module) {
  const broker = new GrpcMessageBroker({
    port: process.env.GRPC_PORT || 50051,
    host: process.env.GRPC_HOST || "0.0.0.0",
  });

  async function main() {
    try {
      await broker.start();

      process.on("SIGINT", async () => {
        console.log("\nShutting down gRPC broker...");
        await broker.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error("Failed to start gRPC broker:", error);
      process.exit(1);
    }
  }

  main();
}

module.exports = GrpcMessageBroker;
