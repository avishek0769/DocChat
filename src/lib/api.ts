import { forceSignOut, getAccessToken, getAuthUser } from "./auth";
import {
    getFromCache,
    setInCache,
    removeFromCache,
    removeMatchingFromCache,
} from "./cache";

// Provide a minimal typing for Vite's import.meta.env to avoid TS errors when
// this project isn't using the Vite types globally.
declare global {
    interface ImportMetaEnv {
        VITE_API_BASE_URL?: string;
        // add other env vars here as needed
    }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

type ApiError = {
    field: string;
    message: string;
};

type ApiEnvelope<T> = {
    statuscode?: number;
    message?: string;
    data?: T;
    errors?: ApiError[];
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
    shareToken?: string | null;
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
        // Build a human-readable summary from structured errors
        // when the backend returns them (issue #31).
        const errors = payload?.errors;
        let errorMessage = payload?.message || "Request failed";
        if (Array.isArray(errors) && errors.length > 0) {
            const firstError = `${errors[0].field}: ${errors[0].message}`;
            if (errors.length === 1) {
                errorMessage = firstError;
            } else {
                errorMessage = `${firstError} and ${errors.length - 1} more`;
            }
        }
        throw new Error(errorMessage);
    }

    return (payload.data ?? ({} as T)) as T;
};

const cacheKey = (path: string) => {
    const userId = getAuthUser()?.id || "anon";
    return `api:${userId}:${path}`;
};

async function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = getFromCache<T>(key);
    if (cached !== null) {
        fetcher()
            .then((value) => setInCache(key, value, ttlMs))
            .catch(() => {});
        return cached;
    }
    const value = await fetcher();
    setInCache(key, value, ttlMs);
    return value;
}

export const invalidateApiKeyCaches = () => {
    const prefix = cacheKey("");
    removeMatchingFromCache(`${prefix}/apikey/list`);
    removeMatchingFromCache(`${prefix}/apikey/count`);
    removeMatchingFromCache(`${prefix}/message/models`);
};

export const invalidateChatCaches = () => {
    const prefix = cacheKey("");
    removeMatchingFromCache(`${prefix}/chat/list`);
    removeMatchingFromCache(`${prefix}/chat/recent`);
};

export const invalidateChatMessages = (chatId: string) => {
    removeFromCache(cacheKey(`/message/all/${chatId}`));
};

export const invalidatePagesIndexed = (chatId: string) => {
    removeFromCache(cacheKey(`/chat/pages-indexed/${chatId}`));
};

export const invalidateUserCache = () => {
    const prefix = cacheKey("");
    removeMatchingFromCache(prefix);
};

export const getUserProfile = () =>
    withCache(cacheKey("/user/profile"), 30 * 60 * 1000, () =>
        apiRequest<{
            id: string;
            fullname?: string | null;
            username?: string | null;
            email?: string | null;
            isAdmin?: boolean;
        }>("/user/profile", { method: "GET" }),
    );

export const getApiKeys = () => apiRequest<{ apiKeys: ApiKeyItem[] }>("/apikey/list", { method: "GET" });

