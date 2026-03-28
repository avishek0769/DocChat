import Redis from "ioredis";

const redis = new Redis({ maxRetriesPerRequest: null });

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

export default redis;
