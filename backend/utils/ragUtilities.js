import * as cheerio from "cheerio";
import OpenAI from "openai";
import dns from "node:dns/promises";
import Bottleneck from "bottleneck";
import robotsParser from "robots-parser";

const robotsCache = new Map();
const domainLimiters = new Map();

let openai;

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

function readNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readBoolean(value, fallback) {
    if (value === undefined) return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getCrawlConfig() {
    return {
        userAgent: process.env.CRAWL_USER_AGENT || "DocChatBot/1.0",
        respectRobotsTxt: readBoolean(process.env.CRAWL_RESPECT_ROBOTS_TXT, true),
        defaultDelayMs: readNonNegativeInt(process.env.CRAWL_DELAY_MS, 1000),
        maxConcurrencyPerDomain: readPositiveInt(process.env.CRAWL_MAX_CONCURRENCY_PER_DOMAIN, 2),
        robotsTimeoutMs: readPositiveInt(process.env.CRAWL_ROBOTS_TIMEOUT_MS, 5000),
        robotsCacheTtlMs: readPositiveInt(process.env.CRAWL_ROBOTS_CACHE_TTL_MS, 10 * 60 * 1000),
        allowOnRobotsError: readBoolean(process.env.CRAWL_ALLOW_ON_ROBOTS_ERROR, false),
    };
}

async function generateVectorEmbeddings(input) {
    const response = await getOpenAIClient().embeddings.create({
        model: "openai/text-embedding-3-small",
        input: input,
        encoding_format: "float",
        dimensions: 1536,
    });

    if (Array.isArray(input)) {
        return response.data.map((d) => d.embedding);
    }
    return response.data[0].embedding;
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

function parseRobotsTxt(contents = "", robotsUrl = "https://example.com/robots.txt") {
    return robotsParser(robotsUrl, contents);
}

function getRobotsCrawlDelayMs(parser, userAgent) {
    const crawlDelaySeconds = parser.getCrawlDelay(userAgent);
    return Number.isFinite(crawlDelaySeconds) && crawlDelaySeconds >= 0
        ? Math.round(crawlDelaySeconds * 1000)
        : null;
}

function isUrlAllowedByRobots(urlString, parser, userAgent = getCrawlConfig().userAgent) {
    return parser.isAllowed(urlString, userAgent) !== false;
}

async function fetchTextWithTimeout(url, config) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.robotsTimeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": config.userAgent,
            },
        });

        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchRobotsPolicy(origin, config) {
    if (!config.respectRobotsTxt) {
        return {
            parser: parseRobotsTxt("", new URL("/robots.txt", origin).toString()),
            crawlDelayMs: null,
            failureReason: null,
        };
    }

    const robotsUrl = new URL("/robots.txt", origin).toString();

    try {
        await validatePublicUrl(robotsUrl);
        const response = await fetchTextWithTimeout(robotsUrl, config);

        if (response.status === 404) {
            return { parser: parseRobotsTxt("", robotsUrl), crawlDelayMs: null, failureReason: null };
        }

        if (!response.ok) {
            const failureReason = `robots.txt returned HTTP ${response.status}`;
            if (!config.allowOnRobotsError) {
                return { parser: parseRobotsTxt("", robotsUrl), crawlDelayMs: null, failureReason };
            }
            return { parser: parseRobotsTxt("", robotsUrl), crawlDelayMs: null, failureReason: null };
        }

        const parser = parseRobotsTxt(await response.text(), robotsUrl);
        return {
            parser,
            crawlDelayMs: getRobotsCrawlDelayMs(parser, config.userAgent),
            failureReason: null,
        };
    } catch (error) {
        if (config.allowOnRobotsError) {
            return { parser: parseRobotsTxt("", robotsUrl), crawlDelayMs: null, failureReason: null };
        }
        return {
            parser: parseRobotsTxt("", robotsUrl),
            crawlDelayMs: null,
            failureReason: `robots.txt check failed: ${error.message}`,
        };
    }
}

async function getRobotsPolicy(urlString, config) {
    const origin = new URL(urlString).origin;
    const cacheKey = `${origin}|${config.userAgent}`;
    const cached = robotsCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.promise;
    }

    const promise = fetchRobotsPolicy(origin, config);
    robotsCache.set(cacheKey, {
        expiresAt: Date.now() + config.robotsCacheTtlMs,
        promise,
    });

    return promise;
}

function getDomainLimiter(urlString, config, crawlDelayMs) {
    const hostname = new URL(urlString).hostname.toLowerCase();
    if (!domainLimiters.has(hostname)) {
        domainLimiters.set(hostname, new Bottleneck({
            maxConcurrent: config.maxConcurrencyPerDomain,
            minTime: crawlDelayMs,
        }));
    } else {
        domainLimiters.get(hostname).updateSettings({
            maxConcurrent: config.maxConcurrencyPerDomain,
            minTime: crawlDelayMs,
        });
    }
    return domainLimiters.get(hostname);
}

async function scheduleCrawl(urlString, task) {
    await validatePublicUrl(urlString);

    const config = getCrawlConfig();
    const robotsPolicy = await getRobotsPolicy(urlString, config);

    if (robotsPolicy.failureReason) {
        const error = new Error(`Crawl blocked: ${robotsPolicy.failureReason}`);
        error.code = "ROBOTS_CHECK_FAILED";
        throw error;
    }

    if (!isUrlAllowedByRobots(urlString, robotsPolicy.parser, config.userAgent)) {
        const error = new Error(`Crawl blocked by robots.txt: ${urlString}`);
        error.code = "ROBOTS_DISALLOWED";
        throw error;
    }

    const crawlDelayMs = robotsPolicy.crawlDelayMs ?? config.defaultDelayMs;
    return getDomainLimiter(urlString, config, crawlDelayMs).schedule(task);
}

async function fetchCrawlText(urlString) {
    return scheduleCrawl(urlString, async () => {
        const config = getCrawlConfig();
        const response = await fetch(urlString, {
            headers: {
                "User-Agent": config.userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${urlString}: HTTP ${response.status}`);
        }

        return response.text();
    });
}

async function scrapeTitle(url) {
    const data = await fetchCrawlText(url);
    const $ = cheerio.load(data);
    return $("title").text();
}

async function scrapeWebpage(url = "", rootUrl = "") {
    const data = await fetchCrawlText(url);
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

function resetCrawlStateForTests() {
    robotsCache.clear();
    domainLimiters.clear();
}

export {
    normalizeUrl,
    isValidDocUrl,
    scrapeWebpage,
    scrapeTitle,
    generateVectorEmbeddings,
    getCrawlConfig,
    parseRobotsTxt,
    isUrlAllowedByRobots,
    scheduleCrawl,
    resetCrawlStateForTests,
};
