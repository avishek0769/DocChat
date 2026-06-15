import "dotenv/config";
import { app } from "./app.js";
import connectDB from "./utils/connectDB.js";
import logger from "./utils/logger.js";
import { closeChatCreationQueue } from "./utils/queue.js";

connectDB()
  .then(async () => {
    app.on("error", (error) => {
      logger.error({ err: error }, "Server issue");
    });

    const server = app.listen(process.env.PORT, () => {
      logger.info(`Server running at port: ${process.env.PORT}`);
      logger.info(`Health endpoint enabled at: /healthz`);
      logger.info(`Metrics endpoint enabled at: /metrics`);
    });

    const handleShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      server.close(async () => {
        logger.info("HTTP server closed.");
        try {
          await closeChatCreationQueue();
          logger.info("Queue closed successfully.");
        } catch (error) {
          logger.error({ err: error }, "Error closing queue");
        }
        process.exit(0);
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        logger.error("Forceful shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  })
  .catch((error) => {
    logger.error({ err: error }, "DATABASE connection Failed");
    process.exit(1);
  });
