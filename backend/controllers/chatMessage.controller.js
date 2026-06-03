import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { LLM_MODELS, PROVIDERS_BASE_URLS, MEM0_ENABLED } from "../utils/constants.js";
import OpenAI from "openai";
import { qdrant, treeindex } from "../utils/ragClients.js";
import { decryptApiKey } from "../utils/decrypt.js";
import { generateVectorEmbeddings } from "../utils/ragUtilities.js";
import { MemoryClient } from "mem0ai";

const memory = MEM0_ENABLED ? new MemoryClient({ apiKey: process.env.MEM0_API_KEY }) : null;

const getAvailableModels = asyncHandler(async (req, res) => {
    const apikeys = await prisma.apiKey.findMany({
        where: { userId: req.user.id },
        orderBy:{createdAt:"asc"}
    });
    if (!apikeys.length) {
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { models: [] },
                    "No API keys found. Please create an API key to access the models.",
                ),
            );
    }

    let models = [];
    apikeys.map((key) => {
        models.push(...LLM_MODELS[key.provider]);
    });
    Array.from(new Set(models)).sort()

    return res
        .status(200)
        .json(new ApiResponse(200, { models }, "Available models retrieved successfully."));
});

const sendMessage = asyncHandler(async (req, res) => {
    const { userPrompt, model, provider, chatId } = req.body;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { chatSources: true },
        orderBy:{createdAt:"asc"}
    });
    if (!chat) {
        throw new ApiError(404, "Chat not found.");
    }

    if (chat.status === "QUEUED" || chat.status === "PROCESSING") {
  throw new ApiError(
    409,
    "Chat is still indexing your docs — please try again in a moment."
  );
}

if (chat.status === "FAILED") {
  throw new ApiError(
    409,
    "Chat ingestion failed. Please re-ingest the documentation or check the docs URL and try again."
  );
}
    let openai;
    let modelId = model;
    let apiKeyId = null;

    if (provider == "DEFAULT") {
        if (model === "default-1") modelId = "openai/gpt-oss-120b:free";
        else if (model === "default-2") modelId = "nvidia/nemotron-3-super-120b-a12b:free";
        else throw new ApiError(400, "Invalid model selection for default provider.");

        openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_LLM_API_KEY,
        });
    } else {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                userId: req.user.id,
                provider,
            },
            orderBy: { createdAt: "asc" },
        });
        

        if (!apiKey) {
            throw new ApiError(400, "Invalid API key ID.");
        }
        apiKeyId = apiKey.id;
        if (apiKey.userId !== req.user.id) {
            throw new ApiError(403, "You do not have access to this API key.");
        }
        if (!LLM_MODELS[apiKey.provider]?.includes(model)) {
            throw new ApiError(400, "Invalid model for the selected API key.");
        }

        openai = new OpenAI({
            baseURL: PROVIDERS_BASE_URLS[apiKey.provider],
            apiKey: decryptApiKey(apiKey.encryptedKey, apiKey.iv, apiKey.tag),
        });
    }

    let relevantSources = [];
    let relevantNodes = [];
    if (!chat.chatSources[0].isVectorLess) {
        const userPromptEmbeddings = await generateVectorEmbeddings(userPrompt);
        relevantSources = await qdrant.query(chat.collectionName, {
            query: userPromptEmbeddings,
            limit: 5,
            with_payload: true,
            score_threshold: 0.35,
        });
    } else {
        const docTree = await prisma.documentTree.findUnique({
            where: { id: chat.collectionName },
            orderBy: { createdAt: "asc" },
        });
        treeindex.loadData(docTree.sourceData);
        treeindex.loadTree(docTree.treeData);

        const relevantNodeIds = await treeindex.retrieveRelevantNodes(userPrompt);
        if(relevantNodeIds.length == 0) {
            res.write("No relevant sources found, for this query");
            res.end();
            return;
        }
        relevantNodes = treeindex.findNodes(relevantNodeIds);
    }

    // Dynamic System Instructions
    let systemInstructions = "You are a helpful assistant for answering questions. \n";
    if (relevantSources.points?.length || relevantNodes.length) {
        systemInstructions +=
            "Use the provided documentation sources to answer. If the answer isn't in the sources, say you don't know. Be concise, use Markdown, and wrap code in triple backticks.";
    } else {
        systemInstructions += "Answer the user's greeting or general question directly.";
    }

    // Source Data (if any)
    let sourceContext = "\n--- DOCUMENTATION SOURCES ---\n";
    if (relevantSources.points?.length) {
        relevantSources.points.forEach((point, index) => {
            sourceContext += `Source ${index + 1}:\n${point.payload.body}\n`;
        });
    }
    else if (relevantNodes.length) {
        relevantNodes.forEach(({ data }, index) => {
            sourceContext += `Source ${index + 1}:\n${data}\n`;
        });
    }

    // Long-term Memory (Mem0)
    let memoryContext = "";
    if (MEM0_ENABLED && memory) {
        try {
            const memoryFetched = await memory.search(userPrompt, {
                user_id: req.user.id,
                limit: 5,
            });
            if (memoryFetched && memoryFetched.length) {
                memoryContext = "\n--- RELEVANT PAST USER FACTS ---\n";
                memoryFetched.forEach((item) => {
                    memoryContext += `- ${item.memory}\n`;
                });
            }
        } catch (error) {
            console.error("Mem0 search error (non-fatal):", error.message);
        }
    }

    // Messages Array for the LLM
    const messagesForLLM = [
        {
            role: "system",
            content: `${systemInstructions}\n${sourceContext}\n${memoryContext}`,
        },
    ];

    // Past messages in the chat to maintain context
    const messages = await prisma.chatMessage.findMany({
        where: { chatId },
        take: -10,
        orderBy: { createdAt: "asc" },
    });
    messages.forEach((msg) => {
        if (msg.userPrompt) messagesForLLM.push({ role: "user", content: msg.userPrompt });
        if (msg.llmResponse) {
            messagesForLLM.push({
                role: "assistant",
                content: msg.llmResponse,
            });
        }
    });
    messagesForLLM.push({ role: "user", content: userPrompt });

    // Stream response from the LLM
    const stream = await openai.chat.completions.create({
        model: modelId,
        messages: messagesForLLM,
        stream: true,
        stream_options: { include_usage: true },
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

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
    } catch (error) {
        res.end("Stream ended with error.", error.message);
    } finally {
        res.end();
    }

    if (llmResponse.trim()) {
        if (MEM0_ENABLED && memory) {
            try {
                await memory.add(
                    [
                        { role: "user", content: userPrompt },
                        { role: "assistant", content: llmResponse },
                    ],
                    {
                        user_id: req.user.id,
                        custom_instructions: "Note: Store this interaction history for future reference.",
                    },
                );
            } catch (error) {
                console.error("Mem0 add error (non-fatal):", error.message);
            }
        }

        const chatMessage = await prisma.chatMessage.create({
            data: {
                chatId,
                llmModel: model,
                llmResponse,
                userPrompt,
            },
        });

        if (relevantSources.points?.length) {
            await prisma.chatMessageSource.createMany({
                data: relevantSources.points.map((point) => ({
                    chunkText: point.payload.body,
                    heading: point.payload.title,
                    pageUrl: point.payload.url,
                    chatMessageId: chatMessage.id,
                    score: Math.round(point.score * 100),
                })),
            });
        }
        else if (relevantNodes.length) {
            await prisma.chatMessageSource.createMany({
                data: relevantNodes.map((node) => ({
                    chunkText: node.data,
                    heading: "",
                    pageUrl: "",
                    chatMessageId: chatMessage.id,
                })),
            });
        }

        let usageEventData = {
            userId: req.user.id,
            messageId: chatMessage.id,
            inputTokens,
            outputTokens,
            chatId: chat.id,
        };
        if (model != "default" && provider != "DEFAULT" && apiKeyId) {
            usageEventData = {
                ...usageEventData,
                apikeyId: apiKeyId,
            };
        }
        await prisma.usageEvents.create({
            data: usageEventData,
        });
    }
});

