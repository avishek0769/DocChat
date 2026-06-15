import client from "prom-client";
import prisma from "./prismaClient.js";
import redis from "./redis.js";
import { getChatCreationQueue } from "./queue.js";

// Initialize prom-client Registry
const registry = new client.Registry();

// Collect default Node.js process metrics
client.collectDefaultMetrics({ register: registry });

// Express API request latency histogram
const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registers: [registry]
});

// Middleware to record request latency
export const metricsMiddleware = (req, res, next) => {
    if (req.path === "/healthz" || req.path === "/metrics") {
        return next();
    }

    const start = process.hrtime();
    res.on("finish", () => {
        const diff = process.hrtime(start);
        const durationInSeconds = diff[0] + diff[1] / 1e9;
        
        // Use req.route?.path (or fallback) to avoid high cardinality metrics from path parameters
        const route = req.route ? req.route.path : "unmatched";
        httpRequestDuration.observe(
            {
                method: req.method,
                route: route || "unknown",
                status_code: res.statusCode
            },
            durationInSeconds
        );
    });

    next();
};

// Middleware to protect internal metrics endpoint
export const metricsAuthMiddleware = (req, res, next) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
        const authHeader = req.headers["x-metrics-token"] || req.query.token;
        if (authHeader !== token) {
            return res.status(403).send("Forbidden");
        }
    }
    next();
};

// Perform basic dependency checks for /healthz
export async function checkHealth() {
    const status = {
        status: "OK",
        timestamp: new Date().toISOString(),
        services: {
            database: "UP",
            redis: "UP"
        }
    };

    let isHealthy = true;

    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error("Healthz DB check failed:", error.message);
        status.services.database = "DOWN";
        isHealthy = false;
    }

    try {
        const pong = await redis.ping();
        if (pong !== "PONG") {
            throw new Error(`Redis ping returned: ${pong}`);
        }
    } catch (error) {
        console.error("Healthz Redis check failed:", error.message);
        status.services.redis = "DOWN";
        isHealthy = false;
    }

    if (!isHealthy) {
        status.status = "DOWN";
    }

    return { isHealthy, status };
}

// Helper to record ingestion job duration in Redis
export async function recordIngestionJobDuration(durationInSeconds) {
    const buckets = [5, 15, 30, 60, 120, 300, 600];
    const multi = redis.multi();

    let bucketToIncrement = "+Inf";
    for (const le of buckets) {
        if (durationInSeconds <= le) {
            bucketToIncrement = String(le);
            break;
        }
    }

    multi.hincrby("metrics:ingestion_job_duration_seconds:buckets", bucketToIncrement, 1);
    multi.incrbyfloat("metrics:ingestion_job_duration_seconds:sum", durationInSeconds);
    multi.incr("metrics:ingestion_job_duration_seconds:count");

    await multi.exec().catch((err) => {
        console.error("Failed to record job duration metric in Redis:", err.message);
    });
}

// Helper to get worker metrics from Redis
async function getWorkerMetricsFromRedis() {
    const buckets = ["5", "15", "30", "60", "120", "300", "600", "+Inf"];
    const hash = await redis.hgetall("metrics:ingestion_job_duration_seconds:buckets").catch(() => ({}));
    const sum = await redis.get("metrics:ingestion_job_duration_seconds:sum").catch(() => "0") || "0";
    const count = await redis.get("metrics:ingestion_job_duration_seconds:count").catch(() => "0") || "0";

    const lines = [
        "# HELP ingestion_job_duration_seconds Duration of ingestion jobs in seconds.",
        "# TYPE ingestion_job_duration_seconds histogram"
    ];

    let runningSum = 0;
    for (const le of buckets) {
        const val = parseInt(hash[le] || "0", 10);
        runningSum += val;
        lines.push(`ingestion_job_duration_seconds_bucket{le="${le}"} ${runningSum}`);
    }

    lines.push(`ingestion_job_duration_seconds_sum ${parseFloat(sum)}`);
    lines.push(`ingestion_job_duration_seconds_count ${parseInt(count, 10)}`);

    return lines.join("\n");
}

// Register gauges for BullMQ queue metrics using prom-client
const queueJobsWaiting = new client.Gauge({
    name: "bullmq_queue_jobs_waiting",
    help: "Number of waiting jobs in BullMQ.",
    registers: [registry],
    async collect() {
        try {
            const counts = await getChatCreationQueue().getJobCounts();
            this.set(counts.waiting || 0);
        } catch (error) {
            console.error("Failed to query queue metrics:", error.message);
        }
    }
});

const queueJobsActive = new client.Gauge({
    name: "bullmq_queue_jobs_active",
    help: "Number of active jobs in BullMQ.",
    registers: [registry],
    async collect() {
        try {
            const counts = await getChatCreationQueue().getJobCounts();
            this.set(counts.active || 0);
        } catch (error) {
            console.error("Failed to query queue metrics:", error.message);
        }
    }
});

const queueJobsFailed = new client.Gauge({
    name: "bullmq_queue_jobs_failed",
    help: "Number of failed jobs in BullMQ.",
    registers: [registry],
    async collect() {
        try {
            const counts = await getChatCreationQueue().getJobCounts();
            this.set(counts.failed || 0);
        } catch (error) {
            console.error("Failed to query queue metrics:", error.message);
        }
    }
});

const queueJobsCompleted = new client.Gauge({
    name: "bullmq_queue_jobs_completed",
    help: "Number of completed jobs in BullMQ.",
    registers: [registry],
    async collect() {
        try {
            const counts = await getChatCreationQueue().getJobCounts();
            this.set(counts.completed || 0);
        } catch (error) {
            console.error("Failed to query queue metrics:", error.message);
        }
    }
});

// Generate the full Prometheus-formatted metrics string
export async function getPrometheusMetrics() {
    const appMetrics = await registry.metrics();
    const workerMetrics = await getWorkerMetricsFromRedis();

    return [appMetrics, workerMetrics].filter(Boolean).join("\n\n");
}

export const contentType = registry.contentType;
