import { z } from "zod";

const email = z.string().email("Invalid email address").trim();
const password = z.string().min(6, "Password must be at least 6 characters");
const chatId = z.string().uuid("Invalid chat ID");
const url = z.string().url("Invalid URL").trim();

export const sendVerificationCodeSchema = {
    body: z.object({
        email,
    }),
};

export const verifyEmailSchema = {
    body: z.object({
        email,
        code: z.union([z.string(), z.number()]).transform((v) => Number(v)),
    }),
};

export const userRegisterSchema = {
    body: z.object({
        fullname: z.string().min(1, "Full name is required").trim(),
        username: z.string().min(1, "Username is required").trim(),
        email,
        password,
    }),
};

export const userLogInSchema = {
    body: z.object({
        username: z.string().trim().optional(),
        email: z.string().trim().optional(),
        password,
    }).refine((data) => data.username || data.email, {
        message: "Username or email is required",
        path: ["username"],
    }),
};

export const sendResetCodeSchema = {
    body: z.object({
        email,
    }),
};

export const resetPasswordSchema = {
    body: z.object({
        email,
        code: z.union([z.string(), z.number()]).transform((v) => Number(v)),
        password,
    }),
};

export const chatIdParamSchema = {
    params: z.object({
        chatId,
    }),
};

export const messageIdParamSchema = {
    params: z.object({
        messageId: z.string().uuid("Invalid message ID"),
    }),
};

export const apiKeyIdParamSchema = {
    params: z.object({
        id: z.string().uuid("Invalid API key ID"),
    }),
};

export const expectationQuerySchema = {
    query: z.object({
        docsUrl: url,
    }),
};

export const createChatSchema = {
    body: z.object({
        name: z.string().trim().optional(),
        docsUrl: url,
        isVectorLess: z
            .union([z.boolean(), z.string(), z.number()])
            .optional()
            .transform((v) => Boolean(v)),
    }),
};

export const sendMessageSchema = {
    body: z.object({
        userPrompt: z.string().min(1, "Message is required").trim(),
        model: z.string().min(1, "Model is required"),
        provider: z.string().min(1, "Provider is required"),
        chatId,
    }),
};

export const addApiKeySchema = {
    body: z.object({
        key: z.string().min(1, "API key is required").trim(),
        name: z.string().trim().optional(),
        provider: z.enum(["OPENAI", "ANTHROPIC", "GOOGLE", "XAI", "OPENROUTER"], {
            errorMap: () => ({ message: "Provider must be one of: OPENAI, ANTHROPIC, GOOGLE, XAI, OPENROUTER" }),
        }),
    }),
};

export const tokensByGroupSchema = {
    params: z.object({
        groupBy: z.enum(["day", "week", "month", "year"], {
            errorMap: () => ({ message: "GroupBy must be one of: day, week, month, year" }),
        }),
    }),
};
