import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { scrapeWebpage } from "../utils/rag.js";

const expectation = asyncHandler(async (req, res) => {
    const { docsUrl } = req.query;
    
    try {
        const { internalLinks } = await scrapeWebpage(docsUrl, docsUrl);
        let allLinks = [docsUrl, ...Array.from(internalLinks)].slice(0, 300);
        const sampleLinks = allLinks.slice(0, 10);

        let count = 0;
        let totalBodyLengthOfCount = 0;

        for (const link of sampleLinks) {
            const { body } = await scrapeWebpage(link, docsUrl);
            if (body) {
                totalBodyLengthOfCount += body.length;
                count++;
            }
        }

        if (count === 0) {
            throw new Error("Failed to scrape sample pages");
        }
    
        let expectedTokens = Math.ceil(
            ((totalBodyLengthOfCount / count) * allLinks.length) / 3.8,
        );
    
        res.status(200).json(
            new ApiResponse(
                200,
                {
                    expectedTokens,
                    pages: internalLinks.size + 1,
                    pageLimitWarning: internalLinks.size > 300,
                },
                "Expectation calculated successfully",
            ),
        );
    }
    catch (error) {
        throw new ApiError(500, error.message, error);
    }
});



export { expectation };
