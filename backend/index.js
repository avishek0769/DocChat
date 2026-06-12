import "dotenv/config";
import { app } from "./app.js";
import connectDB from "./utils/connectDB.js";
import logger from "./utils/logger.js";

connectDB()
  .then(async () => {
    app.on("error", (error) => {
      logger.error({ err: error }, "Server issue");
    });

    app.listen(process.env.PORT, () => {
      logger.info(`Server running at: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    logger.error({ err: error }, "DATABASE connection Failed");
    process.exit(1);
  });
