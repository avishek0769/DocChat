import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import logger from "./utils/logger.js";
import {
    metricsMiddleware,
    metricsAuthMiddleware,
    checkHealth,
    getPrometheusMetrics,
    contentType,
} from "./utils/metrics.js";

const app = express();

app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || uuidv4();
  res.setHeader("x-request-id", req.id);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.use(metricsMiddleware);

// NOTE: /healthz and /metrics endpoints are registered here before standard middleware (cors, express.json, etc.)
// to minimize processing overhead and ensure fast responses for monitoring tools.
// If global middleware such as rate limiters or IP allow-lists are added later,
// ensure they are registered before these endpoints if they should apply.

// Health check endpoint
app.get("/healthz", async (req, res) => {
    const { isHealthy, status } = await checkHealth();
    res.status(isHealthy ? 200 : 503).json(status);
});

// Prometheus metrics endpoint
app.get("/metrics", metricsAuthMiddleware, async (req, res) => {
    try {
        const metrics = await getPrometheusMetrics();
        res.set("Content-Type", contentType);
        res.send(metrics);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  logger.error({ requestId: req.id, err }, "Unhandled error");
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
