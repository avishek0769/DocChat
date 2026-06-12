import "dotenv/config";
import { Worker } from "bullmq";
import Bottleneck from "bottleneck";
import redis, { getChatProgressKey, updateChatProgress } from "./utils/redis.js";
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

async function processVector(docsRootUrl, chatId, collectionName, chatSourceId, scrapeLimit) {
    let pagesCrawled = 0;
    let pagesFailed = 0;
    try {
        const { maxPagesPerJob } = getWorkerConfig();
        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
        
        // Combined logic: enforce effective limit, then filter valid docs
        const effectiveLimit = typeof scrapeLimit === 'number' && scrapeLimit > 0 ? scrapeLimit : maxPagesPerJob;
        const allLinks = internalLinks.slice(0, effectiveLimit).filter(link => isValidDocUrl(link, rootUrl));
        const totalLinks = allLinks.length;

        console.log("Total unique valid links found:", totalLinks);

        await updateChatProgress(chatId, {
            status: "PROCESSING",
            current: 0,
            total: totalLinks,
            progress: 0,
        });

        const collections = await qdrant.getCollections();
        if (!collections.collections.some((c) => c.name === collectionName)) {
            await qdrant.createCollection(collectionName, {
                vectors: { size: 1536, distance: "Cosine" },
            });
        }

        let processedLinks = 0;
        const limiter = new Bottleneck({ maxConcurrent: 5 });

        await Promise.all(allLinks.map((link) => limiter.schedule(async () => {
            try {
                const { body, title } = await scrapeWebpage(link, rootUrl);
                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 150,
                });
                const chunks = await splitter.splitText(body);

                console.log(`Processing: ${link} (${chunks.length} chunks)`);

                if (chunks.length > 0) {
                    let allEmbeddings = [];
                    // Process embeddings in batches of 100
                    const batchSize = 100;
                    for (let i = 0; i < chunks.length; i += batchSize) {
                        const chunkBatch = chunks.slice(i, i + batchSize);
                        const embeddingsBatch = await generateVectorEmbeddings(chunkBatch);
                        // Make sure we concat correctly depending on whether generation returns an array
                        const batchArray = Array.isArray(embeddingsBatch) ? embeddingsBatch : [embeddingsBatch];
                        allEmbeddings = allEmbeddings.concat(batchArray);
                    }

                    const points = chunks.map((chunk, i) => ({
                        id: uuidv4(),
                        vector: allEmbeddings[i],
                        payload: {
                            url: link,
                            body: chunk,
                            chatId,
                            title,
                            chatSourceId,
                        },
                    }));

                    await qdrant.upsert(collectionName, {
                        wait: true,
                        points,
                    });

                    await prisma.documentPage.create({
                        data: {
                            pageUrl: link,
                            heading: title,
                            chatSourceId,
                        },
                    }).catch((err) => {
                        console.error("Failed to update indexed pages:", err.message);
                    });
                }

                pagesCrawled++;
                processedLinks++;
                await updateChatProgress(chatId, {
                    status: "PROCESSING",
                    current: processedLinks,
                    total: totalLinks,
                    progress: Math.round((processedLinks / totalLinks) * 100),
                });
            } catch (err) {
                pagesFailed++;
                console.error(`Failed link ${link}:`, err.message);
                // Concurrency branch logic: update progress rather than throwing/breaking out
                processedLinks++;
                await updateChatProgress(chatId, {
                    status: "PROCESSING",
                    current: processedLinks,
                    total: totalLinks,
                    progress: Math.round((processedLinks / totalLinks) * 100),
                });
            }
        })));
        
        return { pagesCrawled, pagesFailed };
    } catch (err) {
        err.pagesCrawled = pagesCrawled;
        err.pagesFailed = pagesFailed;
        await markChatFailed(chatId, err);
        throw err;
    }
}

