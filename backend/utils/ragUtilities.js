import * as cheerio from "cheerio";
import OpenAI from "openai";
import dns from "node:dns/promises";

const lexicalPointCache = new Map();
let openai;

const DEFAULT_HYBRID_CONFIG = {
    denseLimit: 10,
    lexicalLimit: 10,
    finalLimit: 5,
    rrfK: 60,
    lexicalCacheTtlMs: 600000,
    lexicalMaxPoints: 5000,
    scrollBatchSize: 256,
};

function getOpenAIClient() {
    if (!process.env.OPENROUTER_EMBEDDING_API_KEY) {
        throw new Error("OPENROUTER_EMBEDDING_API_KEY is required to generate vector embeddings.");
    }

    if (!openai) {
        openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_EMBEDDING_API_KEY,
        });
    }

    return openai;
}

function readPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHybridRetrievalConfig(overrides = {}) {
    const config = {
        denseLimit: readPositiveInt(process.env.HYBRID_DENSE_LIMIT, DEFAULT_HYBRID_CONFIG.denseLimit),
        lexicalLimit: readPositiveInt(process.env.HYBRID_LEXICAL_LIMIT, DEFAULT_HYBRID_CONFIG.lexicalLimit),
        finalLimit: readPositiveInt(process.env.HYBRID_FINAL_LIMIT, DEFAULT_HYBRID_CONFIG.finalLimit),
        rrfK: readPositiveInt(process.env.HYBRID_RRF_K, DEFAULT_HYBRID_CONFIG.rrfK),
        lexicalCacheTtlMs: readPositiveInt(
            process.env.HYBRID_LEXICAL_CACHE_TTL_MS,
            DEFAULT_HYBRID_CONFIG.lexicalCacheTtlMs,
        ),
        lexicalMaxPoints: readPositiveInt(
            process.env.HYBRID_LEXICAL_MAX_POINTS,
            DEFAULT_HYBRID_CONFIG.lexicalMaxPoints,
        ),
        scrollBatchSize: readPositiveInt(
            process.env.HYBRID_SCROLL_BATCH_SIZE,
            DEFAULT_HYBRID_CONFIG.scrollBatchSize,
        ),
    };

    return { ...config, ...overrides };
}

async function generateVectorEmbeddings(text) {
    const response = await getOpenAIClient().embeddings.create({
        model: "openai/text-embedding-3-small",
        input: text,
        encoding_format: "float",
        dimensions: 1536,
    });

    return response.data[0].embedding;
}

function pointId(point) {
    return String(point?.id ?? "");
}

function normalizeSearchText(value = "") {
    return String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase();
}

