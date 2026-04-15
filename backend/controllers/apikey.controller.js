import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import crypto from "crypto";
import { decryptApiKey } from "../utils/decrypt.js";
import { LLM_MODELS } from "../utils/constants.js";

function encryptApiKey(apikey) {
    const iv = crypto.randomBytes(12).toString("base64");

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(process.env.CIPHER_KEY, "base64"),
        Buffer.from(iv, "base64"),
    );

    let cipherText = cipher.update(apikey, "utf-8", "base64");
    cipherText += cipher.final("base64");

    const tag = cipher.getAuthTag();

    return { cipherText, tag, iv };
}

async function checkApiKeyValidity(provider, apikey) {
    let url;
    let headers = { "Content-Type": "application/json" };

    if (provider === "OPENAI") {
        url = "https://api.openai.com/v1/models";
        headers.Authorization = `Bearer ${apikey}`;
    } else if (provider === "ANTHROPIC") {
        url = "https://api.anthropic.com/v1/models";
        headers["x-api-key"] = apikey;
        headers["anthropic-version"] = "2023-06-01";
    } else if (provider === "GOOGLE") {
        url = `https://generativelanguage.googleapis.com/v1/models?key=${apikey}`;
    } else if (provider === "XAI") {
        url = "https://api.x.ai/v1/models";
        headers.Authorization = `Bearer ${apikey}`;
    } else if (provider === "OPENROUTER") {
        return true; // No standard endpoint to validate, assume valid. Actual validation will happen when user tries to use it and fails if invalid.
    } else {
        return false;
    }

    try {
        const res = await fetch(url, { headers });

        if (res.status === 200) return true;
        if (res.status === 429) return true; // Rate limited but valid
        if (res.status === 401 || res.status === 403) return false; // Unauthorized / invalid

        return false;
    } catch (err) {
        return false;
    }
}

const addApiKey = asyncHandler(async (req, res) => {
    const { key, name, provider } = req.body;
    if (!key || !provider) {
        throw new ApiError(400, "API key and provider are required");
    }

    const isValid = await checkApiKeyValidity(provider, key);
    if (!isValid) {
        throw new ApiError(400, "Invalid API key or provider");
    }

    const apiKey = await prisma.apiKey.findFirst({
        where: {
            userId: req.user.id,
            provider,
        },
    });

    if (apiKey) {
        throw new ApiError(
            400,
            `An API key for provider ${provider} already exists. Please remove it first if you want to add a new one.`,
        );
    }

    const { cipherText, tag, iv } = encryptApiKey(key);

    await prisma.apiKey.create({
        data: {
            userId: req.user.id,
            name: name || `Key-${Date.now()}`,
            encryptedKey: cipherText,
            iv,
            tag,
            provider: provider,
        },
    });

    res.status(201).json(
        new ApiResponse(200, {}, "API key added successfully"),
    );
});

const listApiKeys = asyncHandler(async (req, res) => {
    const apiKeys = await prisma.apiKey.findMany({
        where: { userId: req.user.id },
        select: {
            id: true,
            name: true,
            provider: true,
            createdAt: true,
            encryptedKey: true,
            iv: true,
            tag: true,
        },
    });

    const formattedApiKeys = apiKeys.map((key) => {
        const decryptedKey = decryptApiKey(key.encryptedKey, key.iv, key.tag);

        const startingSection = decryptedKey.slice(0, 5);
        const endingSection = decryptedKey.slice(-5);

        let formattedKey = startingSection + "*****" + endingSection;

        key.formattedKey = formattedKey;
        key.models = LLM_MODELS[key.provider] || [];

        delete key.encryptedKey;
        delete key.iv;
        delete key.tag;

        return key;
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { apiKeys: formattedApiKeys },
            "API keys listed successfully",
        ),
    );
});

const removeApiKey = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.apiKey.delete({
        where: {
            id,
            userId: req.user.id,
        },
    });

    res.status(200).json(
        new ApiResponse(200, {}, "API key removed successfully"),
    );
});

const getApiKey = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const apiKey = await prisma.apiKey.findUnique({
        where: {
            id,
            userId: req.user.id,
        },
        select: {
            id: true,
            name: true,
            provider: true,
            createdAt: true,
            encryptedKey: true,
            iv: true,
            tag: true,
        },
    });

    if (!apiKey) {
        throw new ApiError(404, "API key not found");
    }

    const decryptedKey = decryptApiKey(
        apiKey.encryptedKey,
        apiKey.iv,
        apiKey.tag,
    );
    delete apiKey.encryptedKey;
    delete apiKey.iv;
    delete apiKey.tag;

    res.status(200).json(
        new ApiResponse(
            200,
            { ...apiKey, decryptedKey },
            "API key retrieved successfully",
        ),
    );
});

const totalNumberOfApiKeys = asyncHandler(async (req, res) => {
    const count = await prisma.apiKey.count({
        where: { userId: req.user.id },
    });

    res.status(200).json(
        new ApiResponse(
            200,
            { count },
            "Total number of API keys retrieved successfully",
        ),
    );
});

export {
    addApiKey,
    listApiKeys,
    removeApiKey,
    getApiKey,
    totalNumberOfApiKeys,
};
