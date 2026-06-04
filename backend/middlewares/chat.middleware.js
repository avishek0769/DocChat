import prisma from "../utils/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Middleware to verify if the currently authenticated user owns the requested chat.
 *
 * It expects a `chatId` to be present in either `req.params` or `req.body`.
 * If the chat does not exist, it throws a 404 ApiError.
 * If the user does not own the chat, it throws a 403 ApiError.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Express next middleware function.
 * @throws {ApiError} 400 if chatId is missing, 404 if chat is not found, or 403 if unauthorized.
 */
const verifyChatOwnership = async (req, res, next) => {
    try {
        const chatId = req.params?.chatId || req.body?.chatId;

        if (!chatId) {
            throw new ApiError(400, "Chat ID is missing in request.");
        }

        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            select: { userId: true },
        });

        if (!chat) {
            throw new ApiError(404, "Chat not found.");
        }

        if (chat.userId !== req.user.id) {
            throw new ApiError(403, "You do not have permission to access this chat.");
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export { verifyChatOwnership };
