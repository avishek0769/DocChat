import { jest, expect, test, beforeEach, describe } from '@jest/globals';

const createMock = jest.fn();

jest.unstable_mockModule("openai", () => ({
    default: class OpenAI {
        constructor() {
            this.embeddings = {
                create: createMock,
            };
        }
    },
}));

const { generateVectorEmbeddings } = await import("../utils/ragUtilities.js");

describe("generateVectorEmbeddings bulk processing", () => {
    beforeEach(() => {
        createMock.mockReset();
        // Set fake env var to pass the check
        process.env.OPENROUTER_EMBEDDING_API_KEY = "test-key";
    });

    test("should process a single string input correctly without batching", async () => {
        createMock.mockResolvedValue({
            data: [
                { embedding: [0.1, 0.2, 0.3] }
            ]
        });

        const input = "This is a single chunk of text.";
        const result = await generateVectorEmbeddings(input);

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
            input: "This is a single chunk of text."
        }));
        expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    test("should process an array of strings in a single batched API call", async () => {
        createMock.mockResolvedValue({
            data: [
                { embedding: [0.1, 0.1, 0.1] },
                { embedding: [0.2, 0.2, 0.2] },
                { embedding: [0.3, 0.3, 0.3] }
            ]
        });

        const input = ["chunk 1", "chunk 2", "chunk 3"];
        const result = await generateVectorEmbeddings(input);

        // It should only make ONE network request to OpenAI
        expect(createMock).toHaveBeenCalledTimes(1);
        
        // The input should be passed exactly as an array for OpenAI to parallelize
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
            input: ["chunk 1", "chunk 2", "chunk 3"]
        }));

        // It should map the response data back to a flat array of embeddings
        expect(result).toEqual([
            [0.1, 0.1, 0.1],
            [0.2, 0.2, 0.2],
            [0.3, 0.3, 0.3]
        ]);
        expect(result.length).toBe(3);
    });
});
