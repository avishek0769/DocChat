import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { scrapeWebpage } from "../utils/rag.js";
import { Queue } from "bullmq";
import redis from "../utils/redis.js";

const chatCreationQueue = new Queue("chatCreation");

const expectation = asyncHandler(async (req, res) => {
    const { docsUrl } = req.query;

    try {
        const { internalLinks } = await scrapeWebpage(docsUrl, docsUrl);
        let allLinks = internalLinks.slice(0, 300);
        const sampleLinks = allLinks.slice(0, 10);

        const existingChatSource = await prisma.chatSource.findFirst({
            where: {
                documentationUrl: docsUrl,
            },
            include: {
                chats: { take: 1 },
                _count: {
                    select: { pagesIndexed: true },
                },
            },
        });
        if (existingChatSource) {
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        alreadyIngested: true,
                        expectedTokens: 0,
                        expectedCost: 0,
                        totalPages: allLinks.length,
                        pagesIndexed: existingChatSource._count.pagesIndexed,
                        pageLimitWarning: false,
                    },
                    "Documentation already ingested, returning existing expectation",
                ),
            );
        }

        let count = 0;
        let totalBodyLengthOfCount = 0;

        for (const link of sampleLinks) {
            const { body } = await scrapeWebpage(link, docsUrl);
            if (body) {
                totalBodyLengthOfCount += body.length;
                count++;
            }
        }

        if (count === 0) {
            throw new Error("Failed to scrape sample pages");
        }

        let expectedTokens = Math.ceil(
            ((totalBodyLengthOfCount / count) * allLinks.length) / 3.8,
        );
        let expectedCost = ((expectedTokens / 1000000) * 0.02).toFixed(4);

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    alreadyIngested: false,
                    expectedTokens,
                    expectedCost,
                    totalPages: allLinks.length,
                    pagesIndexed: 0,
                    pageLimitWarning: allLinks.length > 300,
                },
                "Expectation calculated successfully",
            ),
        );
    } catch (error) {
        throw new ApiError(500, error.message, error);
    }
});

const createChat = asyncHandler(async (req, res) => {
    let { name, docsUrl } = req.body;
    const { internalLinks, title } = await scrapeWebpage(docsUrl, docsUrl);
    name = name || title || "Untitled Chat";

    const existingChatSource = await prisma.chatSource.findFirst({
        where: {
            documentationUrl: docsUrl,
        },
        include: {
            chats: { take: 1 },
        },
    });

    if (existingChatSource) {
        const chat = await prisma.chat.create({
            data: {
                name,
                collectionName: existingChatSource.collectionName,
                chatSources: {
                    connect: {
                        id: existingChatSource.id,
                    },
                },
                status: "READY",
                userId: req.user.id,
            },
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { ...chat },
                    "Documentation already ingested, returning existing collection with new chat",
                ),
            );
    } else {
        const collectionName = `${name.replace(/\s+/g, "-")}-${Date.now()}`;
        const chat = await prisma.chat.create({
            data: {
                name,
                collectionName,
                chatSources: {
                    create: {
                        totalPages: internalLinks.length,
                        heading: name,
                        documentationUrl: docsUrl,
                        collectionName,
                    },
                },
                status: "QUEUED",
                userId: req.user.id,
            },
            include: {
                chatSources: true,
            },
        });

        chatCreationQueue.add(
            `${chat.id}-job`,
            {
                chatId: chat.id,
                docsUrl,
                collectionName: chat.collectionName,
                chatSourceId: chat.chatSources[0].id,
            },
            { jobId: chat.id },
        );

        res.status(200).json(
            new ApiResponse(
                200,
                { chatId: chat.id },
                "Chat creation initiated successfully",
            ),
        );
    }
});

const progressStatus = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
    });

    const redisData = await redis.get(chat.collectionName);
    const progress = redisData
        ? JSON.parse(redisData)
        : { status: "QUEUED", progress: 0 };

    res.status(200).json(
        new ApiResponse(
            200,
            { progress: progress },
            "Progress fetched successfully",
        ),
    );
});

