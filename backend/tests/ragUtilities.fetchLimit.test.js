import { describe, it, expect } from "vitest";
import { safeFetchText } from "../utils/ragUtilities.js";

function createMockResponse({ contentType, contentLength, bodyChunks = [] }) {
    const chunks = bodyChunks.map((chunk) =>
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk,
    );
    let index = 0;

    return {
        headers: {
            get(name) {
                const key = String(name).toLowerCase();
                if (key === "content-type") return contentType;
                if (key === "content-length") return contentLength;
                return null;
            },
        },
        body: {
            getReader() {
                return {
                    async read() {
                        if (index >= chunks.length) {
                            return { done: true, value: undefined };
                        }
                        return { done: false, value: chunks[index++] };
                    },
                    async cancel() {
                        index = chunks.length;
                    },
                };
            },
        },
    };
}

describe("safeFetchText", () => {
    it("rejects payloads larger than the configured limit", async () => {
        const response = createMockResponse({
            contentType: "text/html; charset=utf-8",
            contentLength: String(5 * 1024 * 1024 + 1),
            bodyChunks: ["<html><body>too big</body></html>"],
        });

        await expect(safeFetchText(response)).rejects.toThrow("Payload too large");
    });

    it("rejects unsupported content types", async () => {
        const response = createMockResponse({
            contentType: "application/octet-stream",
            contentLength: "12",
            bodyChunks: [new Uint8Array([1, 2, 3])],
        });

        await expect(safeFetchText(response)).rejects.toThrow("Unsupported content type");
    });

    it("accepts valid html responses", async () => {
        const response = createMockResponse({
            contentType: "text/html; charset=utf-8",
            contentLength: "31",
            bodyChunks: ["<html><body>Hello</body></html>"],
        });

        await expect(safeFetchText(response)).resolves.toBe("<html><body>Hello</body></html>");
    });
});
