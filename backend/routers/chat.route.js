import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { cancelProcessing, chatDetails, createChat, deleteChat, expectation, listAllChats, recentChats, listAllPagesIndexed, progressStatus } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, expectation);
chatRouter.route("/create").post(verifyStrictJWT, createChat);
chatRouter.route("/status/:chatId").get(verifyStrictJWT, progressStatus);
chatRouter.route("/list").get(verifyStrictJWT, listAllChats);
chatRouter.route("/recent").get(verifyStrictJWT, recentChats);
chatRouter.route("/:chatId").get(verifyStrictJWT, chatDetails);
chatRouter.route("/pages-indexed/:chatId").get(verifyStrictJWT, listAllPagesIndexed);
chatRouter.route("/:chatId").delete(verifyStrictJWT, deleteChat);
chatRouter.route("/cancel/:chatId").get(verifyStrictJWT, cancelProcessing);

export default chatRouter;
