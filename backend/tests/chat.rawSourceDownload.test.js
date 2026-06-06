import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

const chatSourceFindFirstMock = jest.fn();
const qdrantScrollMock = jest.fn();

jest.unstable_mockModule("../utils/prismaClient.js", () => ({
    default: {
        chatSource: {
            findFirst: chatSourceFindFirstMock,
        },
    },
}));

jest.unstable_mockModule("../middlewares/auth.middleware.js", () => ({
    verifyStrictJWT: (req, res, next) => {
        req.user = { id: "user-123" };
        next();
    },
    verifyJWT: (req, res, next) => next(),
}));

jest.unstable_mockModule("bullmq", () => ({
    Queue: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule("../utils/redis.js", () => ({
    default: {},
}));

jest.unstable_mockModule("../utils/ragUtilities.js", () => ({
    scrapeWebpage: jest.fn(),
}));

jest.unstable_mockModule("../utils/qdrantCleanup.js", () => ({
    cleanupQdrantCollections: jest.fn(),
}));

jest.unstable_mockModule("../utils/ragClients.js", () => ({
    qdrant: {
        scroll: qdrantScrollMock,
    },
}));

const { default: chatRouter } = await import("../routers/chat.route.js");

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/chat", chatRouter);
    app.use((err, req, res, next) => {
        res.status(err.statusCode || err.status || 500).json({ message: err.message });
    });
    return app;
};

const sourceId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
    chatSourceFindFirstMock.mockReset();
    qdrantScrollMock.mockReset();
});

describe("raw chat source download route", () => {
    test("returns owned raw source content as a plain text attachment", async () => {
        chatSourceFindFirstMock.mockResolvedValue({
            id: sourceId,
            heading: "My Docs",
            collectionName: "my-docs-1234567890123",
            documentTree: {
                sourceData: "Title: Intro\nRaw extracted source content.",
            },
        });

        const app = buildApp();
        const res = await request(app).get(`/api/v1/chat/sources/${sourceId}/raw`);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/plain/);
        expect(res.headers["content-disposition"]).toBe(
            `attachment; filename="my-docs-${sourceId}.txt"`,
        );
        expect(res.text).toBe("Title: Intro\nRaw extracted source content.");
        expect(chatSourceFindFirstMock).toHaveBeenCalledWith({
            where: {
                id: sourceId,
                chats: {
                    some: {
                        userId: "user-123",
                    },
                },
            },
            select: {
                id: true,
                heading: true,
                collectionName: true,
                documentTree: {
                    select: {
                        sourceData: true,
                    },
                },
            },
        });
    });

    test("falls back to vector payload chunks when document tree raw content is missing", async () => {
        chatSourceFindFirstMock.mockResolvedValue({
            id: sourceId,
            heading: "My Docs",
            collectionName: "my-docs-1234567890123",
            documentTree: null,
        });
        qdrantScrollMock.mockResolvedValueOnce({
            points: [
                {
                    payload: {
                        title: "Intro",
                        url: "https://example.com/intro",
                        body: "First stored chunk.",
                    },
                },
                {
                    payload: {
                        title: "Install",
                        url: "https://example.com/install",
                        body: "Second stored chunk.",
                    },
                },
            ],
            next_page_offset: null,
        });

        const app = buildApp();
        const res = await request(app).get(`/api/v1/chat/sources/${sourceId}/raw`);

        expect(res.status).toBe(200);
        expect(res.text).toContain("First stored chunk.");
        expect(res.text).toContain("Second stored chunk.");
        expect(qdrantScrollMock).toHaveBeenCalledWith("my-docs-1234567890123", {
            filter: {
                must: [
                    {
                        key: "chatSourceId",
                        match: {
                            value: sourceId,
                        },
                    },
                ],
            },
            limit: 100,
            offset: undefined,
            with_payload: true,
            with_vector: false,
        });
    });

    test("does not return content when the source is missing or not owned", async () => {
        chatSourceFindFirstMock.mockResolvedValue(null);

        const app = buildApp();
        const res = await request(app).get(`/api/v1/chat/sources/${sourceId}/raw`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Chat source not found");
    });

    test("returns 404 when no raw source content is stored", async () => {
        chatSourceFindFirstMock.mockResolvedValue({
            id: sourceId,
            heading: "My Docs",
            collectionName: null,
            documentTree: null,
        });

        const app = buildApp();
        const res = await request(app).get(`/api/v1/chat/sources/${sourceId}/raw`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Raw source content is not available for this chat source");
    });
});