export const createApiKey = async (payload: { key: string; name: string; provider: Provider }) => {
    const result = await apiRequest("/apikey/add", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    invalidateApiKeyCaches();
    return result;
};

export const deleteApiKey = async (id: string) => {
    const result = await apiRequest(`/apikey/${id}`, { method: "DELETE" });
    invalidateApiKeyCaches();
    return result;
};

export const updateApiKey = async (id: string, payload: { key?: string; name?: string }) => {
    const result = await apiRequest(`/apikey/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    invalidateApiKeyCaches();
    return result;
};

export const getApiKeyCount = () => apiRequest<{ count: number }>("/apikey/count", { method: "GET" });

export const getChats = () =>
    withCache(cacheKey("/chat/list"), 5 * 60 * 1000, () =>
        apiRequest<ChatItem[]>("/chat/list", { method: "GET" }),
    );

export const createChat = async (payload: {
    name?: string;
    docsUrl: string;
    isVectorLess?: boolean;
    scrapeLimit?: number;
}) => {
    const result = await apiRequest<{ chatId?: string; id?: string }>("/chat/create", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    invalidateChatCaches();
    return result;
};

export const deleteChat = async (chatId: string) => {
    const result = await apiRequest(`/chat/${chatId}`, { method: "DELETE" });
    invalidateChatCaches();
    return result;
};

export const getChatStatus = (chatId: string) =>
    apiRequest<{
        progress: {
            status: string;
            progress: number;
            current: number;
            total: number;
        };
    }>(`/chat/status/${chatId}`, {
        method: "GET",
    });

export const getChatDetails = (chatId: string) =>
    apiRequest<{ chat: ChatItem }>(`/chat/${chatId}`, { method: "GET" });

export const cancelChat = async (chatId: string) => {
    const result = await apiRequest(`/chat/${chatId}/cancel`, {
        method: "POST",
    });
    return result;
};

export const getPagesIndexed = (chatId: string) =>
    withCache(cacheKey(`/chat/pages-indexed/${chatId}`), 5 * 60 * 1000, () =>
        apiRequest<{
            pagesIndexed: Array<{ pageUrl: string; title?: string | null }>;
        }>(`/chat/pages-indexed/${chatId}`, { method: "GET" }),
    );

export const getAvailableModels = () =>
    withCache(cacheKey("/message/models"), 5 * 60 * 1000, () =>
        apiRequest<{ models: string[] }>("/message/models", { method: "GET" }),
    );

export const getChatMessages = (chatId: string) =>
    withCache(cacheKey(`/message/all/${chatId}`), 5 * 60 * 1000, () =>
        apiRequest<{ messages: ChatMessageItem[] }>(`/message/all/${chatId}`, {
            method: "GET",
        }),
    );

export const getMessageSources = (messageId: string) =>
    withCache(cacheKey(`/message/sources/${messageId}`), 5 * 60 * 1000, () =>
        apiRequest<{ messageSources: ChatMessageSourceItem[] }>(`/message/sources/${messageId}`, {
            method: "GET",
        }),
    );

export const sendMessageStream = async (payload: {
    userPrompt: string;
    model: string;
    provider: string;
    chatId: string;
    onChunk?: (chunk: string) => void;
    signal?: AbortSignal; 
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
        signal: payload.signal, 
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

    invalidateChatMessages(payload.chatId);
    return text;
};

export const exportChatMessages = async (chatId: string): Promise<void> => {
    const token = getAccessToken();
    const headers = new Headers();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}/message/export/${chatId}`, {
        method: "GET",
        headers,
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to export chat");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${chatId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const getLifetimeTokens = () =>
    withCache(cacheKey("/usage/lifetime-tokens"), 5 * 60 * 1000, () =>
        apiRequest<{
            _sum: { inputTokens: number | null; outputTokens: number | null; estimatedCostUsd: number | null };
        }>("/usage/lifetime-tokens", { method: "GET" }),
    );

export const getTokensByGroup = (groupBy: "day" | "week" | "month" | "year") =>
    withCache(cacheKey(`/usage/tokens/${groupBy}`), 10 * 60 * 1000, () =>
        apiRequest<
            Record<
                string,
                {
                    period: string;
                    usageByModels: Array<{
                        model: string;
                        provider: string | null;
                        totalInput: number;
                        totalOutput: number;
                        estimatedCostUsd: number;
                    }>;
                }
            >
        >(`/usage/tokens/${groupBy}`, { method: "GET" }),
    );

export const getRecentChats = () =>
    withCache(cacheKey("/chat/recent"), 5 * 60 * 1000, () =>
        apiRequest<ChatItem[]>("/chat/recent", { method: "GET" }),
    );

export const getTopChatsByUsage = () =>
    withCache(cacheKey("/usage/top-chats"), 5 * 60 * 1000, () =>
        apiRequest<
            Array<{
                chatId: string;
                _sum: { inputTokens: number | null; outputTokens: number | null; estimatedCostUsd: number | null };
                name?: string | null;
            }>
        >("/usage/top-chats", { method: "GET" }),
    );
export type UsageBreakdownItem = {
    model: string;
    provider: string | null;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    requestCount: number;
    estimatedCostUsd: number;
};

export type AdminUsageSummary = {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
};

export type AdminUsageUserRow = {
    userId: string | null;
    username?: string | null;
    fullname?: string | null;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
};

export type AdminUsageModelRow = {
    model: string;
    provider: string | null;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
};

export const getUsageBreakdown = (params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}) => {
    const query = new URLSearchParams(
        Object.entries(params || {})
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
    ).toString();

    return apiRequest<{
        data: UsageBreakdownItem[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>(`/usage/breakdown${query ? `?${query}` : ""}`, { method: "GET" });
};

export type AdminOverviewData = {
    totalUsers?: number;
    totalChats?: number;
    totalMessages?: number;
    totalUsageEvents?: number;
    totalIngestionRuns?: number;

    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalEstimatedCostUsd?: number;

    latestAuditEvents?: Array<{
        id: string;
        type: string;
        userId?: string | null;
        chatId?: string | null;
        metadata?: unknown;
        createdAt: string;
    }>;
};

export type AdminUsageData = {
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalEstimatedCostUsd?: number;

    topUsersByTokenUsage?: Array<{
        userId: string | null;
        username?: string | null;
        fullname?: string | null;
        requestCount: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd?: number;
    }>;

    topModelsByTokenUsage?: Array<{
        model: string;
        provider?: string | null;
        requestCount: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd?: number;
    }>;

    pagination?: {
        page: number;
        limit: number;
    };
};

export type AdminUserItem = {
    id: string;
    fullname?: string | null;
    username?: string | null;
    email?: string | null;
    isAdmin?: boolean;
    createdAt?: string;
    lastActiveAt?: string | null;
    totalChats?: number;
    totalTokens?: number;
};

export type AdminUserDetailResponse = {
    user: AdminUserItem & {
        role?: string | null;
    };
    recentChats?: ChatItem[];
    recentActivity?: Array<{
        id: string;
        type: string;
        title?: string | null;
        detail?: string | null;
        createdAt: string;
    }>;
    usageBreakdown?: UsageBreakdownItem[];
};

export type AdminIngestionData = {
    READY?: number;
    FAILED?: number;
    PROCESSING?: number;
    QUEUED?: number;
    recentFailedIngestionRuns?: Array<{
        id: string;
        chatId: string;
        chatSourceId: string;
        status: string;
        startedAt: string;
        finishedAt?: string | null;
        errorCode?: string | null;
        errorMessage?: string | null;
    }>;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

export const getAdminOverview = (range: "24h" | "7d" | "30d") =>
    apiRequest<AdminOverviewData>(`/admin/overview?range=${range}`, { method: "GET" });

export const getAdminUsers = (page = 1, limit = 10) =>
    apiRequest<{
        data: AdminUserItem[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>(`/admin/users?page=${page}&limit=${limit}`, { method: "GET" });

export const getAdminUser = (userId: string) =>
    apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`, { method: "GET" });

export const getAdminUsage = (range: "24h" | "7d" | "30d") =>
    apiRequest<AdminUsageData>(`/admin/usage?range=${range}`, { method: "GET" });

export const getAdminIngestion = (range: "24h" | "7d" | "30d") =>
    apiRequest<AdminIngestionData>(`/admin/ingestion?range=${range}`, { method: "GET" });

export const toggleChatShare = (chatId: string) =>
    apiRequest<ChatItem>(`/chat/${chatId}/share`, { method: "POST" });

export const getSharedChatDetails = (shareToken: string) =>
    apiRequest<{ chat: ChatItem }>(`/chat/shared/${shareToken}`, { method: "GET" });

export const getSharedChatMessages = (shareToken: string) =>
    apiRequest<{ messages: ChatMessageItem[] }>(`/message/shared/${shareToken}/messages`, { method: "GET" });

export const forkSharedChat = (shareToken: string) =>
    apiRequest<{ chatId: string }>(`/chat/shared/${shareToken}/fork`, { method: "POST" });
