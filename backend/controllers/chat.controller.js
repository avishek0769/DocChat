import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { scrapeWebpage } from "../utils/ragUtilities.js";
import { cleanupQdrantCollections } from "../utils/qdrantCleanup.js";
import redis, { getChatProgressKey, getChatProgressChannel, progressEmitter, redisSubscriber } from "../utils/redis.js";
import crypto from "crypto";
import { createAuditEvent } from "../utils/audit.js";
import { normalizeUrl } from "../utils/ragUtilities.js";
import { getChatCreationQueue } from "../utils/queue.js";
import { qdrant } from "../utils/ragClients.js";

const normalizeDocsUrl = (docsUrl) => normalizeUrl(docsUrl);

const normalizeBooleanLike = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return false;
};

function sourceUrlMatches(sourceUrl, docsUrl) {
    const candidates = new Set([docsUrl, normalizeDocsUrl(docsUrl)]);
    return candidates.has(sourceUrl);
}

async function findReusableChatSource(docsUrl, isVectorLessChat) {
    const normalizedUrl = normalizeDocsUrl(docsUrl);
    return prisma.chatSource.findFirst({
        where: {
            isVectorLess: isVectorLessChat,
            OR: [
                { documentationUrl: docsUrl },
                { documentationUrl: normalizedUrl },
            ],
        },
        include: {
            _count: {
                select: { pagesIndexed: true },
            },
            documentTree: true,
        },
    });
}

function isChatSourceReady(chatSource) {
    if (!chatSource) return false;
    if (chatSource.isVectorLess) return Boolean(chatSource.documentTree);
    return (chatSource._count?.pagesIndexed ?? chatSource.pagesIndexed?.length ?? 0) > 0;
}

function buildSourceCollectionName(source, fallbackName = "source") {
    const base = String(source?.heading || fallbackName)
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .slice(0, 48) || fallbackName;
    return `${base}-${Date.now()}`;
}

async function enqueueSourceIngestion({ chatId, chatSource, isVectorLessChat }) {
    getChatCreationQueue().add(
        `${chatId}-${chatSource.id}-job`,
        {
            chatId: String(chatId),
            docsUrl: chatSource.documentationUrl,
            collectionName: chatSource.collectionName,
            chatSourceId: String(chatSource.id),
            isVectorLess: isVectorLessChat,
        },
        { jobId: `${chatId}-${chatSource.id}` },
    );
}

const findChatSourceByUrlAndMode = async (docsUrl, isVectorLess) => {
    const normalizedDocsUrl = normalizeDocsUrl(docsUrl);
    return prisma.chatSource.findFirst({
        where: {
            documentationUrl: normalizedDocsUrl,
            isVectorLess,
        },
        include: {
            chats: { take: 1 },
            _count: {
                select: { pagesIndexed: true },
            },
        },
    });
};

