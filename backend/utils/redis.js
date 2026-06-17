import Redis from "ioredis";

// Primary connection — used for all regular commands (get, set, setex, publish, BullMQ)
const redis = new Redis({ maxRetriesPerRequest: null });

// Subscriber connection — ioredis connections in subscribe mode can ONLY receive messages,
// they can no longer issue regular commands. A dedicated connection avoids that conflict.
export const redisSub = new Redis({ maxRetriesPerRequest: null });

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

redisSub.on("connect", () => {
    console.log("Redis subscriber connected");
});

redisSub.on("error", (err) => {
    console.error("Redis subscriber error:", err);
});

export default redis;
