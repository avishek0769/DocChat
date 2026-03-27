import { Router } from "express";
import { verifyJWT, verifyStrictJWT } from "../middlewares/auth.middleware.js";
import { createChat, expectation } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, expectation);
chatRouter.route("/create").post(verifyStrictJWT, createChat);
chatRouter.route("/list").get(verifyStrictJWT);
chatRouter.route("/:id").delete(verifyStrictJWT);

export default chatRouter;
