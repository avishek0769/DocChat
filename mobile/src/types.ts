/**
 * Shared types for the DocChat mobile client.
 * These mirror the contracts defined in the web client's `src/lib/api.ts`
 * and `src/lib/auth.ts` so the mobile app talks to the same backend.
 */

export type AuthUser = {
    id: string;
    fullname?: string | null;
    username?: string | null;
    email?: string | null;
    isAdmin?: boolean;
};

export type LoginResponse = AuthUser & {
    accessToken: string;
    refreshToken?: string;
};

export type AuthSession = {
    accessToken: string;
    refreshToken?: string;
    user: AuthUser;
};

export type Provider = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "XAI" | "OPENROUTER";

export type ApiKeyItem = {
    id: string;
    name: string;
    provider: Provider;
    createdAt: string;
    formattedKey: string;
    models: string[];
};

export type ChatStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED";

export type ChatItem = {
    id: string;
    name: string;
    status: ChatStatus;
    createdAt: string;
    updatedAt: string;
    shareToken?: string | null;
    chatSources?: Array<{
        id: string;
        documentationUrl: string;
        totalPages: number;
    }>;
    totalUsage?: {
        input: number;
        output: number;
        total: number;
    };
};

export type ChatMessageItem = {
    id: string;
    chatId: string;
    userPrompt: string;
    llmResponse: string;
    llmModel: string;
    createdAt: string;
};

export type ChatMessageSourceItem = {
    id: string;
    heading: string;
    pageUrl: string;
    chunkText: string;
    score: number;
};

export type LifetimeTokens = {
    _sum: {
        inputTokens: number | null;
        outputTokens: number | null;
        estimatedCostUsd: number | null;
    };
};
