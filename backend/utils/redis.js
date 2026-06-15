import Redis from "ioredis";
import { EventEmitter } from "events";

const redis = new Redis({ maxRetriesPerRequest: null });
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

export { redisSubscriber };
export default redis;
