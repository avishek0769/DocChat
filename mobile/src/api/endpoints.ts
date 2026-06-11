/**
 * Typed endpoint wrappers, mapped from the web client's `src/lib/api.ts`.
 * Only the endpoints needed for the initial mobile scope are exposed:
 * auth, chats list, chat messages, sending a message, and usage summary.
 */
import { apiRequest, getAuthToken } from "./client";
import { API_BASE_URL } from "../config";
import type {
    ApiKeyItem,
    AuthSession,
    ChatItem,
    ChatMessageItem,
    ChatMessageSourceItem,
    LifetimeTokens,
    LoginResponse,
    Provider,
} from "../types";

/** POST /user/login — accepts an email or a username plus password. */
export async function login(identifier: string, password: string): Promise<AuthSession> {
    const credential = identifier.trim();
    const identifierPayload = credential.includes("@")
        ? { email: credential }
        : { username: credential };

    const data = await apiRequest<LoginResponse>("/user/login", {
        method: "POST",
        body: JSON.stringify({ ...identifierPayload, password }),
    });

    if (!data?.accessToken) {
        throw new Error("Invalid login response from server");
    }

    return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
            id: data.id,
            fullname: data.fullname,
            username: data.username,
            email: data.email,
            isAdmin: data.isAdmin,
        },
    };
}

export const logout = () => apiRequest("/user/logout", { method: "GET" });

// --- Registration flow (matches the backend: send code -> verify -> register) ---

/** Step 1: POST /user/send-verification-code — emails a code to a new address. */
export const sendVerificationCode = (email: string) =>
    apiRequest<{ emailSent: boolean }>("/user/send-verification-code", {
        method: "POST",
        body: JSON.stringify({ email }),
    });

/** Step 2: POST /user/verify-email — confirms the emailed code. */
export const verifyEmail = (email: string, code: string) =>
    apiRequest("/user/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
    });

/** Step 3: POST /user/register — completes a verified account. */
export const register = (payload: {
    fullname: string;
    username: string;
    email: string;
    password: string;
}) =>
    apiRequest("/user/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });

// --- Password reset flow ---

export const sendResetCode = (email: string) =>
    apiRequest<{ emailSent: boolean }>("/user/send-reset-code", {
        method: "POST",
        body: JSON.stringify({ email }),
    });

export const resetPassword = (email: string, code: string, password: string) =>
    apiRequest<{ reset: boolean }>("/user/reset-password", {
        method: "PATCH",
        body: JSON.stringify({ email, code, password }),
    });

export const getChats = () => apiRequest<ChatItem[]>("/chat/list", { method: "GET" });

/** POST /chat/create — ingest a new documentation URL. */
export const createChat = (payload: {
    name?: string;
    docsUrl: string;
    isVectorLess?: boolean;
    scrapeLimit?: number;
}) =>
    apiRequest<{ chatId?: string; id?: string }>("/chat/create", {
        method: "POST",
        body: JSON.stringify(payload),
    });

export const deleteChat = (chatId: string) =>
    apiRequest(`/chat/${chatId}`, { method: "DELETE" });

export const getChatMessages = (chatId: string) =>
    apiRequest<{ messages: ChatMessageItem[] }>(`/message/all/${chatId}`, { method: "GET" });

export const getMessageSources = (messageId: string) =>
    apiRequest<{ messageSources: ChatMessageSourceItem[] }>(`/message/sources/${messageId}`, {
        method: "GET",
    });

export const getAvailableModels = () =>
    apiRequest<{ models: string[] }>("/message/models", { method: "GET" });

export const getApiKeys = () =>
    apiRequest<{ apiKeys: ApiKeyItem[] }>("/apikey/list", { method: "GET" });

/** POST /apikey/add — store a new provider key (encrypted server-side). */
export const createApiKey = (payload: { key: string; name: string; provider: Provider }) =>
    apiRequest("/apikey/add", { method: "POST", body: JSON.stringify(payload) });

export const deleteApiKey = (id: string) =>
    apiRequest(`/apikey/${id}`, { method: "DELETE" });

export const getLifetimeTokens = () =>
    apiRequest<LifetimeTokens>("/usage/lifetime-tokens", { method: "GET" });

/**
 * POST /message/send — the backend streams the model's reply as plain text.
 * React Native's fetch does not expose a readable stream body, so instead of
 * consuming chunks incrementally (as the web client does) we await the full
 * response text. The returned string is the complete assistant reply.
 */
export async function sendMessage(params: {
    chatId: string;
    userPrompt: string;
    model: string;
    provider: string;
}): Promise<string> {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getAuthToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}/message/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message ?? "Unable to send message");
    }

    return response.text();
}
