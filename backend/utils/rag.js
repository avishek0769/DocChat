import * as cheerio from "cheerio";

async function scrapeTitle(url) {
    const data = await (await fetch(url)).text();
    const $ = cheerio.load(data);
    return $("title").text();
}

async function scrapeWebpage(url = "", rootUrl = "") {
    const data = await (await fetch(url)).text();
    const $ = cheerio.load(data);

    const hiddenLinks = extractHrefsFromScripts($, rootUrl);

    $("script, style, noscript").remove();

    const bodyElem = cleanText($("article, body").text());
    const internalLinks = new Set(hiddenLinks);

    $("a").each((_, el) => {
        const href = $(el).attr("href");
        const isLinkIgnorable =
            !href ||
            href.startsWith("http") ||
            href.startsWith("#") ||
            href.startsWith(".") ||
            href.includes("..") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            href.startsWith("javascript:");

        if (isLinkIgnorable) {
            return;
        } else {
            try {
                if (href.startsWith("/")) {
                    const resolved = new URL(href, url).toString();
                    const normalized = normalizeUrl(resolved);

                    if (isValidDocUrl(normalized, rootUrl)) {
                        internalLinks.add(normalized);
                    }
                } else {
                    const _url = url + "/" + href;
                    internalLinks.add(_url);
                }
            } catch {
                return;
            }
        }
    });

    return {
        body: bodyElem,
        internalLinks,
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

function extractHrefsFromScripts($, rootUrl = "") {
    const scriptsText = $("script")
        .map((_, el) => {
            return $(el).html();
        })
        .get()
        .join("\n");

    const hrefs = new Set();

    const regex = /\\"href\\"\s*:\s*\\"([^\\"]+)\\"/g;

    let match;
    while ((match = regex.exec(scriptsText)) !== null) {
        let path = match[1];
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        const normalizedUrl = normalizeUrl(rootUrl) + path;
        const isLinkIgnorable =
            path.startsWith("http") ||
            path.startsWith("#") ||
            path.startsWith(".") ||
            path.includes("..") ||
            path.startsWith("mailto:") ||
            path.startsWith("tel:") ||
            path.startsWith("javascript:");

        if (!isLinkIgnorable && isValidDocUrl(normalizedUrl, rootUrl)) {
            hrefs.add(normalizedUrl);
        }
    }

    return hrefs;
}

export { normalizeUrl, isValidDocUrl, scrapeWebpage, scrapeTitle };
