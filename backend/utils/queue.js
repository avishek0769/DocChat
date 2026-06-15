import { Queue } from "bullmq";
import redis from "./redis.js";

let chatCreationQueue = null;

export function getChatCreationQueue() {
    if (!chatCreationQueue) {
        chatCreationQueue = new Queue("chatCreation", { connection: redis });
    }
    return chatCreationQueue;
}

export async function closeChatCreationQueue() {
    if (chatCreationQueue) {
        await chatCreationQueue.close();
        chatCreationQueue = null;
    }
}
