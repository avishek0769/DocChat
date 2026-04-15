import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Prisma } from "../generated/prisma/index.js";

const totalTokensUsedInLifetime = asyncHandler(async (req, res) => {
    const usage = await prisma.usageEvents.aggregate({
        where: { userId: req.user.id },
        _sum: {
            inputTokens: true,
            outputTokens: true,
        },
    });
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                usage,
                "Total tokens used in lifetime retrieved successfully",
            ),
        );
});

const tokensUsedByGroup = asyncHandler(async (req, res) => {
    const { groupBy } = req.params;

    const allowedGroups = ["day", "week", "month", "year"];
    if (!allowedGroups.includes(groupBy)) {
        throw new ApiError(
            400,
            `Invalid groupBy parameter. Allowed values are: ${allowedGroups.join(", ")}`,
        );
    }

    const usageByGroup = await prisma.$queryRaw`
        SELECT 
            DATE_TRUNC(${Prisma.raw(`'${groupBy}'`)}, u."timestamp") AS period,
            m."llm_model" AS "model",
            SUM(u."input_tokens") AS "totalInput",
            SUM(u."output_tokens") AS "totalOutput"
        FROM "UsageEvents" u
        JOIN "ChatMessage" m ON u."message_id" = m."id"
        WHERE u."user_id" = ${req.user.id}
        GROUP BY period, "model"
        ORDER BY period DESC, "totalInput" DESC;
    `;

    // Convert BigInt to Number. Cause JSON doesn't support BigInt, and Prisma returns BigInt for SUM aggregations.
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
            totalInput: Number(curr.totalInput || 0),
            totalOutput: Number(curr.totalOutput || 0),
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
            return chat ? { ...usage, name: chat.name } : null;
        })
        .filter(Boolean);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                result,
                "Top chats by tokens used retrieved successfully",
            ),
        );
});

export { totalTokensUsedInLifetime, tokensUsedByGroup, topChatsByTokensUsed };
