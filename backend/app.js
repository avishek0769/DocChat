import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.log(err);
    // Include errors array when present so the frontend can
    // render structured validation feedback instead of one
    // collapsed generic string (fixes issue #31).
    const body = { message };
    if (Array.isArray(err.errors) && err.errors.length > 0) {
        body.errors = err.errors;
    }
    res.status(statusCode).json(body);
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

import chatMessageRouter from "./routers/chatMessage.route.js";
app.use("/api/v1/message", chatMessageRouter);

import usageRouter from "./routers/usage.route.js";
app.use("/api/v1/usage", usageRouter);

import adminRouter from "./routers/admin.route.js";
app.use("/api/v1/admin", adminRouter);

app.use(errorHandler);

export { app };
