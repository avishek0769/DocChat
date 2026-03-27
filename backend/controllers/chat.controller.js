import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { scrapeWebpage } from "../utils/rag.js";

const expectation = asyncHandler(async (req, res) => {
    const { docsUrl } = req.query;

    const { internalLinks } = await scrapeWebpage(docsUrl, docsUrl);
    let allLinks = [docsUrl, ...Array.from(internalLinks)];

    if (allLinks.length > 300) {
        allLinks = allLinks.slice(0, 300);
    }

    let i = 0;
    let totalBodyLengthOfTen = 0;

    for (const link of allLinks) {
        if (i > 10) break;

        const { body } = await scrapeWebpage(link, docsUrl);
        totalBodyLengthOfTen += body.length;
        i++;
    }

    let expectedTokens = Math.ceil(
        ((totalBodyLengthOfTen / 10) * allLinks.length) / 3.8,
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
});

export { expectation };