const listAllChats = asyncHandler(async (req, res) => {
    const chats = await prisma.chat.findMany({
        where: { userId: req.user.id },
        include: {
            chatSources: {
                include: {
                    _count: {
                        select: { pagesIndexed: true },
                    },
                },
            },
            usageEvents: {
                select: {
                    inputTokens: true,
                    outputTokens: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    const chatsWithUsage = chats.map((chat) => {
        const totals = chat.usageEvents.reduce(
            (acc, curr) => {
                acc.inputTokens += curr.inputTokens;
                acc.outputTokens += curr.outputTokens;
                return acc;
            },
            { inputTokens: 0, outputTokens: 0 },
        );

        const { usageEvents, ...chatData } = chat;

        return {
            ...chatData,
            totalUsage: {
                input: totals.inputTokens,
                output: totals.outputTokens,
                total: totals.inputTokens + totals.outputTokens,
            },
        };
    });

    res.status(200).json(
        new ApiResponse(200, chatsWithUsage, "Chats fetched successfully"),
    );
});

const recentChats = asyncHandler(async (req, res) => {
    const chats = await prisma.chat.findMany({
        where: { userId: req.user.id },
        include: {
            chatSources: {
                include: {
                    _count: {
                        select: { pagesIndexed: true },
                    },
                },
            },
            usageEvents: {
                select: {
                    inputTokens: true,
                    outputTokens: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 6,
    });

    const chatsWithUsage = chats.map((chat) => {
        const totals = chat.usageEvents.reduce(
            (acc, curr) => {
                acc.inputTokens += curr.inputTokens;
                acc.outputTokens += curr.outputTokens;
                return acc;
            },
            { inputTokens: 0, outputTokens: 0 },
        );

        const { usageEvents, ...chatData } = chat;

        return {
            ...chatData,
            totalUsage: {
                input: totals.inputTokens,
                output: totals.outputTokens,
                total: totals.inputTokens + totals.outputTokens,
            },
        };
    });

    res.status(200).json(
        new ApiResponse(
            200,
            chatsWithUsage,
            "Recent chats fetched successfully",
        ),
    );
});

const chatDetails = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
            chatSources: {
                include: {
                    _count: { select: { pagesIndexed: true } },
                    pagesIndexed: true,
                },
            },
        },
    });

    res.status(200).json(
        new ApiResponse(200, { chat }, "Chat details fetched successfully"),
    );
});

const listAllPagesIndexed = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
            chatSources: {
                include: {
                    pagesIndexed: true,
                },
            },
        },
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                pagesIndexed: chat.chatSources.flatMap(
                    (source) => source.pagesIndexed,
                ),
            },
            "Pages indexed fetched successfully",
        ),
    );
});

const cancelProcessing = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
    });

    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    const jobs = await chatCreationQueue.getJobs(
        ["active", "waiting", "delayed"],
        0,
        -1,
        false,
    );
    const job = jobs.find((j) => j.id === chatId);

    if (job) {
        await job.remove();
        await redis.setex(
            chat.collectionName,
            3600,
            JSON.stringify({ status: "READY", progress: 100 }),
        );

        await prisma.chat
            .update({
                where: { id: chatId },
                data: { status: "READY" },
            })
            .catch((err) => {
                throw new ApiError(500, `Failed Update: ${err.message}`, err);
            });

        res.status(200).json(
            new ApiResponse(
                200,
                null,
                "Chat processing cancelled successfully",
            ),
        );
    } else {
        throw new ApiError(404, "Job not found or already completed");
    }
});

const deleteChat = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chatMessages = await prisma.chatMessage.findMany({
        where: { chatId },
    });
    for await (const message of chatMessages) {
        await prisma.chatMessageSource.deleteMany({
            where: { chatMessageId: message.id },
        });
    }
    await prisma.chatMessage.deleteMany({
        where: { chatId },
    });
    const chat = await prisma.chat.delete({
        where: { id: chatId },
    });

    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Chat deleted successfully"),
    );
});

export {
    expectation,
    createChat,
    progressStatus,
    listAllChats,
    chatDetails,
    cancelProcessing,
    deleteChat,
    listAllPagesIndexed,
    recentChats,
};
