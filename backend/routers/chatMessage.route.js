import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { verifyChatOwnership } from "../middlewares/chat.middleware.js";
import {
    sendMessageSchema,
    chatIdParamSchema,
    chatMessagesQuerySchema,
    messageIdParamSchema,
} from "../utils/validationSchemas.js";
import {
    sendMessage,
    getAvailableModels,
    getChatMessages,
    getChatMessageSources,
    exportChatMessages,
    getSharedChatMessages,
    getSharedChatMessageSources,
} from "../controllers/chatMessage.controller.js";

import { llmRateLimiter } from "../middlewares/rateLimit.middleware.js";

const chatMessageRouter = Router();

chatMessageRouter.route("/models").get(verifyStrictJWT, getAvailableModels);
chatMessageRouter
    .route("/send")
    .post(verifyStrictJWT, llmRateLimiter, validate(sendMessageSchema), verifyChatOwnership, sendMessage);
chatMessageRouter
    .route("/all/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema, chatMessagesQuerySchema), verifyChatOwnership, getChatMessages);
chatMessageRouter
    .route("/sources/:messageId")
    .get(verifyStrictJWT, validate(messageIdParamSchema), getChatMessageSources);
chatMessageRouter
    .route("/export/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, exportChatMessages);

// Shared Chat Messages Route
chatMessageRouter.route("/shared/:shareToken/messages").get(getSharedChatMessages);
chatMessageRouter.route("/shared/:shareToken/messages/:messageId/sources").get(getSharedChatMessageSources);

export default chatMessageRouter;
