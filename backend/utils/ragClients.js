import { TreeIndex } from "treeindex";
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

const treeindex = new TreeIndex({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.TREEINDEX_API_KEY,
    model: process.env.MODEL,
});

export { qdrant, treeindex };