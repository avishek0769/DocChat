/**
 * Minimal API client for the DocChat backend.
 *
 * This is the mobile counterpart of the web client's `apiRequest` helper in
 * `src/lib/api.ts`: it attaches the Bearer token, unwraps the standard
 * `{ data, message, errors }` response envelope, and signs the user out on a
 * 401/403. The access token is held in memory and refreshed by AuthContext
 * (which restores it from SecureStore on launch).
 */
import { API_BASE_URL } from "../config";

type ApiErrorItem = { field: string; message: string };

type ApiEnvelope<T> = {
    statuscode?: number;
    message?: string;
    data?: T;
    errors?: ApiErrorItem[];
};

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
    accessToken = token;
};

export const getAuthToken = () => accessToken;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
    onUnauthorized = handler;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    if (!headers.has("Content-Type") && init?.body) {
        headers.set("Content-Type", "application/json");
    }
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            onUnauthorized?.();
        }
        const errors = payload?.errors;
        let message = payload?.message ?? "Request failed";
        if (Array.isArray(errors) && errors.length > 0) {
            const first = `${errors[0].field}: ${errors[0].message}`;
            message = errors.length === 1 ? first : `${first} and ${errors.length - 1} more`;
        }
        throw new Error(message);
    }

    return (payload.data ?? ({} as T)) as T;
}
