import { Router } from "express";
import { verifyStrictJWT } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { verifyChatOwnership } from "../middlewares/chat.middleware.js";
import {
    expectationQuerySchema,
    createChatSchema,
    chatIdParamSchema,
    qdrantCleanupSchema,
} from "../utils/validationSchemas.js";
import {
    cancelProcessing,
    chatDetails,
    createChat,
    deleteChat,
    restoreChat,
    expectation,
    listAllChats,
    recentChats,
    listAllPagesIndexed,
    progressStatus,
    recentFailedIngestionRuns,
    toggleShare,
    getSharedChatDetails,
    forkSharedChat,
    qdrantCleanup,
    streamChatStatus,
} from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/expectation").get(verifyStrictJWT, validate(expectationQuerySchema), expectation);
chatRouter.route("/create").post(verifyStrictJWT, validate(createChatSchema), createChat);
chatRouter.route("/qdrant-cleanup").get(verifyStrictJWT, validate(qdrantCleanupSchema), qdrantCleanup);
chatRouter
    .route("/status/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), progressStatus);
chatRouter
    .route("/status/stream/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), streamChatStatus);
chatRouter.route("/ingestion-runs/failed").get(verifyStrictJWT, recentFailedIngestionRuns);
chatRouter.route("/list").get(verifyStrictJWT, listAllChats);
chatRouter.route("/recent").get(verifyStrictJWT, recentChats);

// Shared Chat Routes
chatRouter.route("/shared/:shareToken").get(getSharedChatDetails);
chatRouter.route("/shared/:shareToken/fork").post(verifyStrictJWT, forkSharedChat);
chatRouter
    .route("/:chatId/share")
    .post(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, toggleShare);

chatRouter
    .route("/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, chatDetails);
chatRouter
    .route("/pages-indexed/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, listAllPagesIndexed);
chatRouter
    .route("/:chatId")
    .delete(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, deleteChat);
chatRouter
    .route("/cancel/:chatId")
    .get(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, cancelProcessing);
chatRouter
    .route("/restore/:chatId")
    .post(verifyStrictJWT, validate(chatIdParamSchema), verifyChatOwnership, restoreChat);

export default chatRouter;
