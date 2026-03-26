import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import crypto from "crypto";

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

const addApiKey = asyncHandler(async (req, res) => {
    const { key, name, provider } = req.body;
    if (!key || !provider) {
        throw new ApiError(400, "API key and provider are required");
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
        where: {
            userId: req.user.id,
        },
    });
    res.status(200).json(
        new ApiResponse(200, { apiKeys }, "API keys listed successfully"),
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

export { addApiKey, listApiKeys, removeApiKey };
