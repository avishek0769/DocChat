import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { LLM_MODELS, PROVIDERS_BASE_URLS } from "../utils/constants.js";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { decryptApiKey } from "../utils/decrypt.js";
import { generateVectorEmbeddings } from "../utils/rag.js";

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
});

const getAvailableModels = asyncHandler(async (req, res) => {
    const apikeys = await prisma.apiKey.findMany({
        where: { userId: req.user.id }
    })
    if (!apikeys.length) {
        return res.status(200).json(new ApiResponse(
            200,
            { models: [] },
            "No API keys found. Please create an API key to access the models."
        ));
    }

    let models = []
    apikeys.map(key => {
        models.push(...LLM_MODELS[key.provider])
    })

    return res.status(200).json(new ApiResponse(
        200,
        { models },
        "Available models retrieved successfully."
    ));
})

const sendMessage = asyncHandler(async (req, res) => {
    const { userPrompt, model, provider, chatId } = req.body;
    const apiKey = await prisma.apiKey.findFirst({
        where: {
            userId: req.user.id,
            provider
        }
    })
    const chat = await prisma.chat.findUnique({
        where: { id: chatId }
    })

    if (!chat) {
        throw new ApiError(404, "Chat not found.");
    }
    if (!apiKey) {
        throw new ApiError(400, "Invalid API key ID.");
    }
    if (apiKey.userId !== req.user.id) {
        throw new ApiError(403, "You do not have access to this API key.");
    }
    if (!LLM_MODELS[apiKey.provider]?.includes(model)) {
        throw new ApiError(400, "Invalid model for the selected API key.");
    }

    const userPromptEmbeddings = await generateVectorEmbeddings(userPrompt);
    const relevantSources = await qdrant.query(chat.collectionName, {
        query: userPromptEmbeddings,
        limit: 3,
        with_payload: true
    });
    let systemPrompt = "You are a helpful assistant for answering questions related to the following sources: \n\n";
    relevantSources.points.forEach((point, index) => {
        systemPrompt += `Source ${index + 1}: \nContent: ${point.payload.body}\n\n`;
    });
    systemPrompt += "Answer the user's question based on the above sources. If you don't know the answer, say you don't know. Be concise and to the point. Use Markdown for formatting. Wrap all code snippets (if any) in triple backticks with the language identifier (e.g., ```javascript).";
    // console.log(systemPrompt);

    const openai = new OpenAI({
        baseURL: PROVIDERS_BASE_URLS[apiKey.provider],
        apiKey: decryptApiKey(apiKey.encryptedKey, apiKey.iv, apiKey.tag)
    })

    const stream = await openai.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: 2000
    })

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let llmResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";

            if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens;
                outputTokens = chunk.usage.completion_tokens;
            }
            if (content) {
                llmResponse += content;
                res.write(content);
            }
        }
    }
    catch (error) {
        res.end("Stream ended with error.", error.message);
    }
    finally {
        res.end()
    }

    if (llmResponse.trim()) {
        const chatMessage = await prisma.chatMessage.create({
            data: {
                chatId,
                llmModel: model,
                llmResponse,
                userPrompt,
            }
        })

        await prisma.chatMessageSource.createMany({
            data: relevantSources.points.map(point => ({
                chunkText: point.payload.body,
                heading: point.payload.title,
                pageUrl: point.payload.url,
                chatMessageId: chatMessage.id
            }))
        })

        await prisma.usageEvents.create({
            data: {
                userId: req.user.id,
                messageId: chatMessage.id,
                apikeyId: apiKey.id,
                inputTokens,
                outputTokens,
            }
        })
    }
})

// NOTE: No relation between ChatMessage and Chat in the current schema
const getChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId }
    })

    if (!chat || chat.userId !== req.user.id) {
        throw new ApiError(404, "Chat not found.");
    }

    const messages = await prisma.chatMessage.findMany({
        where: { chatId }
    })

    if (!messages.length) {
        return res.status(200).json(new ApiResponse(
            200,
            { messages: [] },
            "No messages found for this chat."
        ));
    }

    return res.status(200).json(new ApiResponse(
        200,
        { messages: messages },
        "Chat messages retrieved successfully."
    ));
})

const getChatMessageSources = asyncHandler(async (req, res) => {
    const { messageId } = req.params;

    const messageSources = await prisma.chatMessageSource.findMany({
        where: { chatMessageId: messageId }
    })

    if (!messageSources.length) {
        throw new ApiError(404, "No sources found for this message.");
    }

    return res.status(200).json(new ApiResponse(
        200,
        { messageSources },
        "Chat message sources retrieved successfully."
    ));
})

export { sendMessage, getAvailableModels, getChatMessages, getChatMessageSources }