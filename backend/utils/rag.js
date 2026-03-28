import * as cheerio from "cheerio";

async function scrapeTitle(url) {
    const data = await (await fetch(url)).text();
    const $ = cheerio.load(data);
    return $("title").text();
}

async function scrapeWebpage(url = "", rootUrl = "") {
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
            
            if (resolved.hostname === rootHostname && resolved.protocol.startsWith('http')) {
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
        internalLinks: Array.from(internalLinks)
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

    if (u.pathname.match(/\.(png|ico|xml|jpg|jpeg|gif|svg|pdf|css|js)$/))
        return false;

    return true;
}

function extractHrefsFromScripts($, rootUrl, rootHostname) {
    const scriptsText = $("script").map((_, el) => $(el).html()).get().join("\n");
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


export { normalizeUrl, isValidDocUrl, scrapeWebpage, scrapeTitle };
