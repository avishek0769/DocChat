import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateGroupBy } from "../utils/validationSchemas.js";
import { Prisma } from "../generated/prisma/index.js";

const totalTokensUsedInLifetime = asyncHandler(async (req, res) => {
    const usage = await prisma.usageEvents.aggregate({
        where: { userId: req.user.id },
        _sum: {
            inputTokens: true,
            outputTokens: true,
            estimatedCostUsd: true,
        },
    });
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    _sum: {
                        inputTokens: usage._sum.inputTokens || 0,
                        outputTokens: usage._sum.outputTokens || 0,
                        estimatedCostUsd: Number(usage._sum.estimatedCostUsd || 0),
                    },
                },
                "Total tokens used in lifetime retrieved successfully",
            ),
        );
});

const tokensUsedByGroup = asyncHandler(async (req, res) => {
    const { groupBy } = req.params;
    const { from, to } = req.query;

    validateGroupBy(groupBy);

    if (from && isNaN(Date.parse(from))) {
        const err = new Error("Invalid 'from' date");
        err.status = 400;
        err.statusCode = 400;
        throw err;
    }

    if (to && isNaN(Date.parse(to))) {
        const err = new Error("Invalid 'to' date");
        err.status = 400;
        err.statusCode = 400;
        throw err;
    }

    let truncUnit;
    switch (groupBy) {
        case "day":
            truncUnit = "day";
            break;
        case "week":
            truncUnit = "week";
            break;
        case "month":
            truncUnit = "month";
            break;
        default: {
            const err = new Error("Invalid groupBy");
            err.status = 400;
            err.statusCode = 400;
            throw err;
        }
    }

    const usageByGroup = await prisma.$queryRaw`
        SELECT 
            DATE_TRUNC(${truncUnit}, u."timestamp") AS period,
            m."llm_model" AS "model",
            a."provider" AS "provider",
            SUM(u."input_tokens") AS "totalInput",
            SUM(u."output_tokens") AS "totalOutput",
            SUM(u."estimated_cost_usd")::float8 AS "estimatedCostUsd"
        FROM "UsageEvents" u
        JOIN "ChatMessage" m ON u."message_id" = m."id"
        LEFT JOIN "ApiKey" a ON u."apikey_id" = a."id"
        WHERE u."user_id" = ${req.user.id}
        GROUP BY period, "model", "provider"
        ORDER BY period DESC, "totalInput" DESC;
    `;

    const serializedUsage = usageByGroup.reduce((acc, curr) => {
        const periodKey = new Date(curr.period).toISOString();
        if (!acc[periodKey]) {
            acc[periodKey] = {
                period: periodKey,
                usageByModels: [],
            };
        }
        acc[periodKey].usageByModels.push({
            model: curr.model,
            provider: curr.provider,
            totalInput: Number(curr.totalInput || 0),
            totalOutput: Number(curr.totalOutput || 0),
            estimatedCostUsd: Number(curr.estimatedCostUsd || 0),
        });
        return acc;
    }, {});

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                serializedUsage,
                `Usage grouped by ${groupBy} and model retrieved successfully`,
            ),
        );
});

const topChatsByTokensUsed = asyncHandler(async (req, res) => {
    const topChats = await prisma.usageEvents.groupBy({
        where: {
            userId: req.user.id,
            chatId: { not: null },
        },
        by: ["chatId"],
        _sum: {
            inputTokens: true,
            outputTokens: true,
            estimatedCostUsd: true,
        },
        orderBy: {
            _sum: {
                inputTokens: "desc",
            },
        },
        take: 3,
    });

    const chatIds = topChats.map((u) => u.chatId);

    const chatDetails = await prisma.chat.findMany({
        where: {
            id: { in: chatIds },
        },
        select: {
            id: true,
            name: true,
        },
    });

    const result = topChats
        .map((usage) => {
            const chat = chatDetails.find((c) => c.id === usage.chatId);
            return chat
                ? {
                      ...usage,
                      _sum: {
                          inputTokens: usage._sum.inputTokens || 0,
                          outputTokens: usage._sum.outputTokens || 0,
                          estimatedCostUsd: Number(usage._sum.estimatedCostUsd || 0),
                      },
                      name: chat.name,
                  }
                : null;
        })
        .filter(Boolean);

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Top chats by tokens used retrieved successfully"));
});

const usageBreakdownByModel = asyncHandler(async (req, res) => {
    const { from, to, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [Prisma.sql`u."user_id" = ${req.user.id}`];
    if (from) conditions.push(Prisma.sql`u."timestamp" >= ${new Date(from)}`);
    if (to)   conditions.push(Prisma.sql`u."timestamp" <= ${new Date(to)}`);
    const whereClause = Prisma.join(conditions, " AND ");

    const breakdown = await prisma.$queryRaw`
        SELECT
            m."llm_model"   AS "model",
            a."provider"    AS "provider",
            SUM(u."input_tokens")::int                              AS "totalInputTokens",
            SUM(u."output_tokens")::int                             AS "totalOutputTokens",
            (SUM(u."input_tokens") + SUM(u."output_tokens"))::int   AS "totalTokens",
            SUM(u."estimated_cost_usd")::float8                     AS "estimatedCostUsd",
            COUNT(*)::int                                           AS "requestCount"
        FROM "UsageEvents" u
        JOIN "ChatMessage" m ON u."message_id" = m."id"
        LEFT JOIN "ApiKey"  a ON u."apikey_id"  = a."id"
        WHERE ${whereClause}
        GROUP BY m."llm_model", a."provider"
        ORDER BY "totalTokens" DESC
        LIMIT  ${Number(limit)}
        OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT (m."llm_model", a."provider"))::int AS count
        FROM "UsageEvents" u
        JOIN "ChatMessage" m ON u."message_id" = m."id"
        LEFT JOIN "ApiKey"  a ON u."apikey_id"  = a."id"
        WHERE ${whereClause}
    `;

    const total = countResult[0]?.count || 0;

    return res.status(200).json(
        new ApiResponse(200, {
            data: breakdown,
            pagination: {
                page:       Number(page),
                limit:      Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        }, "Usage breakdown by model/provider retrieved successfully")
    );
});

export { totalTokensUsedInLifetime, tokensUsedByGroup, topChatsByTokensUsed, usageBreakdownByModel };
