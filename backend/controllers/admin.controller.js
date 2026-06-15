import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

const clampPagination = (req) => {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

const getRangeStart = (range = "7d") => {
    const now = new Date();
    const sinceDate = new Date(now);

    switch (range) {
        case "24h":
            sinceDate.setHours(sinceDate.getHours() - 24);
            break;
        case "7d":
            sinceDate.setDate(sinceDate.getDate() - 7);
            break;
        case "30d":
            sinceDate.setDate(sinceDate.getDate() - 30);
            break;
        default:
            sinceDate.setDate(sinceDate.getDate() - 7);
            break;
    }

    return sinceDate;
};

const overview = asyncHandler(async (req, res) => {
    const range = req.query.range || "7d";
    const sinceDate = getRangeStart(range);
    const [totalUsers, totalChats, totalMessages, totalUsageEvents, totalIngestionRuns, latestAuditEvents] =
        await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: sinceDate } } }),
            prisma.chat.count({ where: { createdAt: { gte: sinceDate } } }),
            prisma.chatMessage.count({ where: { createdAt: { gte: sinceDate } } }),
            prisma.usageEvents.count({ where: { timestamp: { gte: sinceDate } } }),
            prisma.ingestionRun.count({ where: { startedAt: { gte: sinceDate } } }),
            prisma.auditEvent.findMany({
                where: { createdAt: { gte: sinceDate } },
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    type: true,
                    userId: true,
                    chatId: true,
                    metadata: true,
                    createdAt: true,
                },
            }),
        ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalUsers,
                totalChats,
                totalMessages,
                totalUsageEvents,
                totalIngestionRuns,
                latestAuditEvents,
            },
            "Admin overview retrieved successfully",
        ),
    );
});

const users = asyncHandler(async (req, res) => {
    const { page, limit, skip } = clampPagination(req);

    const [total, data] = await Promise.all([
        prisma.user.count(),
        prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                fullname: true,
                username: true,
                email: true,
                isVerified: true,
                isAdmin: true,
                createdAt: true,
                _count: {
                    select: {
                        chats: true,
                        usageEvents: true,
                        auditEvents: true,
                    },
                },
            },
        }),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
            "Admin users retrieved successfully",
        ),
    );
});

const userDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            fullname: true,
            username: true,
            email: true,
            isVerified: true,
            isAdmin: true,
            createdAt: true,
            _count: {
                select: {
                    chats: true,
                    usageEvents: true,
                    auditEvents: true,
                },
            },
        },
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const [usageAggregate, recentChats, auditEvents, rawBreakdown] = await Promise.all([
        prisma.usageEvents.aggregate({
            where: { userId },
            _sum: {
                inputTokens: true,
                outputTokens: true,
            },
        }),
        prisma.chat.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
            },
        }),
        prisma.auditEvent.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                type: true,
                metadata: true,
                createdAt: true,
            },
        }),
        prisma.$queryRaw`
            SELECT
                m."llm_model" AS "model",
                SUM(u."input_tokens")::int AS "totalInputTokens",
                SUM(u."output_tokens")::int AS "totalOutputTokens"
            FROM "UsageEvents" u
            JOIN "ChatMessage" m ON u."message_id" = m."id"
            WHERE u."user_id" = ${userId}
            GROUP BY m."llm_model"
            ORDER BY (SUM(u."input_tokens") + SUM(u."output_tokens")) DESC
        `,
    ]);

    const totalTokens = (usageAggregate._sum.inputTokens || 0) + (usageAggregate._sum.outputTokens || 0);

    const recentActivity = auditEvents.map((event) => {
        const meta = event.metadata || {};

        return {
            id: event.id,
            type: event.type,
            title: meta.title || null,
            detail: meta.detail || null,
            createdAt: event.createdAt,
        };
    });

    const usageBreakdown = rawBreakdown.map((row) => ({
        model: row.model,
        totalInputTokens: Number(row.totalInputTokens || 0),
        totalOutputTokens: Number(row.totalOutputTokens || 0),
        totalTokens: Number(row.totalInputTokens || 0) + Number(row.totalOutputTokens || 0),
    }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: {
                    ...user,
                    totalTokens,
                },
                recentChats,
                recentActivity,
                usageBreakdown,
            },
            "Admin user details retrieved successfully",
        ),
    );
});

