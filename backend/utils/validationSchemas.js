import { z } from "zod";

const email = z.string().trim().email("Invalid email address");
const password = z.string().min(6, "Password must be at least 6 characters");
const chatId = z.string().uuid("Invalid chat ID");
const url = z.string().trim().url("Invalid URL");
const DEFAULT_MIN_AGE_DAYS = 7;
export const VALID_GROUP_BY = ["day", "week", "month"];

export function validateGroupBy(value) {
    if (!VALID_GROUP_BY.includes(value)) {
        const err = new Error(`Invalid groupBy "${value}". Must be one of: ${VALID_GROUP_BY.join(", ")}`);
        err.status = 400;
        err.statusCode = 400;
        throw err;
    }
    return value;
}

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
        path: [],
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

export const userIdParamSchema = {
    params: z.object({
        userId: z.string().uuid("Invalid user ID"),
    }),
};

export const expectationQuerySchema = {
    query: z.object({
        docsUrl: url,
        isVectorLess: z
            .union([z.boolean(), z.string(), z.number()])
            .optional()
            .transform((v, ctx) => {
                if (v === undefined) return undefined;
                if (typeof v === "boolean") return v;

                if (typeof v === "number") {
                    if (v === 1) return true;
                    if (v === 0) return false;
                }

                if (typeof v === "string") {
                    const normalized = v.trim().toLowerCase();

                    if (["true", "1", "yes", "on"].includes(normalized)) return true;
                    if (["false", "0", "no", "off"].includes(normalized)) return false;
                }

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "isVectorLess must be a boolean or a supported boolean-like value",
                });

                return z.NEVER;
            }),
    }),
};

export const createChatSchema = {
    body: z.object({
        name: z.string().trim().optional(),
        docsUrl: url.optional(),
        docsUrls: z.array(url).min(1, "At least one documentation URL is required").optional(),
        isVectorLess: z
            .union([z.boolean(), z.string(), z.number()])
            .optional()
            .transform((v, ctx) => {
                if (v === undefined) return undefined;
                if (typeof v === "boolean") return v;

                if (typeof v === "number") {
                    if (v === 1) return true;
                    if (v === 0) return false;
                }

                if (typeof v === "string") {
                    const normalized = v.trim().toLowerCase();

                    if (["true", "1", "yes", "on"].includes(normalized)) return true;
                    if (["false", "0", "no", "off"].includes(normalized)) return false;
                }

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "isVectorLess must be a boolean or a supported boolean-like value",
                });

                return z.NEVER;
            }),
    }).refine((data) => Boolean(data.docsUrl || data.docsUrls?.length), {
        message: "docsUrl or docsUrls is required",
        path: ["docsUrls"],
    }),
};

export const addChatSourceSchema = {
    body: z.object({
        docsUrl: url,
        isVectorLess: z
            .union([z.boolean(), z.string(), z.number()])
            .optional()
            .transform((v, ctx) => {
                if (v === undefined) return undefined;
                if (typeof v === "boolean") return v;

                if (typeof v === "number") {
                    if (v === 1) return true;
                    if (v === 0) return false;
                }

                if (typeof v === "string") {
                    const normalized = v.trim().toLowerCase();

                    if (["true", "1", "yes", "on"].includes(normalized)) return true;
                    if (["false", "0", "no", "off"].includes(normalized)) return false;
                }

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "isVectorLess must be a boolean or a supported boolean-like value",
                });

                return z.NEVER;
            }),
        scrapeLimit: z.number().int().min(1).max(5000).optional(),
    }),
};

export const qdrantCleanupSchema = {
    query: z.object({
        force: z
            .union([z.boolean(), z.string(), z.number()])
            .optional()
            .transform((value) => {
                if (value === undefined || value === null) return false;
                if (typeof value === "boolean") return value;
                if (typeof value === "number") return value === 1;
                if (typeof value === "string") {
                    const normalized = value.trim().toLowerCase();
                    return ["true", "1", "yes", "on"].includes(normalized);
                }
                return false;
            }),
        minAgeDays: z
            .union([z.number(), z.string()])
            .optional()
            .transform((value) => {
                if (value === undefined || value === null || value === "") return DEFAULT_MIN_AGE_DAYS;
                const parsed = Number(value);
                return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_MIN_AGE_DAYS;
            }),
    }),
};

export const sendMessageSchema = {
    body: z.object({
        userPrompt: z.string().min(1, "Message is required").max(4000, "Prompt is too long (maximum 4000 characters allowed)").trim(),
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

export const paginationSchema = {
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
};

export const rangeSchema = {
    query: z.object({
        range: z.enum(["24h", "7d", "30d"]).default("7d"),
    }),
};
