import { vi, test, afterAll } from "vitest";
import assert from "node:assert/strict";

// Mock BullMQ completely to prevent any connection creation during test imports
vi.mock("bullmq", () => {
    return {
        Queue: class MockQueue {
            constructor(name, opts) {
                this.name = name;
                this.opts = opts;
            }
            async getJobCounts() {
                return {
                    waiting: 2,
                    active: 1,
                    failed: 0,
                    completed: 5
                };
            }
            async close() {}
        }
    };
});

// Mock ioredis completely to prevent background connection attempts and silent errors
vi.mock("ioredis", () => {
    class MockRedis {
        constructor() {}
        on() { return this; }
        once() { return this; }
        off() { return this; }
        quit() { return Promise.resolve(); }
        disconnect() { return Promise.resolve(); }
        connect() { return Promise.resolve(); }
    }
    return {
        default: MockRedis,
        Redis: MockRedis
    };
});

import prisma from "../utils/prismaClient.js";
import redis from "../utils/redis.js";

// Save original methods to prevent state leakage
const originalQueryRaw = prisma.$queryRaw;
const originalExecuteRawUnsafe = prisma.$executeRawUnsafe;
const originalPing = redis.ping;
const originalMulti = redis.multi;
const originalHgetall = redis.hgetall;
const originalGet = redis.get;

// We will track mock state in a local store
let mockRedisStore = {
    buckets: {},
    sum: 0,
    count: 0
};

// Mock the methods on the singleton instances
prisma.$queryRaw = async () => [];
prisma.$executeRawUnsafe = async () => 0;
redis.ping = async () => "PONG";

redis.multi = () => {
    const chain = {
        hincrby: function(key, field, value) {
            if (key === "metrics:ingestion_job_duration_seconds:buckets") {
                const current = parseInt(mockRedisStore.buckets[field] || "0", 10);
                mockRedisStore.buckets[field] = String(current + parseInt(value, 10));
            }
            return chain;
        },
        incrbyfloat: function(key, value) {
            if (key === "metrics:ingestion_job_duration_seconds:sum") {
                mockRedisStore.sum += parseFloat(value);
            }
            return chain;
        },
        incr: function(key) {
            if (key === "metrics:ingestion_job_duration_seconds:count") {
                mockRedisStore.count += 1;
            }
            return chain;
        },
        exec: async () => []
    };
    return chain;
};

redis.hgetall = async (key) => {
    if (key === "metrics:ingestion_job_duration_seconds:buckets") {
        return mockRedisStore.buckets;
    }
    return {};
};

redis.get = async (key) => {
    if (key === "metrics:ingestion_job_duration_seconds:sum") {
        return String(mockRedisStore.sum);
    }
    if (key === "metrics:ingestion_job_duration_seconds:count") {
        return String(mockRedisStore.count);
    }
    return "0";
};

// Import metrics after patching and mocking
const { checkHealth, recordIngestionJobDuration, getPrometheusMetrics } = await import("../utils/metrics.js");

// Reset the singleton methods in the teardown block to prevent polluting other test files
afterAll(() => {
    prisma.$queryRaw = originalQueryRaw;
    prisma.$executeRawUnsafe = originalExecuteRawUnsafe;
    redis.ping = originalPing;
    redis.multi = originalMulti;
    redis.hgetall = originalHgetall;
    redis.get = originalGet;
});

test("metrics checkHealth structure and properties", async () => {
    const { isHealthy, status } = await checkHealth();
    assert.equal(isHealthy, true);
    assert.equal(status.status, "OK");
    assert.equal(status.services.database, "UP");
    assert.equal(status.services.redis, "UP");
});

test("metrics getPrometheusMetrics output formatting with recorded data", async () => {
    // Reset mock store
    mockRedisStore = {
        buckets: {},
        sum: 0,
        count: 0
    };

    // Record an ingestion job duration of 12.5 seconds (falls in <= 15 bucket)
    await recordIngestionJobDuration(12.5);
    // Record another job of 4.2 seconds (falls in <= 5 bucket)
    await recordIngestionJobDuration(4.2);

    const metricsStr = await getPrometheusMetrics();
    assert.ok(typeof metricsStr === "string");
    assert.match(metricsStr, /http_request_duration_seconds/);
    assert.match(metricsStr, /bullmq_queue_jobs_waiting 2/);
    assert.match(metricsStr, /bullmq_queue_jobs_active 1/);
    
    // Cumulative histogram assertions
    assert.match(metricsStr, /ingestion_job_duration_seconds_bucket\{le="5"\} 1/);
    assert.match(metricsStr, /ingestion_job_duration_seconds_bucket\{le="15"\} 2/);
    assert.match(metricsStr, /ingestion_job_duration_seconds_bucket\{le="30"\} 2/);
    assert.match(metricsStr, /ingestion_job_duration_seconds_bucket\{le="\+Inf"\} 2/);
    
    assert.match(metricsStr, /ingestion_job_duration_seconds_sum 16\.7/);
    assert.match(metricsStr, /ingestion_job_duration_seconds_count 2/);
});
