import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { scrapeTitle, scrapeWebpage } from "../utils/rag.js";
import { Queue } from 'bullmq';

const chatCreationQueue = new Queue("chatCreation")

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

const createChat = asyncHandler(async (req, res) => {
    const { name, model, docsUrl } = req.body

    const docsAlreadyIngested = await prisma.chat.findFirst({
        where: {
            documentationLinks: {
                some: {
                    documentationUrl: docsUrl
                }
            }
        }
    })

    if (docsAlreadyIngested) {
        // TODO: Coming soon
    }
    else {
        const title = await scrapeTitle(docsUrl);
        const chat = await prisma.chat.create({
            data: {
                name,
                model,
                chatSources: {
                    create: {
                        heading: title,
                        documentationUrl: docsUrl,
                        pagesIndexed: 0
                    }
                },
                status: "QUEUED",
                userId: req.user.id
            }
        })

        chatCreationQueue.add(`${chat.id}-job`, {
            chatId: chat.id,
            docsUrl
        })

        
    }
})

export { expectation, createChat };
