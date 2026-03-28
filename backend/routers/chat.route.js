import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { createChat, expectation, progressStatus } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, expectation);
chatRouter.route("/create").post(verifyStrictJWT, createChat);
chatRouter.route("/list").get(verifyStrictJWT);
chatRouter.route("/:chatId").delete(verifyStrictJWT);
chatRouter.route("/status/:chatId").get(verifyStrictJWT, progressStatus);

export default chatRouter;
