import { describe, it, expect, vi } from "vitest";
import { parseFileBuffer } from "../utils/fileParser.js";

vi.mock("pdf-parse", () => {
    return {
        default: vi.fn().mockImplementation(async (buffer) => {
            if (buffer.toString() === "mock-pdf-error") {
                throw new Error("Invalid PDF format");
            }
            return { text: "Extracted PDF content" };
        }),
    };
});

vi.mock("mammoth", () => {
    return {
        default: {
            extractRawText: vi.fn().mockImplementation(async ({ buffer }) => {
                if (buffer.toString() === "mock-docx-error") {
                    throw new Error("Invalid DOCX format");
                }
                return { value: "Extracted DOCX content" };
            }),
        },
    };
});

describe("fileParser utility", () => {
    it("should parse .txt files successfully", async () => {
        const buffer = Buffer.from("Hello text file", "utf-8");
        const text = await parseFileBuffer(buffer, "test.txt");
        expect(text).toBe("Hello text file");
    });

    it("should parse .md files successfully", async () => {
        const buffer = Buffer.from("# Hello markdown", "utf-8");
        const text = await parseFileBuffer(buffer, "test.md");
        expect(text).toBe("# Hello markdown");
    });

    it("should parse .pdf files using pdfParse mock", async () => {
        const buffer = Buffer.from("dummy-pdf-buffer");
        const text = await parseFileBuffer(buffer, "test.pdf");
        expect(text).toBe("Extracted PDF content");
    });

    it("should throw error if pdfParse fails", async () => {
        const buffer = Buffer.from("mock-pdf-error");
        await expect(parseFileBuffer(buffer, "test.pdf")).rejects.toThrow("Failed to parse PDF file: Invalid PDF format");
    });

    it("should parse .docx files using mammoth mock", async () => {
        const buffer = Buffer.from("dummy-docx-buffer");
        const text = await parseFileBuffer(buffer, "test.docx");
        expect(text).toBe("Extracted DOCX content");
    });

    it("should throw error if mammoth fails", async () => {
        const buffer = Buffer.from("mock-docx-error");
        await expect(parseFileBuffer(buffer, "test.docx")).rejects.toThrow("Failed to parse DOCX file: Invalid DOCX format");
    });

    it("should throw error for unsupported extension", async () => {
        const buffer = Buffer.from("image bytes");
        await expect(parseFileBuffer(buffer, "test.png")).rejects.toThrow("Unsupported file extension: .png");
    });

    it("should throw error if no buffer is provided", async () => {
        await expect(parseFileBuffer(null, "test.txt")).rejects.toThrow("No file buffer provided");
    });

    it("should throw error if no originalname is provided", async () => {
        const buffer = Buffer.from("text");
        await expect(parseFileBuffer(buffer, null)).rejects.toThrow("No file name provided");
    });
});