const expectation = asyncHandler(async (req, res) => {
    const { docsUrl, isVectorLess } = req.query;
    const normalizedDocsUrl = normalizeDocsUrl(docsUrl);
    const isVectorLessChat = normalizeBooleanLike(isVectorLess);

    try {
        const { internalLinks } = await scrapeWebpage(normalizedDocsUrl, normalizedDocsUrl);
        let allLinks = internalLinks.slice(0, 300);
        const sampleLinks = allLinks.slice(0, 10);

        const existingChatSource = await findChatSourceByUrlAndMode(normalizedDocsUrl, isVectorLessChat);
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
            const { body } = await scrapeWebpage(link, docsUrls);
            if (body) {
                totalBodyLengthOfCount += body.length;
                count++;
            }
        }

        if (count === 0) {
            throw new Error("Failed to scrape sample pages");
        }

        let expectedTokens = Math.ceil(((totalBodyLengthOfCount / count) * allLinks.length) / 3.8);
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
    let { name, docsUrl, docsUrls, isVectorLess, scrapeLimit } = req.body;
    
    const isVectorLessChat = normalizeBooleanLike(isVectorLess);
    const urls = Array.from(new Set([...(docsUrls || []), ...(docsUrl ? [docsUrl] : [])]));
    
    if (!urls.length) {
        throw new ApiError(400, "At least one documentation URL is required.");
    }

    let resolvedName = name;
    
    if (!resolvedName) {
        const normalizedDocsUrl = normalizeDocsUrl(urls[0]);
        const { title } = await scrapeWebpage(normalizedDocsUrl, normalizedDocsUrl);
        resolvedName = title || "Untitled Chat";
    }

    const attachedSources = [];
    let needsIngestion = false;

    for (const rawUrl of urls) {
        const normalizedUrl = normalizeDocsUrl(rawUrl);
        let chatSource = await findReusableChatSource(normalizedUrl, isVectorLessChat);

        if (!chatSource) {
            const { internalLinks, title } = await scrapeWebpage(normalizedUrl, normalizedUrl);
            resolvedName = resolvedName || title || "Untitled Chat";
            chatSource = await prisma.chatSource.create({
                data: {
                    totalPages: internalLinks.length,
                    heading: title || resolvedName || "Untitled Chat",
                    documentationUrl: normalizedUrl,
                    collectionName: isVectorLessChat ? null : buildSourceCollectionName({ heading: title || resolvedName }),
                    isVectorLess: isVectorLessChat,
                    scrapeLimit: scrapeLimit ? Number(scrapeLimit) : null,
                },
                include: {
                    _count: { select: { pagesIndexed: true } },
                    documentTree: true,
                },
            });
            needsIngestion = true;
        } else {
            resolvedName = resolvedName || chatSource.heading || "Untitled Chat";
        }

        attachedSources.push(chatSource);
        needsIngestion = needsIngestion || !isChatSourceReady(chatSource);
    }

    const chat = await prisma.chat.create({
        data: {
            name: resolvedName || "Untitled Chat",
            collectionName: attachedSources[0]?.collectionName || null,
            chatSources: {
                connect: attachedSources.map((source) => ({ id: source.id })),
            },
            status: needsIngestion ? "QUEUED" : "READY",
            userId: req.user.id,
        },
        include: {
            chatSources: true,
        },
    });

    for (const source of attachedSources) {
        if (isChatSourceReady(source)) continue;
        await enqueueSourceIngestion({ chatId: chat.id, chatSource: source, isVectorLessChat });
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { chatId: chat.id, status: chat.status },
            needsIngestion
                ? "Chat creation initiated successfully"
                : "Documentation already ingested, returning existing sources with new chat",
        ),
    );
});

const addChatSource = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { docsUrl, isVectorLess, scrapeLimit } = req.body;
    const isVectorLessChat = normalizeBooleanLike(isVectorLess);

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { chatSources: true },
    });
    
    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    const normalizedUrl = normalizeDocsUrl(docsUrl);
    let chatSource = await findReusableChatSource(normalizedUrl, isVectorLessChat);
    let needsIngestion = false;
    let isNew = false;

    if (!chatSource) {
        try {
            const { internalLinks, title } = await scrapeWebpage(normalizedUrl, normalizedUrl);
            chatSource = await prisma.chatSource.create({
                data: {
                    totalPages: internalLinks.length,
                    heading: title || chat.name || "Untitled Chat",
                    documentationUrl: normalizedUrl,
                    collectionName: isVectorLessChat
                        ? null
                        : buildSourceCollectionName({
                              heading: title || chat.name,
                          }),
                    isVectorLess: isVectorLessChat,
                    scrapeLimit: scrapeLimit ? Number(scrapeLimit) : null,
                },
                include: {
                    _count: { select: { pagesIndexed: true } },
                    documentTree: true,
                },
            });
            needsIngestion = true;
            isNew = true;
        } catch (error) {
            if (error.code === "P2002") { // Unique constraint violation
                chatSource = await prisma.chatSource.findUnique({
                    where: {
                        documentationUrl_isVectorLess: {
                            documentationUrl: normalizedUrl,
                            isVectorLess: isVectorLessChat,
                        },
                    },
                    include: {
                        _count: { select: { pagesIndexed: true } },
                        documentTree: true,
                    }
                });
                if (!chatSource) {
                    throw new ApiError(500, "Failed to retrieve existing ChatSource after unique constraint violation.");
                }
            } else {
                throw error; // Rethrow other errors
            }
        }
    }

    const alreadyAttached = chat.chatSources.some((source) => source.id === chatSource.id);
    if (!alreadyAttached) {
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                chatSources: { connect: { id: chatSource.id } },
            },
        });
    }

    if (!isChatSourceReady(chatSource)) {
        needsIngestion = true;
        await enqueueSourceIngestion({ chatId: chat.id, chatSource, isVectorLessChat });
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                chatId: chat.id,
                chatSourceId: chatSource.id,
                attached: true,
                status: needsIngestion ? "QUEUED" : "READY",
                docsUrl: normalizedUrl,
                collectionName: chat.collectionName,
                isVectorLess: isVectorLessChat,
                scrapeLimit,
                isNew,
            },
            "Source attached successfully",
        ),
    );
});

