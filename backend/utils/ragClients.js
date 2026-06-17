import { TreeIndex } from "treeindex";
import { QdrantClient } from "@qdrant/js-client-rest";
import { trackApiError, resetApiErrors } from "./apiErrorTracker.js";

function createWrappedQdrant() {
    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    return new Proxy(client, {
        get(target, prop) {
            const original = target[prop];
            if (typeof original !== "function") return original;
            return async function (...args) {
                try {
                    const result = await original.apply(target, args);
                    resetApiErrors("qdrant");
                    return result;
                } catch (error) {
                    trackApiError("qdrant", error);
                    throw error;
                }
            };
        },
    });
}

function createWrappedTreeIndex() {
    const client = new TreeIndex({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.TREEINDEX_API_KEY,
        model: process.env.MODEL,
    });

    return new Proxy(client, {
        get(target, prop) {
            const original = target[prop];
            if (typeof original !== "function") return original;
            return async function (...args) {
                try {
                    const result = await original.apply(target, args);
                    resetApiErrors("treeindex");
                    return result;
                } catch (error) {
                    trackApiError("treeindex", error);
                    throw error;
                }
            };
        },
    });
}

const qdrant = createWrappedQdrant();
const treeindex = createWrappedTreeIndex();

export { qdrant, treeindex };
