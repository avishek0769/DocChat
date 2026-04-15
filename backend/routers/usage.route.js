import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import {
    tokensUsedByGroup,
    topChatsByTokensUsed,
    totalTokensUsedInLifetime,
} from "../controllers/usage.controller.js";

const usageRouter = Router();

usageRouter
    .route("/lifetime-tokens")
    .get(verifyStrictJWT, totalTokensUsedInLifetime);
usageRouter.route("/tokens/:groupBy").get(verifyStrictJWT, tokensUsedByGroup);
usageRouter.route("/top-chats").get(verifyStrictJWT, topChatsByTokensUsed);

export default usageRouter;
