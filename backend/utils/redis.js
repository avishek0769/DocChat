import Redis from "ioredis";
import { EventEmitter } from "events";

const redis = new Redis({ maxRetriesPerRequest: null });

// Dedicated subscriber connection for Redis Pub/Sub.
// ioredis connections in subscribe mode cannot issue regular commands,
// so this must be a separate connection from the primary redis instance.
const redisSubscriber = new Redis({ maxRetriesPerRequest: null });

export const progressEmitter = new EventEmitter();

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

redisSubscriber.on("connect", () => {
    console.log("Redis Subscriber connected");
});

redisSubscriber.on("error", (err) => {
    console.error("Redis Subscriber error:", err);
});

redisSubscriber.on("message", (channel, message) => {
    progressEmitter.emit(channel, message);
});

export const getChatProgressKey = (chatId) => `chat-progress:${chatId}`;
export const getChatProgressChannel = (chatId) => `chat-progress-channel:${chatId}`;

export const updateChatProgress = async (chatId, payload) => {
    const data = JSON.stringify(payload);
    await redis.setex(getChatProgressKey(chatId), 3600, data);
    await redis.publish(getChatProgressChannel(chatId), data);
};

// Also export as redisSub for the cancellation pub/sub subscriber in chatWorker
export { redisSubscriber };
export { redisSubscriber as redisSub };

export default redis;
