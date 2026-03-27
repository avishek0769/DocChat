import "dotenv/config";
import { Worker } from "bullmq";
import redis from "./utils/redis.js";
import { normalizeUrl, isValidDocUrl, scrapeWebpage } from "./utils/rag.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid"; // Use 'npm install uuid' for valid Qdrant IDs

const client = new QdrantClient({
    host: "localhost",
    port: 6333,
});

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function generateVectorEmbeddings(text) {
    const response = await openai.embeddings.create({
        model: "openai/text-embedding-3-small",
        input: text,
        encoding_format: "float",
        dimensions: 1536,
    });

    return response.data[0].embedding;
}

async function ingestAll(docsRootUrl, chatId, collectionName) {
    const rootUrl = normalizeUrl(docsRootUrl);
    console.log("Scraping root:", rootUrl);

    const { internalLinks } = await scrapeWebpage(rootUrl, rootUrl);
    let allLinks = [rootUrl, ...Array.from(internalLinks)].slice(0, 300);
    const totalLinks = allLinks.length;

    console.log("Total unique links found:", totalLinks);

    const collections = await client.getCollections();
    if (!collections.collections.some(c => c.name === collectionName)) {
        await client.createCollection(collectionName, {
            vectors: { size: 1536, distance: "Cosine" }
        });
    }

    let batchPoints = [];
    let pageCount = 0;

    for (const [index, link] of allLinks.entries()) {
        if (!isValidDocUrl(link, rootUrl)) continue;

        try {
            const { body } = await scrapeWebpage(link, rootUrl);
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 150,
            });
            const chunks = await splitter.splitText(body);

            console.log(`Processing: ${link} (${chunks.length} chunks)`);

            for (const chunk of chunks) {
                const emb = await generateVectorEmbeddings(chunk);
                
                batchPoints.push({
                    id: uuidv4(),
                    vector: emb,
                    payload: { url: link, body: chunk, chatId }
                });
            }

            pageCount++;

            if (pageCount >= 3 || index === totalLinks - 1) {
                if (batchPoints.length > 0) {
                    console.log(`Upserting batch of ${batchPoints.length} points...`);
                    await client.upsert(collectionName, {
                        wait: true,
                        points: batchPoints
                    });
                    
                    batchPoints = [];
                    pageCount = 0;
                }

                await redis.setex(collectionName, 3600, JSON.stringify({
                    status: "PROCESSING",
                    current: index + 1,
                    total: totalLinks,
                    progress: Math.round(((index + 1) / totalLinks) * 100)
                }));
            }
        }
        catch (err) {
            console.error(`Failed link ${link}:`, err.message);
            continue;
        }
    }

    await redis.setex(collectionName, 3600, JSON.stringify({ status: "READY", progress: 100 }));
}


const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl, collectionName } = job.data;
        await ingestAll(docsUrl, chatId, collectionName);
    },
    { 
        connection: redis,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
    },
);

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed!`);
});

worker.on("failed", (job, err) => {
    console.log(err)
    console.error(`Job ${job?.id} failed: ${err.message}`);
});