const removeChatSource = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { docsUrl, isVectorLess } = req.body;
    const isVectorLessChat = normalizeBooleanLike(isVectorLess);

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { chatSources: true },
    });
    
    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    const normalizedUrl = normalizeDocsUrl(docsUrl);
    const chatSource = chat.chatSources.find(
        (source) => source.isVectorLess === isVectorLessChat && sourceUrlMatches(source.documentationUrl, normalizedUrl),
    );

    if (!chatSource) {
        throw new ApiError(404, "Source not attached to chat");
    }

    await prisma.chat.update({
        where: { id: chatId },
        data: {
            chatSources: {
                disconnect: { id: chatSource.id },
            },
        },
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                chatId,
                chatSourceId: chatSource.id,
                detached: true,
            },
            "Source detached successfully",
        ),
    );
});

const DEFAULT_PROGRESS = {
    status: "QUEUED",
    current: 0,
    total: 0,
    progress: 0,
};

const sanitizeFailureReason = (value) => {
    if (!value) return null;
    const safe = String(value)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!safe) return null;
    return safe.length > 200 ? `${safe.slice(0, 197)}...` : safe;
};

const normalizeProgress = (progress = {}) => {
    const data = progress && typeof progress === "object" ? progress : {};

    return {
        ...DEFAULT_PROGRESS,
        ...data,
        current: Number.isFinite(data.current) ? data.current : DEFAULT_PROGRESS.current,
        total: Number.isFinite(data.total) ? data.total : DEFAULT_PROGRESS.total,
        progress: Number.isFinite(data.progress) ? data.progress : DEFAULT_PROGRESS.progress,
    };
};

const progressStatus = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            userId: req.user.id,
        },
        select: {
            id: true,
            status: true,
            failedAt: true,
            failureReason: true,
            deletedAt: true,
        },
    });

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    const latestIngestionRun = await prisma.ingestionRun.findFirst({
        where: { chatId: chat.id },
        orderBy: { startedAt: "desc" },
        select: {
            id: true,
            chatId: true,
            chatSourceId: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            errorCode: true,
            errorMessage: true,
            pagesCrawled: true,
            pagesFailed: true,
        },
    });

    const redisData = await redis.get(getChatProgressKey(chat.id));
    const redisProgress = redisData ? JSON.parse(redisData) : null;
    const failureReason =
        chat.status === "FAILED"
            ? sanitizeFailureReason(chat.failureReason) ||
              sanitizeFailureReason(latestIngestionRun?.errorMessage) ||
              sanitizeFailureReason(redisProgress?.failureReason)
            : null;
            
    const progress = normalizeProgress(
        redisProgress || {
            status: chat.status,
            progress: chat.status === "READY" ? 100 : 0,
            failureReason,
        },
    );

    const response = {
        progress,
        latestIngestionRun,
    };

    if (chat.status === "FAILED") {
        response.failureReason = failureReason;
    }

    res.status(200).json(new ApiResponse(200, response, "Progress fetched successfully"));
});

const streamChatStatus = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            userId: req.user.id,
        },
        select: { id: true, deletedAt: true },
    });

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const redisData = await redis.get(getChatProgressKey(chatId));
    const initialProgress = normalizeProgress(redisData ? JSON.parse(redisData) : DEFAULT_PROGRESS);
    
    res.write(`data: ${JSON.stringify({ progress: initialProgress })}\n\n`);

    if (["READY", "FAILED", "CANCELLED"].includes(initialProgress.status)) {
        res.end();
        return;
    }

    const channel = getChatProgressChannel(chatId);

    if (progressEmitter.listenerCount(channel) === 0) {
        redisSubscriber.subscribe(channel);
    }

    const listener = (message) => {
        const progress = normalizeProgress(JSON.parse(message));
        res.write(`data: ${JSON.stringify({ progress })}\n\n`);
        
        if (["READY", "FAILED", "CANCELLED"].includes(progress.status)) {
            cleanup();
        }
    };

    progressEmitter.on(channel, listener);

    const cleanup = () => {
        progressEmitter.off(channel, listener);
        if (progressEmitter.listenerCount(channel) === 0) {
            redisSubscriber.unsubscribe(channel);
        }
        res.end();
    };

    req.on("close", cleanup);
});

