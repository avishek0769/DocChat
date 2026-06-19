import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../utils/ragUtilities.js";

describe("normalizeUrl", () => {
    it("should remove trailing slash", () => {
        expect(normalizeUrl("https://example.com/docs/")).toBe("https://example.com/docs");
        expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    });

    it("should remove hash/fragment", () => {
        expect(normalizeUrl("https://example.com/docs#section")).toBe("https://example.com/docs");
        expect(normalizeUrl("https://example.com/docs/#section")).toBe("https://example.com/docs");
    });

    it("should remove known tracking query parameters", () => {
        expect(normalizeUrl("https://example.com/docs?utm_source=ad")).toBe("https://example.com/docs");
        expect(normalizeUrl("https://example.com/docs?fbclid=123&gclid=456")).toBe("https://example.com/docs");
        expect(normalizeUrl("https://example.com/docs?utm_source=google&page=1&utm_campaign=winter")).toBe("https://example.com/docs?page=1");
    });

    it("should keep and sort meaningful query parameters", () => {
        expect(normalizeUrl("https://example.com/docs?v=2&lang=en")).toBe("https://example.com/docs?lang=en&v=2");
        expect(normalizeUrl("https://example.com/docs?version=1.0&page=intro")).toBe("https://example.com/docs?page=intro&version=1.0");
    });

    it("should strip index.html from path", () => {
        expect(normalizeUrl("https://example.com/docs/index.html")).toBe("https://example.com/docs");
        expect(normalizeUrl("https://example.com/docs/index.html?v=3")).toBe("https://example.com/docs?v=3");
    });
});
