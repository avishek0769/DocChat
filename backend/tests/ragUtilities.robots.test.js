import test from "node:test";
import assert from "node:assert/strict";
import {
    isUrlAllowedByRobots,
    parseRobotsTxt,
    resetCrawlStateForTests,
    scheduleCrawl,
} from "../utils/ragUtilities.js";

function restoreEnv(name, value) {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

test("robots parser blocks disallowed paths and honors more specific allow rules", () => {
    resetCrawlStateForTests();

    const parser = parseRobotsTxt(
        [
            "User-agent: *",
            "Disallow: /docs/private",
            "Allow: /docs/private/public",
        ].join("\n"),
        "https://docs.example.com/robots.txt",
    );

    assert.equal(
        isUrlAllowedByRobots("https://docs.example.com/docs/private/page", parser, "DocChatBot/1.0"),
        false,
    );
    assert.equal(
        isUrlAllowedByRobots("https://docs.example.com/docs/private/public/page", parser, "DocChatBot/1.0"),
        true,
    );
});

test("robots parser exposes crawl-delay for the configured worker user-agent", () => {
    resetCrawlStateForTests();

    const parser = parseRobotsTxt(
        [
            "User-agent: DocChatBot",
            "Crawl-delay: 2.5",
            "Disallow:",
        ].join("\n"),
        "https://docs.example.com/robots.txt",
    );

    assert.equal(parser.getCrawlDelay("DocChatBot/1.0"), 2.5);
});

test("crawl scheduler spaces requests for the same domain", async () => {
    const previousRespectRobots = process.env.CRAWL_RESPECT_ROBOTS_TXT;
    const previousDelay = process.env.CRAWL_DELAY_MS;
    const previousConcurrency = process.env.CRAWL_MAX_CONCURRENCY_PER_DOMAIN;

    process.env.CRAWL_RESPECT_ROBOTS_TXT = "false";
    process.env.CRAWL_DELAY_MS = "30";
    process.env.CRAWL_MAX_CONCURRENCY_PER_DOMAIN = "1";
    resetCrawlStateForTests();

    try {
        const starts = [];
        await Promise.all([
            scheduleCrawl("https://93.184.216.34/a", async () => {
                starts.push(Date.now());
            }),
            scheduleCrawl("https://93.184.216.34/b", async () => {
                starts.push(Date.now());
            }),
        ]);

        assert.equal(starts.length, 2);
        assert.ok(starts[1] - starts[0] >= 25);
    } finally {
        restoreEnv("CRAWL_RESPECT_ROBOTS_TXT", previousRespectRobots);
        restoreEnv("CRAWL_DELAY_MS", previousDelay);
        restoreEnv("CRAWL_MAX_CONCURRENCY_PER_DOMAIN", previousConcurrency);
        resetCrawlStateForTests();
    }
});
