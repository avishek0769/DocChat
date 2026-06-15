import "dotenv/config";
import { app } from "./app.js";
import connectDB from "./utils/connectDB.js";
import validateEnv from "./utils/validateEnv.js";

validateEnv();
connectDB()
    .then(async () => {
        app.on("error", (error) => {
            console.log("Server issue: ", error);
        });

        app.listen(process.env.PORT, () => {
            console.log(`Server running at: ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.log("DATABASE connection Failed: ", error);
        process.exit(1);
    });
