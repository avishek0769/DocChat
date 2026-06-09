import "dotenv/config";
import { Worker } from "bullmq";
import redis, { getChatProgressKey } from "./utils/redis.js";
import {
    normalizeUrl,
    isValidDocUrl,
    scrapeWebpage,
    generateVectorEmbeddings,
} from "./utils/ragUtilities.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { treeindex, qdrant } from "./utils/ragClients.js";
import { v4 as uuidv4 } from "uuid";
import prisma from "./utils/prismaClient.js";
import { createAuditEvent } from "./utils/audit.js";

function sanitizeErrorMessage(message) {
    if (!message) return null;
    const safe = String(message)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!safe) return null;
    return safe.length > 200 ? `${safe.slice(0, 197)}...` : safe;
}

async function markChatFailed(chatId, error) {
    const failureReason = sanitizeErrorMessage(error?.message) || "Ingestion failed";

    await redis.setex(
        getChatProgressKey(chatId),
        3600,
        JSON.stringify({
            status: "FAILED",
            progress: 0,
            failureReason,
        }),
    );

    await prisma.chat
        .update({
            where: { id: chatId },
            data: {
                status: "FAILED",
                failedAt: new Date(),
                failureReason,
            },
        })
        .catch((dbError) => {
            console.error("Failed to persist chat failure state:", dbError.message);
        });

    return failureReason;
}

function getErrorCode(err) {
    if (!err) return "UNKNOWN_ERROR";
    if (typeof err.code === "string" && err.code.trim()) return err.code.trim().slice(0, 64);
    if (typeof err.name === "string" && err.name.trim()) return err.name.trim().slice(0, 64);
    return "UNKNOWN_ERROR";
}

function readPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getWorkerConfig() {
    return {
        maxPagesPerJob: readPositiveInt(process.env.CRAWL_MAX_PAGES_PER_JOB, 300),
        vectorlessBatchSize: readPositiveInt(process.env.CRAWL_VECTORLESS_BATCH_SIZE, 5),
        workerConcurrency: readPositiveInt(process.env.CHAT_WORKER_CONCURRENCY, 1),
    };
}

async function processVector(docsRootUrl, chatId, collectionName, chatSourceId) {
    try {
        const { maxPagesPerJob } = getWorkerConfig();
        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
        let allLinks = internalLinks.slice(0, maxPagesPerJob);
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        await redis.setex(
            getChatProgressKey(chatId),
            3600,
            JSON.stringify({
                status: "PROCESSING",
                current: 0,
                total: totalLinks,
                progress: 0,
            }),
        );

        const collections = await qdrant.getCollections();
        if (!collections.collections.some((c) => c.name === collectionName)) {
            await qdrant.createCollection(collectionName, {
                vectors: { size: 1536, distance: "Cosine" },
            });
        }

        let batchPoints = [];
        let batchPage = [];
        let pageCount = 0;

        for (const [index, link] of allLinks.entries()) {
            if (!isValidDocUrl(link, rootUrl)) continue;

            try {
                const { body, title } = await scrapeWebpage(link, rootUrl);
                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 150,
                });
                const chunks = await splitter.splitText(body);

                batchPage.push({
                    pageUrl: link,
                    heading: title,
                });

                console.log(`Processing: ${link} (${chunks.length} chunks)`);

                for (const chunk of chunks) {
                    const emb = await generateVectorEmbeddings(chunk);

                    batchPoints.push({
                        id: uuidv4(),
                        vector: emb,
                        payload: {
                            url: link,
                            body: chunk,
                            chatId,
                            title,
                            chatSourceId,
                        },
                    });
                }

                pageCount++;

                if (pageCount >= 3 || index === totalLinks - 1) {
                    if (batchPoints.length > 0) {
                        console.log(`Upserting batch of ${batchPoints.length} points...`);
                        await qdrant.upsert(collectionName, {
                            wait: true,
                            points: batchPoints,
                        });

                        await prisma.documentPage
                            .createMany({
                                data: batchPage.map((point) => ({
                                    pageUrl: point.pageUrl,
                                    heading: point.heading,
                                    chatSourceId,
                                })),
                            })
                            .catch((err) => {
                                console.error("Failed to update indexed pages:", err.message);
                            });

                        batchPoints = [];
                        batchPage = [];
                        pageCount = 0;
                    }

                    await redis.setex(
                        getChatProgressKey(chatId),
                        3600,
                        JSON.stringify({
                            status: "PROCESSING",
                            current: index + 1,
                            total: totalLinks,
                            progress: Math.round(((index + 1) / totalLinks) * 100),
                        }),
                    );
                }
            } catch (err) {
                console.error(`Failed link ${link}:`, err.message);
                await markChatFailed(chatId, err);
                continue;
            }
        }
    } catch (err) {
        await markChatFailed(chatId, err);
        throw err;
    }
}

