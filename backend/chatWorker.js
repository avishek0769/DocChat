import "dotenv/config";
import { Worker } from "bullmq";
import redis from "./utils/redis.js";
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

async function processVector(docsRootUrl, chatId, collectionName, chatSourceId) {
    const rootUrl = normalizeUrl(docsRootUrl);
    console.log("Scraping root:", rootUrl);

    const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
    let allLinks = internalLinks.slice(0, 300); // slice 5 - Just for development, slice 300 for production
    const totalLinks = allLinks.length;

    console.log("Total unique links found:", totalLinks);

    await redis.setex(
        chatId,
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
                    chatId,
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
            await redis.setex(chatId, 3600, JSON.stringify({ status: "FAILED" }));
            continue;
        }
    }
}

async function processVectorLess(docsRootUrl, chatId, chatSourceId) {
    try {
        await redis.setex(chatId, 3600, JSON.stringify({ status: "PROCESSING", progress: 0 }));

        const rootUrl = normalizeUrl(docsRootUrl);
        console.log("Scraping root:", rootUrl);

        const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
        let allLinks = internalLinks.slice(0, 3); // slice 3 - Just for development, slice 300 for production
        const totalLinks = allLinks.length;

        console.log("Total unique links found:", totalLinks);

        let batchLinks = allLinks.slice(0, 5);
        let allData = "";
        let i = 0;

        while (batchLinks.length > 0) {
            batchLinks = allLinks.slice(i, i + 5);
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
            i += 5;
        }

        if (!allData.trim()) {
            throw new Error("No data scraped.");
        }

        treeindex.loadData(allData)
        const tree = await treeindex.generateTree()
        console.log("Generated Tree Length:", tree.length);

        const docTree = await prisma.documentTree.create({
            data: {
                chatSourceId,
                treeData: tree
            },
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
        console.error("Error VectorLess:", error);
        await redis.setex(chatId, 3600, JSON.stringify({ status: "FAILED" }));
    }
}

const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl, collectionName, chatSourceId, isVectorLess } = job.data;
        if (!isVectorLess) {
            await processVector(docsUrl, chatId, collectionName, chatSourceId);
        } else {
            await processVectorLess(docsUrl, chatId, chatSourceId);
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