async function processVectorLess(docsRootUrl, chatId, chatSourceId, scrapeLimit) {
    let pagesCrawled = 0;
    let pagesFailed = 0;
    try {
        const { maxPagesPerJob, vectorlessBatchSize } = getWorkerConfig();
        await updateChatProgress(chatId, { status: "PROCESSING", progress: 0 });

        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
        const effectiveLimit = typeof scrapeLimit === 'number' && scrapeLimit > 0 ? scrapeLimit : maxPagesPerJob;
        let allLinks = internalLinks.slice(0, effectiveLimit);
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        let allData = "";
        let i = 0;
        const pages = [];

        while (i < totalLinks) {
            const batchLinks = allLinks.slice(i, i + vectorlessBatchSize);
            if (batchLinks.length === 0) break;
            const results = await Promise.all(
                batchLinks.map(async (link) => {
                    if (!isValidDocUrl(link, rootUrl)) return null;
                    try {
                        const { title, body } = await scrapeWebpage(link, rootUrl);
                        pagesCrawled++;
                        return { link, title, body };
                    } catch (error) {
                        pagesFailed++;
                        console.error(`Failed: ${link}`, error.message);
                        return null;
                    }
                }),
            );

            for (const res of results) {
                if (!res) continue;
                const pageContent = `Title: ${res.title}\n ${res.body}\n\n`;
                const start = allData.length;
                allData += pageContent;
                const end = allData.length;
                pages.push({
                    pageUrl: res.link,
                    heading: res.title,
                    startIndex: start,
                    endIndex: end,
                });
            }
            i += vectorlessBatchSize;

            await updateChatProgress(chatId, {
                status: "PROCESSING",
                current: Math.min(i, totalLinks),
                total: totalLinks,
                progress: totalLinks ? Math.round((Math.min(i, totalLinks) / totalLinks) * 100) : 0,
            });
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

        if (pages.length > 0) {
            await prisma.documentPage.createMany({
                data: pages.map((page) => ({
                    pageUrl: page.pageUrl,
                    heading: page.heading,
                    chatSourceId,
                    startIndex: page.startIndex,
                    endIndex: page.endIndex,
                })),
            }).catch((err) => {
                console.error("Failed to update indexed pages:", err.message);
            });
        }

        await redis.setex(getChatProgressKey(chatId), 3600, JSON.stringify({ status: "READY", progress: 100 }));
        await updateChatProgress(chatId, { status: "READY", progress: 100 });

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

        return { pagesCrawled, pagesFailed };
    } catch (error) {
        error.pagesCrawled = pagesCrawled;
        error.pagesFailed = pagesFailed;
        console.error("Error VectorLess:", error);
        await markChatFailed(chatId, error);
        throw error;
    }
}

const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl, collectionName, chatSourceId, isVectorLess, scrapeLimit } = job.data;
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
            let stats = { pagesCrawled: 0, pagesFailed: 0 };
            if (!isVectorLess) {
                stats = await processVector(docsUrl, chatId, collectionName, chatSourceId, scrapeLimit);
            } else {
                stats = await processVectorLess(docsUrl, chatId, chatSourceId, scrapeLimit);
            }

            await prisma.ingestionRun.update({
                where: { id: run.id },
                data: {
                    status: "SUCCESS",
                    finishedAt: new Date(),
                    errorCode: null,
                    errorMessage: null,
                    pagesCrawled: stats.pagesCrawled,
                    pagesFailed: stats.pagesFailed,
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
                    pagesCrawled: err.pagesCrawled || 0,
                    pagesFailed: err.pagesFailed || 0,
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
        await updateChatProgress(job.data.chatId, { status: "READY", progress: 100 });
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

worker.on("failed", async (job, err) => {
    console.log(err);
    console.error(`Job ${job?.id} failed: ${err.message}`);
    if (job?.data?.chatId) {
        await updateChatProgress(job.data.chatId, { status: "FAILED" });
    }
});