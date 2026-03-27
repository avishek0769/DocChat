import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.log(err);
    res.status(statusCode).json({ message });
};

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        methods: process.env.CORS_METHODS,
        credentials: true,
    }),
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

// Routes
import userRouter from "./routers/user.route.js";
app.use("/api/v1/user", userRouter);

import apikeyRouter from "./routers/apikey.route.js";
app.use("/api/v1/apikey", apikeyRouter);

import chatRouter from "./routers/chat.route.js";
app.use("/api/v1/chat", chatRouter);

app.use(errorHandler);

export { app };
