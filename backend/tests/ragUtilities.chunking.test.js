import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { splitDocumentationContent } from "../utils/ragUtilities.js";

describe("splitDocumentationContent", () => {
    it("returns chunk objects with code blocks kept intact", () => {
        const fixture = readFileSync(
            new URL("./fixtures/code-doc-sample.md", import.meta.url),
            "utf8",
        );

        const chunks = splitDocumentationContent(fixture, {
            chunkSize: 250,
            chunkOverlap: 40,
        });

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every((chunk) => typeof chunk.content === "string")).toBe(true);
        expect(chunks.every((chunk) => Object.hasOwn(chunk, "heading"))).toBe(true);
        expect(chunks.some((chunk) => chunk.chunkType === "code")).toBe(true);
        expect(chunks.some((chunk) => chunk.chunkType === "api")).toBe(true);

        const codeChunk = chunks.find((chunk) => chunk.chunkType === "code");
        expect(codeChunk).toBeDefined();
        expect(codeChunk.content).toContain("```js");
        expect(codeChunk.content).toContain("const token = generateToken();");
        expect(codeChunk.content).toContain("```");
    });

    it("preserves heading context in emitted chunks", () => {
        const chunks = splitDocumentationContent("# Intro\n\nBody text", {
            chunkSize: 100,
            chunkOverlap: 0,
        });

        expect(chunks[0].heading).toBe("# Intro");
        expect(chunks[0].chunkType).toBe("content");
        expect(chunks[0].hasCodeBlock).toBe(false);
        expect(chunks[0].content).toContain("# Intro");
    });
});
