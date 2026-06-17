import "dotenv/config";
import { Worker } from "bullmq";
import redis, { redisSub } from "./utils/redis.js";
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

function sanitizeErrorMessage(message) {
    if (!message) return null;
    const safe = String(message)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!safe) return null;
    return safe.length > 200 ? `${safe.slice(0, 197)}...` : safe;
}

function getErrorCode(err) {
    if (!err) return "UNKNOWN_ERROR";
    if (typeof err.code === "string" && err.code.trim()) return err.code.trim().slice(0, 64);
    if (typeof err.name === "string" && err.name.trim()) return err.name.trim().slice(0, 64);
    return "UNKNOWN_ERROR";
}

// Uses BullMQ's native AbortSignal instead of manual Redis polling.
// signal.aborted is set to true the moment worker.cancelJob(jobId) is called,
// which we trigger from the pub/sub subscriber below.
async function processVector(docsRootUrl, chatId, collectionName, chatSourceId, signal) {
    try {
        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl, { signal });
        let allLinks = internalLinks.slice(0, 300);
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        await redis.setex(chatId, 3600, JSON.stringify({
            status: "PROCESSING", current: 0, total: totalLinks, progress: 0,
        }));

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
            // Check BullMQ's native signal between every link
            if (signal?.aborted) throw Object.assign(new Error("INGESTION_CANCELLED"), { code: "INGESTION_CANCELLED" });
            if (!isValidDocUrl(link, rootUrl)) continue;

            try {
                const { body, title } = await scrapeWebpage(link, rootUrl, { signal });
                const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 150 });
                const chunks = await splitter.splitText(body);

                batchPage.push({ pageUrl: link, heading: title });
                console.log(`Processing: ${link} (${chunks.length} chunks)`);

                for (const chunk of chunks) {
                    // Check between every embedding call too
                    if (signal?.aborted) throw Object.assign(new Error("INGESTION_CANCELLED"), { code: "INGESTION_CANCELLED" });
                    const emb = await generateVectorEmbeddings(chunk, signal);
                    batchPoints.push({
                        id: uuidv4(),
                        vector: emb,
                        payload: { url: link, body: chunk, chatId, title, chatSourceId },
                    });
                }

                pageCount++;

                if (pageCount >= 3 || index === totalLinks - 1) {
                    if (batchPoints.length > 0) {
                        console.log(`Upserting batch of ${batchPoints.length} points...`);
                        await qdrant.upsert(collectionName, { wait: true, points: batchPoints });

                        await prisma.documentPage.createMany({
                            data: batchPage.map((point) => ({
                                pageUrl: point.pageUrl,
                                heading: point.heading,
                                chatSourceId,
                            })),
                        }).catch((err) => {
                            console.error("Failed to update indexed pages:", err.message);
                        });

                        batchPoints = [];
                        batchPage = [];
                        pageCount = 0;
                    }

                    await redis.setex(chatId, 3600, JSON.stringify({
                        status: "PROCESSING",
                        current: index + 1,
                        total: totalLinks,
                        progress: Math.round(((index + 1) / totalLinks) * 100),
                    }));
                }
            } catch (err) {
                // Re-throw cancellation so the outer catch handles it properly
                if (err.code === "INGESTION_CANCELLED" || signal?.aborted) throw err;
                console.error(`Failed link ${link}:`, err.message);
                continue;
            }
        }
    } catch (err) {
        if (err.code !== "INGESTION_CANCELLED") {
            await redis.setex(chatId, 3600, JSON.stringify({ status: "FAILED" }));
        }
        throw err;
    }
}