async function processVectorLess(docsRootUrl, chatId, chatSourceId) {
    try {
        const { maxPagesPerJob, vectorlessBatchSize } = getWorkerConfig();
        await redis.setex(getChatProgressKey(chatId), 3600, JSON.stringify({ status: "PROCESSING", progress: 0 }));

        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
        let allLinks = internalLinks.slice(0, maxPagesPerJob);
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        let batchLinks = allLinks.slice(0, vectorlessBatchSize);
        let allData = "";
        let i = 0;

        while (batchLinks.length > 0) {
            batchLinks = allLinks.slice(i, i + vectorlessBatchSize);
            const results = await Promise.all(
                batchLinks.map(async (link) => {
                    if (!isValidDocUrl(link, rootUrl)) return "";
                    try {
                        const { title, body } = await scrapeWebpage(link, rootUrl);
                        return `Title: ${title}\n ${body}\n\n`;
                    } catch (error) {
                        console.error(`Failed: ${link}`, error.message);
                        return "";
                    }
                }),
            );

            allData += results.join("");
            i += vectorlessBatchSize;

            await redis.setex(
                getChatProgressKey(chatId),
                3600,
                JSON.stringify({
                    status: "PROCESSING",
                    current: Math.min(i, totalLinks),
                    total: totalLinks,
                    progress: totalLinks ? Math.round((Math.min(i, totalLinks) / totalLinks) * 100) : 0,
                }),
            );
        }

        if (!allData.trim()) {
            throw new Error("No data scraped.");
        }

        treeindex.loadData(allData);
        const tree = await treeindex.generateTree();
        console.log("Generated Tree Length:", tree.length);

        const docTree = await prisma.documentTree.create({
            data: {
                chatSourceId,
                treeData: tree,
                sourceData: allData,
            },
        });

        await redis.setex(getChatProgressKey(chatId), 3600, JSON.stringify({ status: "READY", progress: 100 }));

        await prisma.chat.update({
            where: { id: chatId },
            data: {
                collectionName: docTree.id,
                status: "READY",
                chatSources: {
                    update: {
                        where: { id: chatSourceId },
                        data: { collectionName: docTree.id },
                    },
                },
            },
        });

        return;
    } catch (error) {
        console.error("Error VectorLess:", error);
        await markChatFailed(chatId, error);
        throw error;
    }
}

const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl, collectionName, chatSourceId, isVectorLess } = job.data;
        const run = await prisma.ingestionRun.create({
            data: {
                chatId,
                chatSourceId,
                status: "STARTED",
            },
        });

        await createAuditEvent("ingestion.started", null, chatId, {
            ingestionRunId: run.id,
            chatSourceId,
            isVectorLess,
        });

        try {
            if (!isVectorLess) {
                await processVector(docsUrl, chatId, collectionName, chatSourceId);
            } else {
                await processVectorLess(docsUrl, chatId, chatSourceId);
            }

            await prisma.ingestionRun.update({
                where: { id: run.id },
                data: {
                    status: "SUCCESS",
                    finishedAt: new Date(),
                    errorCode: null,
                    errorMessage: null,
                },
            });

            await createAuditEvent("ingestion.completed", null, chatId, {
                ingestionRunId: run.id,
                status: "SUCCESS",
            });
        } catch (err) {
            await markChatFailed(chatId, err);
            await prisma.ingestionRun.update({
                where: { id: run.id },
                data: {
                    status: "FAILED",
                    finishedAt: new Date(),
                    errorCode: getErrorCode(err),
                    errorMessage: sanitizeErrorMessage(err?.message),
                },
            });
            await createAuditEvent("ingestion.failed", null, chatId, {
                ingestionRunId: run.id,
                errorCode: getErrorCode(err),
                errorMessage: sanitizeErrorMessage(err?.message),
            });
            throw err;
        }
    },
    {
        connection: redis,
        concurrency: getWorkerConfig().workerConcurrency,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 500 },
    },
);

worker.on("completed", async (job) => {
    console.log(`Job ${job.id} completed!`);
    if (!job.data.isVectorLess) {
        await redis.setex(
            job.data.collectionName,
            3600,
            JSON.stringify({ status: "READY", progress: 100 }),
        );
    }

    await prisma.chat
        .update({
            where: { id: job.data.chatId },
            data: { status: "READY" },
        })
        .catch((err) => {
            console.error("Update status Failed:", err.message);
        });
});

worker.on("failed", (job, err) => {
    console.log(err);
    console.error(`Job ${job?.id} failed: ${err.message}`);
});