function tokenizeSearchText(value = "") {
    const text = normalizeSearchText(value);
    const tokens = new Set();
    const matches = text.match(/[a-z0-9]+(?:[._:/#-][a-z0-9]+)*/g) || [];

    for (const match of matches) {
        tokens.add(match);
        for (const part of match.split(/[._:/#-]+/)) {
            if (part) tokens.add(part);
        }
    }

    return Array.from(tokens);
}

function countTokenMatches(tokens, queryTokens) {
    const counts = new Map();

    for (const token of tokens) {
        counts.set(token, (counts.get(token) || 0) + 1);
    }

    return queryTokens.reduce((total, token) => total + (counts.get(token) || 0), 0);
}

function lexicalScorePoint(point, queryTokens, normalizedQuery) {
    const payload = point?.payload || {};
    const title = payload.title || "";
    const url = payload.url || "";
    const body = payload.body || "";
    let score = 0;

    score += countTokenMatches(tokenizeSearchText(title), queryTokens) * 3;
    score += countTokenMatches(tokenizeSearchText(url), queryTokens) * 2;
    score += countTokenMatches(tokenizeSearchText(body), queryTokens);

    if (normalizedQuery.length >= 3) {
        const normalizedTitle = normalizeSearchText(title);
        const normalizedUrl = normalizeSearchText(url);
        const normalizedBody = normalizeSearchText(body);

        if (normalizedTitle.includes(normalizedQuery)) score += 6;
        if (normalizedUrl.includes(normalizedQuery)) score += 4;
        if (normalizedBody.includes(normalizedQuery)) score += 3;
    }

    return score;
}

function rankLexicalCandidates(queryText, points = [], limit = DEFAULT_HYBRID_CONFIG.lexicalLimit) {
    const queryTokens = tokenizeSearchText(queryText);
    const normalizedQuery = normalizeSearchText(queryText).trim();

    if (!queryTokens.length) return [];

    return points
        .map((point) => ({
            ...point,
            score: lexicalScorePoint(point, queryTokens, normalizedQuery),
        }))
        .filter((point) => point.score > 0)
        .sort((a, b) => b.score - a.score || pointId(a).localeCompare(pointId(b)))
        .slice(0, limit);
}

function normalizeQdrantPoints(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.points)) return response.points;
    return [];
}

async function scrollCollectionPayloads(qdrantClient, collectionName, config) {
    const cacheKey = `${collectionName}:${config.lexicalMaxPoints}:${config.scrollBatchSize}`;
    const cached = lexicalPointCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.points;
    }

    const points = [];
    let offset;

    while (points.length < config.lexicalMaxPoints) {
        const remaining = config.lexicalMaxPoints - points.length;
        const response = await qdrantClient.scroll(collectionName, {
            limit: Math.min(config.scrollBatchSize, remaining),
            offset,
            with_payload: true,
            with_vector: false,
        });
        const batch = normalizeQdrantPoints(response);

        points.push(...batch);

        if (response?.next_page_offset == null || batch.length === 0) break;
        offset = response.next_page_offset;
    }

    lexicalPointCache.set(cacheKey, {
        points,
        expiresAt: Date.now() + config.lexicalCacheTtlMs,
    });

    return points;
}

async function retrieveDenseCandidates(qdrantClient, collectionName, userPrompt, config, queryVector) {
    const vector = queryVector || await generateVectorEmbeddings(userPrompt);

    return normalizeQdrantPoints(await qdrantClient.query(collectionName, {
        query: vector,
        limit: config.denseLimit,
        with_payload: true,
        score_threshold: 0.35,
    }));
}

async function retrieveLexicalCandidates(qdrantClient, collectionName, userPrompt, config) {
    const points = await scrollCollectionPayloads(qdrantClient, collectionName, config);
    return rankLexicalCandidates(userPrompt, points, config.lexicalLimit);
}

function mergeRankedSources(
    densePoints = [],
    lexicalPoints = [],
    config = getHybridRetrievalConfig(),
) {
    const merged = new Map();

    const addRankedPoints = (points, sourceName) => {
        points.forEach((point, index) => {
            const id = pointId(point);
            if (!id) return;

            const current = merged.get(id) || {
                ...point,
                score: 0,
                denseRank: Number.POSITIVE_INFINITY,
                lexicalRank: Number.POSITIVE_INFINITY,
                rrfScore: 0,
            };

            current.payload = current.payload || point.payload;
            current.rrfScore += 1 / (config.rrfK + index + 1);
            if (sourceName === "dense") current.denseRank = Math.min(current.denseRank, index);
            if (sourceName === "lexical") current.lexicalRank = Math.min(current.lexicalRank, index);
            merged.set(id, current);
        });
    };

    addRankedPoints(densePoints, "dense");
    addRankedPoints(lexicalPoints, "lexical");

    const ranked = Array.from(merged.values()).sort((a, b) =>
        b.rrfScore - a.rrfScore ||
        a.denseRank - b.denseRank ||
        a.lexicalRank - b.lexicalRank ||
        pointId(a).localeCompare(pointId(b)),
    );
    const topScore = ranked[0]?.rrfScore || 1;

    return ranked.slice(0, config.finalLimit).map((point) => ({
        id: point.id,
        payload: point.payload,
        score: point.rrfScore / topScore,
    }));
}

async function retrieveHybridSources(qdrantClient, collectionName, userPrompt, options = {}) {
    const config = getHybridRetrievalConfig(options.config);
    let densePoints = [];
    let lexicalPoints = [];

    try {
        densePoints = await retrieveDenseCandidates(
            qdrantClient,
            collectionName,
            userPrompt,
            config,
            options.queryVector,
        );
    } catch (error) {
        console.error("Dense retrieval failed, falling back to lexical candidates:", error.message);
    }

    try {
        lexicalPoints = await retrieveLexicalCandidates(qdrantClient, collectionName, userPrompt, config);
    } catch (error) {
        console.error("Lexical retrieval failed, falling back to dense candidates:", error.message);
    }

    return {
        points: mergeRankedSources(densePoints, lexicalPoints, config),
    };
}

function resetHybridRetrievalCache() {
    lexicalPointCache.clear();
}

// ---------------------------------------------------------------------------
// SSRF Protection — blocks requests to private networks, cloud metadata
// endpoints, and non-HTTP protocols to prevent Server-Side Request Forgery.
// ---------------------------------------------------------------------------

/**
 * Checks whether an IP address belongs to a private or reserved range.
 * Covers: loopback, link-local, RFC 1918, carrier-grade NAT (100.64/10),
 * IPv4-mapped IPv6, and cloud metadata IPs.
 */
function isPrivateIP(ip) {
    // Known cloud metadata IPs that must always be blocked
    const METADATA_IPS = [
        "169.254.169.254", // AWS / GCP / Azure
        "metadata.google.internal",
        "100.100.100.200", // Alibaba Cloud
    ];
    if (METADATA_IPS.includes(ip)) return true;

    // IPv4 private/reserved ranges
    const parts = ip.split(".").map(Number);
    if (parts.length === 4 && parts.every((p) => p >= 0 && p <= 255)) {
        if (parts[0] === 127) return true;                              // 127.0.0.0/8  loopback
        if (parts[0] === 10) return true;                               // 10.0.0.0/8   private
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return true;          // 192.168.0.0/16
        if (parts[0] === 169 && parts[1] === 254) return true;          // 169.254.0.0/16 link-local
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10 CGNAT
        if (parts[0] === 0) return true;                                // 0.0.0.0/8
    }

    // IPv6 loopback and link-local
    if (ip === "::1" || ip === "::") return true;
    if (ip.toLowerCase().startsWith("fe80:")) return true;
    if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true; // ULA

    return false;
}

/**
 * Validates that a URL is safe for server-side fetching:
 *   1. Only http:// and https:// protocols allowed
 *   2. Hostname must not resolve to a private/reserved IP (prevents DNS-rebinding)
 *   3. Known cloud metadata hostnames are blocked
 *
 * @param {string} urlString — The URL to validate
 * @throws {Error} if the URL is unsafe
 */
async function validatePublicUrl(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error("SSRF Protection: Invalid URL.");
    }

    // 1. Protocol check
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("SSRF Protection: Only http and https protocols are allowed.");
    }

    // 2. Block known metadata hostnames
    const blockedHostnames = [
        "metadata.google.internal",
        "metadata.internal",
        "kubernetes.default.svc",
    ];
    if (blockedHostnames.includes(parsed.hostname.toLowerCase())) {
        throw new Error("SSRF Protection: Access to internal metadata services is blocked.");
    }

    // 3. Resolve hostname and check all resulting IPs
    try {
        const { address } = await dns.lookup(parsed.hostname);
        if (isPrivateIP(address)) {
            throw new Error(
                "SSRF Protection: The URL resolves to a private/reserved IP address.",
            );
        }
    } catch (err) {
        // Re-throw our own SSRF errors
        if (err.message.startsWith("SSRF Protection:")) throw err;
        throw new Error(`SSRF Protection: Could not resolve hostname "${parsed.hostname}".`);
    }
}

