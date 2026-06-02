import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { VALID_GROUP_BY, tokensByGroupSchema } from "../utils/validationSchemas.js";
import {
    tokensUsedByGroup,
    topChatsByTokensUsed,
    totalTokensUsedInLifetime,
    usageBreakdownByModel,
} from "../controllers/usage.controller.js";

const usageRouter = Router();

function validateGroupByMiddleware(req, res, next) {
    const { groupBy } = req.params;
    if (!VALID_GROUP_BY.includes(groupBy)) {
        return res.status(400).json({
            error: `Invalid groupBy "${groupBy}". Must be one of: ${VALID_GROUP_BY.join(", ")}`,
        });
    }
    next();
}

usageRouter.route("/lifetime-tokens").get(verifyStrictJWT, totalTokensUsedInLifetime);
usageRouter.route("/group/:groupBy").get(verifyStrictJWT, validateGroupByMiddleware, tokensUsedByGroup);
usageRouter.route("/tokens/:groupBy").get(verifyStrictJWT, validateGroupByMiddleware, validate(tokensByGroupSchema), tokensUsedByGroup);
usageRouter.route("/top-chats").get(verifyStrictJWT, topChatsByTokensUsed);
usageRouter.route("/breakdown").get(verifyStrictJWT, usageBreakdownByModel);

export default usageRouter;