const recentFailedIngestionRuns = asyncHandler(async (req, res) => {
    const limitRaw = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const allowAll =
        process.env.ADMIN_USERNAME &&
        req.user?.username &&
        req.user.username === process.env.ADMIN_USERNAME;

    const runs = await prisma.ingestionRun.findMany({
        where: allowAll
            ? { status: "FAILED" }
            : {
                  status: "FAILED",
                  chat: {
                      userId: req.user.id,
                  },
              },
        orderBy: { startedAt: "desc" },
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
            chat: { select: { name: true, userId: true } },
            chatSource: { select: { heading: true, documentationUrl: true } },
        },
    });

    res.status(200).json(new ApiResponse(200, { runs }, "Failed ingestion runs fetched successfully"));
});

const qdrantCleanup = asyncHandler(async (req, res) => {
    const isAdmin =
        process.env.ADMIN_USERNAME &&
        req.user?.username &&
        req.user.username === process.env.ADMIN_USERNAME;

    if (!isAdmin) {
        throw new ApiError(403, "Admin privileges required to run Qdrant cleanup.");
    }

    const { force, minAgeDays } = req.query;
    const forceExecution = Boolean(force);
    const cleanupResult = await cleanupQdrantCollections({
        force: forceExecution,
        minAgeDays: Number.isFinite(Number(minAgeDays)) ? Number(minAgeDays) : undefined,
    });

    res.status(200).json(
        new ApiResponse(
            200,
            cleanupResult,
            forceExecution
                ? "Qdrant cleanup completed successfully"
                : "Qdrant cleanup dry-run completed successfully",
        ),
    );
});

const listAllChats = asyncHandler(async (req, res) => {
    const chats = await prisma.chat.findMany({
        where: { userId: req.user.id, deletedAt: null },
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
                acc.inputTokens += curr.inputTokens ?? 0;
                acc.outputTokens += curr.outputTokens ?? 0;
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

    res.status(200).json(new ApiResponse(200, chatsWithUsage, "Chats fetched successfully"));
});

const recentChats = asyncHandler(async (req, res) => {
    const chats = await prisma.chat.findMany({
        where: { userId: req.user.id, deletedAt: null },
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
                acc.inputTokens += curr.inputTokens ?? 0;
                acc.outputTokens += curr.outputTokens ?? 0;
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

    res.status(200).json(new ApiResponse(200, chatsWithUsage, "Recent chats fetched successfully"));
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

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    res.status(200).json(new ApiResponse(200, { chat }, "Chat details fetched successfully"));
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

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                pagesIndexed: chat.chatSources.flatMap((source) => source.pagesIndexed),
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

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    const jobs = await getChatCreationQueue().getJobs(["active", "waiting", "delayed"], 0, -1, false);
    const job = jobs.find((j) => j.id === chatId);

    if (job) {
        await job.remove();
    }

    await redis.setex(getChatProgressKey(chatId), 3600, JSON.stringify({ status: "READY", progress: 100 }));

    await prisma.chat
        .update({
            where: { id: chatId },
            data: { status: "READY" },
        })
        .catch((err) => {
            throw new ApiError(500, `Failed Update: ${err.message}`, err);
        });

    res.status(200).json(new ApiResponse(200, null, "Chat processing cancelled successfully"));
});

const deleteChat = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: {
            id: true,
            userId: true,
            deletedAt: true,
        },
    });

    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    if (chat.userId !== req.user.id) {
        throw new ApiError(403, "You do not have permission to delete this chat");
    }

    if (chat.deletedAt) {
        throw new ApiError(400, "Chat is already deleted");
    }

    await prisma.chat.update({
        where: { id: chatId },
        data: { deletedAt: new Date() },
    });

    await createAuditEvent("chat.deleted", req.user.id, chatId, {});

    res.status(200).json(
        new ApiResponse(200, null, "Chat deleted successfully"),
    );
});

const restoreChat = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: {
            id: true,
            userId: true,
            deletedAt: true,
        },
    });

    if (!chat) {
        throw new ApiError(404, "Chat not found");
    }

    if (chat.userId !== req.user.id) {
        throw new ApiError(403, "You do not have permission to restore this chat");
    }

    if (!chat.deletedAt) {
        throw new ApiError(400, "Chat is not deleted");
    }

    await prisma.chat.update({
        where: { id: chatId },
        data: { deletedAt: null },
    });

    await createAuditEvent("chat.restored", req.user.id, chatId, {});

    res.status(200).json(
        new ApiResponse(200, null, "Chat restored successfully"),
    );
});