async function scrapeTitle(url) {
    await validatePublicUrl(url);
    const data = await (await fetch(url)).text();
    const $ = cheerio.load(data);
    return $("title").text();
}

async function scrapeWebpage(url = "", rootUrl = "") {
    await validatePublicUrl(url);
    const data = await (await fetch(url)).text();
    const $ = cheerio.load(data);

    const rootHostname = new URL(rootUrl).hostname;

    const internalLinks = extractHrefsFromScripts($, rootUrl, rootHostname);

    const title = $("title").text().split(/\s+/).slice(0, 4).join(" ");
    $("script, style, noscript").remove();
    const bodyElem = cleanText($("article, body").text());

    $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        try {
            const resolved = new URL(href, url);

            if (resolved.hostname === rootHostname && resolved.protocol.startsWith("http")) {
                const normalized = normalizeUrl(resolved.toString());
                if (isValidDocUrl(normalized, rootUrl)) {
                    internalLinks.add(normalized);
                }
            }
        } catch (e) {
            // Ignore invalid URLs or mailto/tel/javascript schemes
        }
    });

    return {
        body: bodyElem,
        title,
        internalLinks: Array.from(internalLinks),
    };
}

function cleanText(text) {
    return text
        .replace(/\r\n/g, "\n") // normalize line endings
        .replace(/\n{3,}/g, "\n") // collapse 3+ newlines into 1
        .replace(/^\s+$/gm, "") // remove lines that are only whitespace
        .replace(/[ \t]{2,}/g, " ") // collapse multiple spaces
        .trim();
}

function normalizeUrl(url) {
    const u = new URL(url);

    u.hash = "";
    u.search = "";

    if (u.pathname.endsWith("/index.html")) {
        u.pathname = u.pathname.replace("/index.html", "");
    }
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
}

function isValidDocUrl(url, rootUrl = "") {
    const u = new URL(url);
    const root = new URL(rootUrl);

    if (u.origin !== root.origin) return false;

    if (u.pathname.match(/\.(png|ico|xml|jpg|jpeg|gif|svg|pdf|css|js)$/)) return false;

    return true;
}

function extractHrefsFromScripts($, rootUrl, rootHostname) {
    const scriptsText = $("script")
        .map((_, el) => $(el).html())
        .get()
        .join("\n");
    const hrefs = new Set();
    const regex = /\\"href\\"\s*:\s*\\"([^\\"]+)\\"/g;

    let match;
    while ((match = regex.exec(scriptsText)) !== null) {
        try {
            const path = match[1];
            const resolved = new URL(path, rootUrl);

            if (resolved.hostname === rootHostname) {
                const normalized = normalizeUrl(resolved.toString());
                if (isValidDocUrl(normalized, rootUrl)) {
                    hrefs.add(normalized);
                }
            }
        } catch (e) {
            continue;
        }
    }
    return hrefs;
}

export {
    normalizeUrl,
    isValidDocUrl,
    scrapeWebpage,
    scrapeTitle,
    generateVectorEmbeddings,
    getHybridRetrievalConfig,
    tokenizeSearchText,
    rankLexicalCandidates,
    mergeRankedSources,
    retrieveHybridSources,
    resetHybridRetrievalCache,
};
