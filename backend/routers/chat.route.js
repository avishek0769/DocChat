import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { chatDetails, createChat, expectation, listAllChats, progressStatus } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, expectation);
chatRouter.route("/create").post(verifyStrictJWT, createChat);
chatRouter.route("/list").get(verifyStrictJWT);
chatRouter.route("/:chatId").delete(verifyStrictJWT);
chatRouter.route("/status/:chatId").get(verifyStrictJWT, progressStatus);
chatRouter.route("/list").get(verifyStrictJWT, listAllChats);
chatRouter.route("/:chatId").get(verifyStrictJWT, chatDetails);

export default chatRouter;