const toggleShare = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
    });

    if (!chat || chat.deletedAt) {
        throw new ApiError(404, "Chat not found");
    }

    if (chat.shareToken) {
        const updatedChat = await prisma.chat.update({
            where: { id: chatId },
            data: { shareToken: null },
        });
        res.status(200).json(new ApiResponse(200, updatedChat, "Chat share revoked successfully"));
    } else {
        const shareToken = crypto.randomUUID();
        const updatedChat = await prisma.chat.update({
            where: { id: chatId },
            data: { shareToken },
        });
        res.status(200).json(new ApiResponse(200, updatedChat, "Chat shared successfully"));
    }
});

const getSharedChatDetails = asyncHandler(async (req, res) => {
    const { shareToken } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { shareToken },
        include: {
            chatSources: {
                include: {
                    _count: { select: { pagesIndexed: true } },
                    pagesIndexed: true,
                },
            },
        },
    });

    if (!chat) {
        throw new ApiError(404, "Shared chat not found or link has expired");
    }

    res.status(200).json(new ApiResponse(200, { chat }, "Shared chat details fetched successfully"));
});

const forkSharedChat = asyncHandler(async (req, res) => {
    const { shareToken } = req.params;

    const originalChat = await prisma.chat.findUnique({
        where: { shareToken },
        include: {
            chatSources: true,
            messages: {
                include: {
                    sourceChunks: true,
                },
            },
        },
    });

    if (!originalChat) {
        throw new ApiError(404, "Shared chat not found or link has expired");
    }

    const newChat = await prisma.chat.create({
        data: {
            name: `${originalChat.name} (Fork)`,
            collectionName: originalChat.collectionName,
            status: "READY",
            userId: req.user.id,
            chatSources: {
                connect: originalChat.chatSources.map((source) => ({ id: source.id })),
            },
        },
    });

    await createAuditEvent("chat.created", req.user.id, newChat.id, {
        forkedFromShareToken: shareToken,
        originalChatId: originalChat.id,
    });

    for (const msg of originalChat.messages) {
        const newMessage = await prisma.chatMessage.create({
            data: {
                chatId: newChat.id,
                userPrompt: msg.userPrompt,
                llmResponse: msg.llmResponse,
                llmModel: msg.llmModel,
                createdAt: msg.createdAt,
            },
        });

        if (msg.sourceChunks && msg.sourceChunks.length > 0) {
            await prisma.chatMessageSource.createMany({
                data: msg.sourceChunks.map((chunk) => ({
                    chunkText: chunk.chunkText,
                    heading: chunk.heading,
                    pageUrl: chunk.pageUrl,
                    score: chunk.score,
                    chatMessageId: newMessage.id,
                })),
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { chatId: newChat.id }, "Chat successfully forked to your account"),
    );
});

const downloadRawSource = asyncHandler(async (req, res) => {
    const { chatId, sourceId } = req.params;

    const chatSource = await prisma.chatSource.findFirst({
        where: {
            id: sourceId,
            chats: { some: { id: chatId } }
        },
        include: {
            documentTree: true
        }
    });

    if (!chatSource) {
        throw new ApiError(404, "Source not found or does not belong to this chat");
    }

    let rawText = "";

    if (chatSource.isVectorLess) {
        if (!chatSource.documentTree?.sourceData) {
            throw new ApiError(404, "Raw source data not available yet");
        }
        rawText = chatSource.documentTree.sourceData;
    } else {
        if (!chatSource.collectionName) {
            throw new ApiError(404, "Vector collection not initialized");
        }

        let nextOffset = null;
        do {
            const response = await qdrant.scroll(chatSource.collectionName, {
                filter: {
                    must: [{ key: "chatSourceId", match: { value: sourceId } }]
                },
                limit: 1000,
                offset: nextOffset
            });

            for (const point of response.points) {
                rawText += `--- ${point.payload.title || 'Page'} (${point.payload.url}) ---\n`;
                rawText += `${point.payload.body}\n\n`;
            }

            nextOffset = response.next_page_offset;
        } while (nextOffset);

        if (!rawText) {
            throw new ApiError(404, "No raw text found in the vector database");
        }
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="source-${sourceId}-raw.txt"`);
    res.send(rawText);
});

export {
    expectation,
    createChat,
    addChatSource,
    removeChatSource,
    progressStatus,
    streamChatStatus,
    recentFailedIngestionRuns,
    qdrantCleanup,
    listAllChats,
    chatDetails,
    cancelProcessing,
    deleteChat,
    restoreChat,
    listAllPagesIndexed,
    recentChats,
    toggleShare,
    getSharedChatDetails,
    forkSharedChat,
    downloadRawSource,
};