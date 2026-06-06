import test from "node:test";
import assert from "node:assert/strict";
import {
    mergeRankedSources,
    resetHybridRetrievalCache,
    retrieveHybridSources,
} from "../utils/ragUtilities.js";

const payload = (body, title = "Docs", url = "https://docs.example.com/page") => ({
    body,
    title,
    url,
});

const point = (id, body, score = 0.8) => ({
    id,
    score,
    payload: payload(body),
});

const makeQdrant = ({ dense = [], lexical = [], queryError, scrollError } = {}) => ({
    query: async () => {
        if (queryError) throw new Error("dense unavailable");
        return { points: dense };
    },
    scroll: async () => {
        if (scrollError) throw new Error("scroll unavailable");
        return { points: lexical, next_page_offset: null };
    },
});

const quietConsoleError = async (callback) => {
    const original = console.error;
    console.error = () => {};

    try {
        return await callback();
    } finally {
        console.error = original;
    }
};

const config = {
    denseLimit: 10,
    lexicalLimit: 10,
    finalLimit: 5,
    rrfK: 60,
    lexicalCacheTtlMs: 600000,
    lexicalMaxPoints: 50,
    scrollBatchSize: 10,
};

test("hybrid retrieval recovers exact identifiers from lexical candidates when dense misses", async () => {
    resetHybridRetrievalCache();
    const qdrant = makeQdrant({
        dense: [],
        lexical: [
            point("plain", "Configure a normal environment variable."),
            point("exact", "Set OPENROUTER_EMBEDDING_API_KEY before generating embeddings."),
        ],
    });

    const result = await retrieveHybridSources(
        qdrant,
        "docs-collection",
        "OPENROUTER_EMBEDDING_API_KEY",
        { queryVector: [0.1], config },
    );

    assert.equal(result.points.length, 1);
    assert.equal(result.points[0].id, "exact");
    assert.equal(result.points[0].score, 1);
});

test("RRF merge deduplicates overlap and ranks shared dense plus lexical hits first", () => {
    const merged = mergeRankedSources(
        [
            point("shared", "Semantic match for OPENROUTER_EMBEDDING_API_KEY", 0.8),
            point("dense-only", "Semantic-only candidate", 0.7),
        ],
        [
            point("shared", "Set OPENROUTER_EMBEDDING_API_KEY in settings.", 12),
            point("lexical-only", "OPENROUTER_EMBEDDING_API_KEY exact keyword.", 10),
        ],
        config,
    );

    assert.equal(merged[0].id, "shared");
    assert.equal(new Set(merged.map((candidate) => candidate.id)).size, merged.length);
    assert.ok(merged.every((candidate) => candidate.score >= 0 && candidate.score <= 1));
});

test("hybrid retrieval falls back to lexical candidates when dense search fails", async () => {
    resetHybridRetrievalCache();

    await quietConsoleError(async () => {
        const result = await retrieveHybridSources(
            makeQdrant({
                queryError: true,
                lexical: [point("lexical", "Use HYBRID_SCROLL_BATCH_SIZE to tune scrolling.")],
            }),
            "docs-collection",
            "HYBRID_SCROLL_BATCH_SIZE",
            { queryVector: [0.1], config },
        );

        assert.deepEqual(result.points.map((candidate) => candidate.id), ["lexical"]);
    });
});

test("hybrid retrieval falls back to dense candidates when lexical search fails", async () => {
    resetHybridRetrievalCache();

    await quietConsoleError(async () => {
        const result = await retrieveHybridSources(
            makeQdrant({
                dense: [point("dense", "Semantic source", 0.77)],
                scrollError: true,
            }),
            "docs-collection",
            "semantic question",
            { queryVector: [0.1], config },
        );

        assert.deepEqual(result.points.map((candidate) => candidate.id), ["dense"]);
    });
});

test("hybrid retrieval returns no sources when both paths are empty", async () => {
    resetHybridRetrievalCache();
    const result = await retrieveHybridSources(
        makeQdrant({ dense: [], lexical: [] }),
        "docs-collection",
        "missing keyword",
        { queryVector: [0.1], config },
    );

    assert.deepEqual(result.points, []);
});
