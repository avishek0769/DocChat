import { forceSignOut, getAccessToken } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

type ApiEnvelope<T> = {
    statuscode?: number;
    message?: string;
    data?: T;
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

export type ChatItem = {
    id: string;
    name: string;
    status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
    createdAt: string;
    updatedAt: string;
    chatSources: Array<{
        id: string;
        documentationUrl: string;
        totalPages: number;
        isVectorLess?: boolean;
        _count?: { pagesIndexed: number };
        pagesIndexed?: Array<{ pageUrl: string; title?: string | null }>;
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

const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers || {});
    if (!headers.has("Content-Type") && init?.body) {
        headers.set("Content-Type", "application/json");
    }

    const token = getAccessToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        credentials: "include",
    });

    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            forceSignOut();
        }
        throw new Error(payload?.message || "Request failed");
    }

    return (payload.data ?? ({} as T)) as T;
};

export const getUserProfile = () =>
    apiRequest<{
        id: string;
        fullname?: string | null;
        username?: string | null;
        email?: string | null;
    }>("/user/profile", { method: "GET" });

export const getApiKeys = () => apiRequest<{ apiKeys: ApiKeyItem[] }>("/apikey/list", { method: "GET" });

export const createApiKey = (payload: { key: string; name: string; provider: Provider }) =>
    apiRequest("/apikey/add", {
        method: "POST",
        body: JSON.stringify(payload),
    });

export const deleteApiKey = (id: string) => apiRequest(`/apikey/${id}`, { method: "DELETE" });

export const getApiKeyCount = () => apiRequest<{ count: number }>("/apikey/count", { method: "GET" });

export const getChats = () => apiRequest<ChatItem[]>("/chat/list", { method: "GET" });

export const createChat = (payload: {
    name?: string;
    docsUrl: string;
    isVectorLess?: boolean;
}) =>
    apiRequest<{ chatId?: string; id?: string }>("/chat/create", {
        method: "POST",
        body: JSON.stringify(payload),
    });

export const deleteChat = (chatId: string) => apiRequest(`/chat/${chatId}`, { method: "DELETE" });

export const getChatStatus = (chatId: string) =>
    apiRequest<{ progress: { status: string; progress: number } }>(`/chat/status/${chatId}`, {
        method: "GET",
    });

export const getChatDetails = (chatId: string) =>
    apiRequest<{ chat: ChatItem }>(`/chat/${chatId}`, { method: "GET" });

export const getPagesIndexed = (chatId: string) =>
    apiRequest<{
        pagesIndexed: Array<{ pageUrl: string; title?: string | null }>;
    }>(`/chat/pages-indexed/${chatId}`, { method: "GET" });

export const getAvailableModels = () =>
    apiRequest<{ models: string[] }>("/message/models", { method: "GET" });

export const getChatMessages = (chatId: string) =>
    apiRequest<{ messages: ChatMessageItem[] }>(`/message/all/${chatId}`, {
        method: "GET",
    });

export const getMessageSources = (messageId: string) =>
    apiRequest<{ messageSources: ChatMessageSourceItem[] }>(`/message/sources/${messageId}`, {
        method: "GET",
    });

export const sendMessageStream = async (payload: {
    userPrompt: string;
    model: string;
    provider: string;
    chatId: string;
    onChunk?: (chunk: string) => void;
}) => {
    const token = getAccessToken();
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}/message/send`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
        if (response.status === 401 || response.status === 403) {
            forceSignOut();
        }
        throw new Error(payload?.message || "Unable to send message");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        text += chunk;
        payload.onChunk?.(chunk);
    }

    const tail = decoder.decode();
    if (tail) {
        text += tail;
        payload.onChunk?.(tail);
    }
    return text;
};

export const getLifetimeTokens = () =>
    apiRequest<{
        _sum: { inputTokens: number | null; outputTokens: number | null };
    }>("/usage/lifetime-tokens", { method: "GET" });

export const getTokensByGroup = (groupBy: "day" | "week" | "month" | "year") =>
    apiRequest<
        Record<
            string,
            {
                period: string;
                usageByModels: Array<{
                    model: string;
                    totalInput: number;
                    totalOutput: number;
                }>;
            }
        >
    >(`/usage/tokens/${groupBy}`, { method: "GET" });

export const getRecentChats = () => apiRequest<ChatItem[]>("/chat/recent", { method: "GET" });

export const getTopChatsByUsage = () =>
    apiRequest<
        Array<{
            chatId: string;
            _sum: { inputTokens: number | null; outputTokens: number | null };
            name?: string | null;
        }>
    >("/usage/top-chats", { method: "GET" });
