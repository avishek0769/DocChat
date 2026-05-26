import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    expectationQuerySchema,
    createChatSchema,
    chatIdParamSchema,
} from "../utils/validationSchemas.js";
import {
    cancelProcessing,
    chatDetails,
    createChat,
    deleteChat,
    expectation,
    listAllChats,
    recentChats,
    listAllPagesIndexed,
    progressStatus,
    toggleShare,
    getSharedChatDetails,
    forkSharedChat,
} from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, validate(expectationQuerySchema), expectation);
chatRouter.route("/create").post(verifyStrictJWT, validate(createChatSchema), createChat);
chatRouter.route("/status/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), progressStatus);
chatRouter.route("/list").get(verifyStrictJWT, listAllChats);
chatRouter.route("/recent").get(verifyStrictJWT, recentChats);

// Shared Chat Routes
chatRouter.route("/shared/:shareToken").get(getSharedChatDetails);
chatRouter.route("/shared/:shareToken/fork").post(verifyStrictJWT, forkSharedChat);
chatRouter.route("/:chatId/share").post(verifyStrictJWT, validate(chatIdParamSchema), toggleShare);

chatRouter.route("/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), chatDetails);
chatRouter.route("/pages-indexed/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), listAllPagesIndexed);
chatRouter.route("/:chatId").delete(verifyStrictJWT, validate(chatIdParamSchema), deleteChat);
chatRouter.route("/cancel/:chatId").get(verifyStrictJWT, validate(chatIdParamSchema), cancelProcessing);

export default chatRouter;