async function processVectorLess(docsRootUrl, chatId, chatSourceId, signal) {
    try {
        await redis.setex(chatId, 3600, JSON.stringify({ status: "PROCESSING", progress: 0 }));

        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl, { signal });
        let allLinks = internalLinks.slice(0, 300);
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        let allData = "";
        let i = 0;

        while (i < totalLinks) {
            if (signal?.aborted) throw Object.assign(new Error("INGESTION_CANCELLED"), { code: "INGESTION_CANCELLED" });

            const batchLinks = allLinks.slice(i, i + 5);
            const results = await Promise.all(
                batchLinks.map(async (link) => {
                    if (!isValidDocUrl(link, rootUrl)) return "";
                    try {
                        const { title, body } = await scrapeWebpage(link, rootUrl, { signal });
                        return `Title: ${title}\n ${body}\n\n`;
                    } catch (error) {
                        if (signal?.aborted) return "";
                        console.error(`Failed: ${link}`, error.message);
                        return "";
                    }
                }),
            );

            allData += results.join("");
            i += 5;
        }

        if (!allData.trim()) throw new Error("No data scraped.");

        treeindex.loadData(allData);
        const tree = await treeindex.generateTree();
        console.log("Generated Tree Length:", tree.length);

        // Final check before writing to DB
        if (signal?.aborted) throw Object.assign(new Error("INGESTION_CANCELLED"), { code: "INGESTION_CANCELLED" });

        const docTree = await prisma.documentTree.create({
            data: { chatSourceId, treeData: tree, sourceData: allData },
        });

        await redis.setex(chatId, 3600, JSON.stringify({ status: "READY", progress: 100 }));

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
        if (error.code !== "INGESTION_CANCELLED") {
            await redis.setex(chatId, 3600, JSON.stringify({ status: "FAILED" }));
        }
        throw error;
    }
}

const worker = new Worker(
    "chatCreation",
    // BullMQ passes the native AbortSignal as the third argument.
    // Calling worker.cancelJob(jobId) sets signal.aborted = true immediately,
    // which propagates into scrapeWebpage and generateVectorEmbeddings via fetch({ signal }).
    async (job) => {
    const { chatId, docsUrl, collectionName, chatSourceId, isVectorLess } = job.data;

    // Own AbortController — BullMQ's native signal isn't a real AbortSignal
    const controller = new AbortController();

    const cancelChannel = `cancel:${chatId}`;
    await redisSub.subscribe(cancelChannel);

    const cancelHandler = (channel) => {
        if (channel === cancelChannel) {
            console.log(`Cancel signal received for job ${job.id}`);
            controller.abort();
        }
    };
    redisSub.on("message", cancelHandler);

        const run = await prisma.ingestionRun.create({
            data: { chatId, chatSourceId, status: "STARTED" },
        });

        try {
            if (!isVectorLess) {
                await processVector(docsUrl, chatId, collectionName, chatSourceId, controller.signal);
            } else {
                await processVectorLess(docsUrl, chatId, chatSourceId, controller.signal);
            }

            await prisma.ingestionRun.update({
                where: { id: run.id },
                data: { status: "SUCCESS", finishedAt: new Date(), errorCode: null, errorMessage: null },
            });
        } catch (err) {
            const cancelled = err.code === "INGESTION_CANCELLED" || controller.signal.aborted;

            // IngestionRunStatus has no CANCELLED value — always use FAILED
            await prisma.ingestionRun.update({
                where: { id: run.id },
                data: {
                    status: "FAILED",
                    finishedAt: new Date(),
                    errorCode: getErrorCode(err),
                    errorMessage: sanitizeErrorMessage(err.message),
                },
            });

            if (cancelled) {
                await prisma.chat.update({
                    where: { id: chatId },
                    data: { status: "CANCELLED" },
                });

                await redis.setex(chatId, 3600, JSON.stringify({ status: "CANCELLED" }));
            }

            throw err;
        } finally {
            // Always clean up: unsubscribe and remove the message listener
            redisSub.off("message", cancelHandler);
            await redisSub.unsubscribe(cancelChannel);
        }
    },
    {
        connection: redis,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 500 },
    },
);

worker.on("completed", async (job) => {
    console.log(`Job ${job.id} completed!`);
    if (!job.data.isVectorLess) {
        await redis.setex(job.data.collectionName, 3600, JSON.stringify({ status: "READY", progress: 100 }));
    }

    await prisma.chat.update({
        where: { id: job.data.chatId },
        data: { status: "READY" },
    }).catch((err) => {
        console.error("Update status Failed:", err.message);
    });
});

worker.on("failed", (job, err) => {
    console.log(err);
    console.error(`Job ${job?.id} failed: ${err.message}`);
});
