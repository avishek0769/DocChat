import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { tokensByGroupSchema } from "../utils/validationSchemas.js";
import {
    tokensUsedByGroup,
    topChatsByTokensUsed,
    totalTokensUsedInLifetime,
} from "../controllers/usage.controller.js";

const usageRouter = Router();

usageRouter.route("/lifetime-tokens").get(verifyStrictJWT, totalTokensUsedInLifetime);
usageRouter.route("/tokens/:groupBy").get(verifyStrictJWT, validate(tokensByGroupSchema), tokensUsedByGroup);
usageRouter.route("/top-chats").get(verifyStrictJWT, topChatsByTokensUsed);

export default usageRouter;