const usage = asyncHandler(async (req, res) => {
    const { page, limit, skip } = clampPagination(req);
    const range = req.query.range || "7d";
    const sinceDate = getRangeStart(range);
    const [totalUsage, topUsers, topModels] = await Promise.all([
        prisma.usageEvents.aggregate({
            where: { timestamp: { gte: sinceDate } },
            _sum: {
                inputTokens: true,
                outputTokens: true,
            },
        }),
        prisma.$queryRaw`
            SELECT u."user_id" AS "userId",
                   usr."username" AS "username",
                   usr."fullname" AS "fullname",
                   COUNT(*)::int AS "requestCount",
                   SUM(u."input_tokens")::int AS "inputTokens",
                   SUM(u."output_tokens")::int AS "outputTokens"
            FROM "UsageEvents" u
            LEFT JOIN "User" usr ON usr."id" = u."user_id"
            WHERE u."timestamp" >= ${sinceDate}
            GROUP BY u."user_id", usr."username", usr."fullname"
            ORDER BY (SUM(u."input_tokens") + SUM(u."output_tokens")) DESC
            LIMIT ${limit}
            OFFSET ${skip};
        `,
        prisma.$queryRaw`
            SELECT m."llm_model" AS "model",
                   COUNT(*)::int AS "requestCount",
                   SUM(u."input_tokens")::int AS "inputTokens",
                   SUM(u."output_tokens")::int AS "outputTokens"
            FROM "UsageEvents" u
            JOIN "ChatMessage" m ON u."message_id" = m."id"
            WHERE u."timestamp" >= ${sinceDate}
            GROUP BY m."llm_model"
            ORDER BY (SUM(u."input_tokens") + SUM(u."output_tokens")) DESC
            LIMIT ${limit}
            OFFSET ${skip};
        `,
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalInputTokens: totalUsage._sum.inputTokens || 0,
                totalOutputTokens: totalUsage._sum.outputTokens || 0,
                topUsersByTokenUsage: topUsers,
                topModelsByTokenUsage: topModels,
                pagination: {
                    page,
                    limit,
                },
            },
            "Admin usage retrieved successfully",
        ),
    );
});

const ingestion = asyncHandler(async (req, res) => {
    const { page, limit, skip } = clampPagination(req);
    const range = req.query.range || "7d";
    const sinceDate = getRangeStart(range);
    const [statusCounts, totalFailed, recentFailedIngestionRuns] = await Promise.all([
        prisma.ingestionRun.groupBy({
            by: ["status"],
            where: { startedAt: { gte: sinceDate } },
            _count: true,
        }),
        prisma.ingestionRun.count({
            where: { status: "FAILED", startedAt: { gte: sinceDate } },
        }),
        prisma.ingestionRun.findMany({
            where: { status: "FAILED", startedAt: { gte: sinceDate } },
            orderBy: { startedAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                chatId: true,
                chatSourceId: true,
                status: true,
                startedAt: true,
                finishedAt: true,
                errorCode: true,
                errorMessage: true,
            },
        }),
    ]);

    const statusMap = Object.fromEntries(statusCounts.map((row) => [row.status, row._count]));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                READY: statusMap.READY || 0,
                FAILED: statusMap.FAILED || 0,
                PROCESSING: statusMap.PROCESSING || 0,
                QUEUED: statusMap.QUEUED || 0,
                recentFailedIngestionRuns,
                pagination: {
                    page,
                    limit,
                    total: totalFailed,
                    totalPages: Math.ceil(totalFailed / limit),
                },
            },
            "Admin ingestion retrieved successfully",
        ),
    );
});

export { overview, users, userDetails, usage, ingestion };
