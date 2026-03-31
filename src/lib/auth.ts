const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const AUTH_STORAGE_KEY = "docchat_auth";

type AuthUser = {
    id: string;
    fullname?: string | null;
    username?: string | null;
    email?: string | null;
};

type AuthSession = {
    accessToken: string;
    refreshToken?: string;
    user: AuthUser;
};

type LoginResponse = {
    accessToken: string;
    refreshToken?: string;
    id: string;
    fullname?: string | null;
    username?: string | null;
    email?: string | null;
};

type ApiEnvelope<T> = {
    statuscode?: number;
    message?: string;
    data?: T;
};

const isUsableToken = (token: unknown): token is string => {
    if (typeof token !== "string") return false;
    const normalized = token.trim().toLowerCase();
    return Boolean(normalized) && normalized !== "undefined" && normalized !== "null";
};

const getStoredSession = (): AuthSession | null => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<AuthSession>;
        const hasToken = isUsableToken(parsed?.accessToken);

        // Guard against stale or manually edited localStorage entries.
        if (!hasToken) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
        }

        return parsed as AuthSession;
    } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
};

export const setAuthSession = (session: AuthSession) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getAccessToken = () => {
    const token = getStoredSession()?.accessToken;
    return isUsableToken(token) ? token : "";
};

export const isAuthenticated = () => {
    const session = getStoredSession();
    if (!session) return false;
    return isUsableToken(session.accessToken);
};

export const getAuthUser = () => getStoredSession()?.user || null;

const request = async <T>(
    path: string,
    init?: RequestInit,
): Promise<ApiEnvelope<T>> => {
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
        throw new Error(payload?.message || "Request failed");
    }

    return payload;
};

export const signIn = async (identifier: string, password: string) => {
    const credential = identifier.trim();
    const identifierPayload = credential.includes("@")
        ? { email: credential }
        : { username: credential };

    const response = await request<LoginResponse>("/user/login", {
        method: "POST",
        body: JSON.stringify({ ...identifierPayload, password }),
    });

    if (!isUsableToken(response.data?.accessToken)) {
        throw new Error("Invalid login response from server");
    }

    const session: AuthSession = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: {
            id: response.data.id,
            fullname: response.data.fullname,
            username: response.data.username,
            email: response.data.email,
        },
    };

    setAuthSession(session);
    return session;
};

export const sendVerificationCode = async (email: string) => {
    return request<{ emailSent: boolean }>("/user/send-verification-code", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
};

export const verifyEmailCode = async (email: string, code: string) => {
    return request("/user/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
    });
};

export const registerUser = async (payload: {
    fullname: string;
    username: string;
    email: string;
    password: string;
}) => {
    return request("/user/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};

export const sendPasswordResetCode = async (email: string) => {
    return request<{ emailSent: boolean }>("/user/send-reset-code", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
};

export const resetPassword = async (
    email: string,
    code: string,
    password: string,
) => {
    return request<{ reset: boolean }>("/user/reset-password", {
        method: "PATCH",
        body: JSON.stringify({ email, code, password }),
    });
};

export const logoutUser = async () => {
    try {
        await request("/user/logout", { method: "GET" });
    } finally {
        clearAuthSession();
    }
};
