import prisma from "../utils/prismaClient.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { LLM_MODELS } from "../utils/constants.js";


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
    
})

export { sendMessage, getAvailableModels }