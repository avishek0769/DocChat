import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

const queryRawMock = jest.fn();
const usageAggregateMock = jest.fn();
const groupByMock = jest.fn();
const chatFindManyMock = jest.fn();

jest.unstable_mockModule("../utils/prismaClient.js", () => ({
    default: {
        $queryRaw: queryRawMock,
        usageEvents: {
            aggregate: usageAggregateMock,
            groupBy: groupByMock,
        },
        chat: {
            findMany: chatFindManyMock,
        },
    },
}));

jest.unstable_mockModule("../middlewares/auth.middleware.js", () => ({
    verifyStrictJWT: (req, res, next) => {
        req.user = { id: "test-user-id" };
        next();
    },
    verifyJWT: (req, res, next) => next(),
}));

const { default: usageRouter } = await import("../routers/usage.route.js");

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/usage", usageRouter);
    app.use((err, req, res, next) => {
        res.status(err.statusCode || err.status || 500).json({ message: err.message });
    });
    return app;
};

beforeEach(() => {
    queryRawMock.mockReset();
    usageAggregateMock.mockReset();
    groupByMock.mockReset();
    chatFindManyMock.mockReset();
});

describe("usage groupBy route hardening", () => {
    test.each(["day", "week", "month"])("GET /usage/group/%s returns 200", async (groupBy) => {
        queryRawMock.mockResolvedValue([
            {
                period: new Date("2026-01-01T00:00:00.000Z"),
                model: "gpt-4o",
                totalInput: 12n,
                totalOutput: 18n,
            },
        ]);

        const app = buildApp();
        const res = await request(app).get(`/api/v1/usage/group/${groupBy}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(Object.values(res.body.data || {}))).toBe(true);
        expect(queryRawMock).toHaveBeenCalledTimes(1);
    });

    test("GET /usage/group/year returns 400", async () => {
        const app = buildApp();
        const res = await request(app).get("/api/v1/usage/group/year");

        expect(res.status).toBe(400);
        expect(res.body.error || res.body.message).toMatch(/Invalid groupBy/i);
        expect(queryRawMock).not.toHaveBeenCalled();
    });

    test("GET /usage/group/ returns 404 or 400", async () => {
        const app = buildApp();
        const res = await request(app).get("/api/v1/usage/group/");

        expect([400, 404]).toContain(res.status);
    });

    test.each([
        "1;DROP TABLE",
        "%27%20OR%201=1",
    ])("GET /usage/group/%s returns 400", async (rawGroupBy) => {
        const app = buildApp();
        const res = await request(app).get(`/api/v1/usage/group/${rawGroupBy}`);

        expect(res.status).toBe(400);
        expect(res.body.error || res.body.message).toMatch(/Invalid groupBy/i);
        expect(queryRawMock).not.toHaveBeenCalled();
    });
});
