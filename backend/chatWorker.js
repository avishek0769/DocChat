import "dotenv/config";
import { Worker } from "bullmq";
import redis from "./utils/redis.js";
import {
    normalizeUrl,
    isValidDocUrl,
    scrapeWebpage,
    generateVectorEmbeddings,
} from "./utils/rag.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import prisma from "./utils/prismaClient.js";

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

async function ingestAll(docsRootUrl, chatId, collectionName, chatSourceId) {
    const rootUrl = normalizeUrl(docsRootUrl);
    console.log("Scraping root:", rootUrl);

    const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
    let allLinks = internalLinks.slice(0, 300); // slice 5 - Just for development, slice 300 for production
    const totalLinks = allLinks.length;

    console.log("Total unique links found:", totalLinks);

    const collections = await client.getCollections();
    if (!collections.collections.some((c) => c.name === collectionName)) {
        await client.createCollection(collectionName, {
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
                    console.log(
                        `Upserting batch of ${batchPoints.length} points...`,
                    );
                    await client.upsert(collectionName, {
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
                            console.error(
                                "Failed to update indexed pages:",
                                err.message,
                            );
                        });

                    batchPoints = [];
                    batchPage = [];
                    pageCount = 0;
                }

                await redis.setex(
                    collectionName,
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
            continue;
        }
    }
}

const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl, collectionName, chatSourceId } = job.data;
        await ingestAll(docsUrl, chatId, collectionName, chatSourceId);
    },
    {
        connection: redis,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 500 },
    },
);

worker.on("completed", async (job) => {
    console.log(`Job ${job.id} completed!`);
    await redis.setex(
        job.data.collectionName,
        3600,
        JSON.stringify({ status: "READY", progress: 100 }),
    );

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
