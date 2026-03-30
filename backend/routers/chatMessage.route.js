import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { sendMessage, getAvailableModels, getChatMessages, getChatMessageSources } from "../controllers/chatMessage.controller.js";


const chatMessageRouter = Router()

chatMessageRouter.route("/models").get(verifyStrictJWT, getAvailableModels)
chatMessageRouter.route("/send").post(verifyStrictJWT, sendMessage)
chatMessageRouter.route("/all/:chatId").get(verifyStrictJWT, getChatMessages)
chatMessageRouter.route("/sources/:messageId").get(verifyStrictJWT, getChatMessageSources)

export default chatMessageRouter;
