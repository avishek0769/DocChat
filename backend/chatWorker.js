import "dotenv/config";
import { Worker } from "bullmq";
import redis from "./utils/redis.js";
import { normalizeUrl, isValidDocUrl, scrapeWebpage, generateVectorEmbeddings } from "./utils/rag.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import prisma from "./utils/prismaClient.js";
import { PageIndexClient } from "@pageindex/sdk";
import PDFDocument from "pdfkit";
import fs from "fs/promises";
import fsSync from "fs";

const doc = new PDFDocument();

const pageindex = new PageIndexClient({
    apiKey: process.env.PAGEINDEX_API_KEY,
});

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

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
                    console.log(`Upserting batch of ${batchPoints.length} points...`);
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
            throw new Error("No data scraped. PDF would be empty.");
        }

        const filePath = `./temp/${chatSourceId}.pdf`;
        const writeStream = fsSync.createWriteStream(filePath);

        await new Promise((resolve, reject) => {
            doc.pipe(writeStream);
            doc.text(allData);
            doc.end();

            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
        });

        console.log("Data converted and stream flushed");

        const file = await fs.readFile(`./temp/${chatSourceId}.pdf`);
        const result = await pageindex.api.submitDocument(file, `${chatSourceId}.pdf`);
        console.log("Result:", result);

        let docTree = null;

        let attempts = 0;
        const maxAttempts = 20;
        while (attempts < maxAttempts) {
            docTree = await pageindex.api.getTree(result.doc_id, { nodeSummary: true });
            if (docTree.status === "completed") break;
            if (docTree.status === "failed") throw new Error("Document processing failed");

            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 3500));
        }
        if (attempts >= maxAttempts) throw new Error("Polling timeout");

        await redis.setex(chatId, 3600, JSON.stringify({ status: "READY", progress: 100 }));

        console.log("Tree Status:", docTree.status);

        await prisma.chat.update({
            where: { id: chatId },
            data: {
                collectionName: result.doc_id,
                status: "READY",
                chatSources: {
                    update: {
                        where: { id: chatSourceId },
                        data: { collectionName: result.doc_id },
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
