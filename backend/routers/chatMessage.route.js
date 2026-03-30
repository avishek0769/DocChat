import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { sendMessage, getAvailableModels } from "../controllers/chatMessage.controller.js";


const chatMessageRouter = Router()

chatMessageRouter.route("/models").get(verifyStrictJWT, getAvailableModels)
chatMessageRouter.route("/send").post(verifyStrictJWT, sendMessage)

export default chatMessageRouter;
