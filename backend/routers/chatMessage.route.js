import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    sendMessageSchema,
    chatIdParamSchema,
    messageIdParamSchema,
} from "../utils/validationSchemas.js";
import {
    sendMessage,
    getAvailableModels,
    getChatMessages,
    getChatMessageSources,
    exportChatMessages,
    getSharedChatMessages,
} from "../controllers/chatMessage.controller.js";

const chatMessageRouter = Router();

chatMessageRouter.route("/models").get(verifyStrictJWT, getAvailableModels);
chatMessageRouter.route("/send").post(verifyStrictJWT, validate(sendMessageSchema), sendMessage);
chatMessageRouter.route("/all/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), getChatMessages);
chatMessageRouter.route("/sources/:messageId").get(verifyStrictJWT, validate(messageIdParamSchema), getChatMessageSources);
chatMessageRouter.route("/export/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), exportChatMessages);

// Shared Chat Messages Route
chatMessageRouter.route("/shared/:shareToken/messages").get(getSharedChatMessages);

export default chatMessageRouter;
