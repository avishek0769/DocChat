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
        }
    })
    return res.status(200).json(new ApiResponse(
        200,
        usage,
        "Total tokens used in lifetime retrieved successfully"
    ));
})

const tokensUsedByGroup = asyncHandler(async (req, res) => {
    const { groupBy } = req.params;

    const allowedGroups = ['day', 'week', 'month', 'year'];
    if (!allowedGroups.includes(groupBy)) {
        throw new ApiError(400, `Invalid groupBy parameter. Allowed values are: ${allowedGroups.join(', ')}`);
    }

    const usageByGroup = await prisma.$queryRaw`
        SELECT 
            DATE_TRUNC(${Prisma.raw(`'${groupBy}'`)}, "timestamp") AS period,
            SUM("input_tokens") AS "totalInput",
            SUM("output_tokens") AS "totalOutput"
        FROM "UsageEvents"
        WHERE "user_id" = ${req.user.id}
        GROUP BY period
        ORDER BY period DESC;
    `;

    // Convert BigInt to Number. Cause JSON doesn't support BigInt, and Prisma returns BigInt for SUM aggregations.
    const serializedUsage = usageByGroup.map(row => ({
        ...row,
        totalInput: Number(row.totalInput),
        totalOutput: Number(row.totalOutput)
    }));

    return res.status(200).json(new ApiResponse(
        200,
        serializedUsage,
        "Usage retrieved successfully"
    ));
});

const topChatsByTokensUsed = asyncHandler(async (req, res) => {
    const topChats = await prisma.$queryRaw`
        SELECT 
            m."chat_id" AS "chatId",
            SUM(u."input_tokens") AS "totalInput",
            SUM(u."output_tokens") AS "totalOutput",
            (SUM(u."input_tokens") + SUM(u."output_tokens")) AS "totalTokens"
        FROM "UsageEvents" u
        JOIN "ChatMessage" m ON u."message_id" = m."id"
        WHERE u."user_id" = ${req.user.id}
        GROUP BY m."chat_id"
        ORDER BY "totalTokens" DESC
        LIMIT 3;
    `;

    topChats.forEach(chat => {
        chat.totalInput = Number(chat.totalInput);
        chat.totalOutput = Number(chat.totalOutput);
        chat.totalTokens = Number(chat.totalTokens);
    });

    return res.status(200).json(new ApiResponse(
        200,
        topChats,
        "Top chats by tokens used retrieved successfully"
    ));
})

export { totalTokensUsedInLifetime, tokensUsedByGroup, topChatsByTokensUsed };