// NOTE: No relation between ChatMessage and Chat in the current schema
const exportChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        orderBy: { createdAt: "asc" },
    });

    if (!chat || chat.userId !== req.user.id) {
        throw new ApiError(404, "Chat not found.");
    }

    const messages = await prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },

    });

    const escapeForPlainText = (text) => text || "";

    const chatName = chat.name || "Untitled Chat";
    const exportDate = new Date();
    const header = [
        "DocChat Conversation Export",
        "===========================",
        `Chat: ${chatName}`,
        `Chat ID: ${chatId}`,
        `Exported: ${exportDate.toLocaleString()}`,
        `Total Messages: ${messages.length * 2}`,
        "",
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="chat-export-${chatId}.txt"`);
    res.setHeader("X-Accel-Buffering", "no");

    res.write(header);

    for (const msg of messages) {
        const msgNumber = messages.indexOf(msg) + 1;

        const userBlock = [
            "",
            `--- Message ${msgNumber} ---`,
            `[User] - ${new Date(msg.createdAt).toLocaleString()}`,
            "",
            escapeForPlainText(msg.userPrompt),
            "",
        ].join("\n");
        res.write(userBlock);

        const assistantBlock = [
            `--- Message ${msgNumber} ---`,
            `[Assistant] - ${new Date(msg.createdAt).toLocaleString()}`,
            `Model: ${msg.llmModel || "Unknown"}`,
            "",
            escapeForPlainText(msg.llmResponse),
            "",
        ].join("\n");
        res.write(assistantBlock);
    }

    res.write("\n--- End of Conversation ---\n");
    res.end();
});

const getChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        orderBy: { createdAt: "asc" },
    });

    if (!chat || chat.userId !== req.user.id) {
        throw new ApiError(404, "Chat not found.");
    }

    const messages = await prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
    });

    if (!messages.length) {
        return res
            .status(200)
            .json(new ApiResponse(200, { messages: [] }, "No messages found for this chat."));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { messages: messages }, "Chat messages retrieved successfully."));
});

const getChatMessageSources = asyncHandler(async (req, res) => {
    const { messageId } = req.params;

    const messageSources = await prisma.chatMessageSource.findMany({
        where: { chatMessageId: messageId },
        orderBy: { createdAt: "asc" },
    });

    if (!messageSources.length) {
        return res
            .status(200)
            .json(
                new ApiResponse(200, { messageSources: [] }, "No sources found for this chat message."),
            );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { messageSources }, "Chat message sources retrieved successfully."));
});

const getSharedChatMessages = asyncHandler(async (req, res) => {
    const { shareToken } = req.params;

    const chat = await prisma.chat.findUnique({
        where: { shareToken },
    });

    if (!chat) {
        throw new ApiError(404, "Shared chat not found");
    }

    const messages = await prisma.chatMessage.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: "asc" },
    });

    if (!messages.length) {
        return res
            .status(200)
            .json(new ApiResponse(200, { messages: [] }, "No messages found for this chat."));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { messages: messages }, "Chat messages retrieved successfully."));
});

export { sendMessage, getAvailableModels, getChatMessages, getChatMessageSources, exportChatMessages, getSharedChatMessages };
