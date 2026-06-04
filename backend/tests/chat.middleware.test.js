/**
 * Test Suite for Chat Ownership Middleware
 *
 * Verifies the authorization logic that ensures users can only access or modify
 * chats that belong to them. This suite mocks Prisma and the ApiError class
 * to ensure isolated unit testing.
 */
import { jest } from "@jest/globals";

const findUniqueMock = jest.fn();

jest.unstable_mockModule("../utils/prismaClient.js", () => ({
    default: {
        chat: {
            findUnique: findUniqueMock,
        },
    },
}));

jest.unstable_mockModule("../utils/ApiError.js", () => ({
    ApiError: class ApiError extends Error {
        constructor(statusCode, message) {
            super(message);
            this.statusCode = statusCode;
        }
    },
}));

const { verifyChatOwnership } = await import("../middlewares/chat.middleware.js");

describe("verifyChatOwnership middleware", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            params: {},
            body: {},
            user: { id: "user-123" },
        };
        res = {};
        next = jest.fn();
        findUniqueMock.mockReset();
    });

    test("should throw 400 if chatId is missing", async () => {
        await verifyChatOwnership(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe("Chat ID is missing in request.");
    });

    test("should throw 404 if chat is not found", async () => {
        req.params.chatId = "chat-123";
        findUniqueMock.mockResolvedValue(null);

        await verifyChatOwnership(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe("Chat not found.");
    });

    test("should throw 403 if chat belongs to another user", async () => {
        req.params.chatId = "chat-123";
        findUniqueMock.mockResolvedValue({ userId: "user-456" });

        await verifyChatOwnership(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe("You do not have permission to access this chat.");
    });

    test("should call next() without error if user owns the chat", async () => {
        req.params.chatId = "chat-123";
        findUniqueMock.mockResolvedValue({ userId: "user-123" });

        await verifyChatOwnership(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeUndefined(); // no error passed
    });

    test("should extract chatId from req.body if not in params", async () => {
        req.body.chatId = "chat-789";
        findUniqueMock.mockResolvedValue({ userId: "user-123" });

        await verifyChatOwnership(req, res, next);
        expect(findUniqueMock).toHaveBeenCalledWith({
            where: { id: "chat-789" },
            select: { userId: true },
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBeUndefined();
    });
});
