import { Worker } from "bullmq";
import redis from "./utils/redis.js";
import { normalizeUrl } from "./utils/rag.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: "http://localhost:6333/v1",
    apiKey: "ollama"
})

async function generateVectorEmbeddings(text) {
    const embeddings = await openai.embeddings.create({
        model: "qwen3-embedding:4b",
        input: text,
        encoding_format: "float",
        dimensions: 1536
    })
    
    return embeddings.data[0].embedding
}

async function ingestAll(docsRootUrl) {
    const rootUrl = normalizeUrl(docsRootUrl);

    console.log("Scraping root:", rootUrl);

    const { internalLinks } = await scrapeWebpage(rootUrl);
    let allLinks = [docsUrl, ...Array.from(internalLinks)].slice(0, 300);

    console.log("Total unique links found:", allLinks.length);

    for (const url of allLinks) {
        if (!isValidDocUrl(url)) continue;

        try {
            const { body } = await scrapeWebpage(url);
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 150,
            });
            const chunks = await splitter.splitText(body);

            console.log(
                `\nLinks: ${allLinks.length} Ingesting: ${body.length} -- ${url}`,
            );

            let index = 0;
            for (const chunk of chunks) {
                const emb = await generateVectorEmbeddings(chunk);
                console.log(
                    "Body embeddings: ",
                    emb.length,
                    chunk.length,
                    chunk.slice(200, 250),
                );

                await insertToDB({
                    url,
                    body: chunk,
                    embeddings: emb,
                    chunkIndex: index++,
                });
            }
        } catch (err) {
            console.log("Failed:", url);
            continue;
        }
    }
}

const worker = new Worker(
    "chatCreation",
    async (job) => {
        const { chatId, docsUrl } = job.data;
    },
    { connection: redis },
);

worker.on("completed", (job) => {
    console.log(`${job.data.docsUrl} has completed!`);
});

worker.on("failed", (job, err) => {
    console.log(`${job.data.docsUrl} has failed with ${err.message}`);
});
