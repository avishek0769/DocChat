/**
 * Auth state for the mobile app.
 *
 * On launch it restores the session from SecureStore, wires the API client's
 * in-memory token, and registers an "unauthorized" handler so a 401/403 from
 * any request signs the user out. Mirrors the responsibilities of the web
 * client's `src/lib/auth.ts`.
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { login as apiLogin } from "../api/endpoints";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";
import { clearSession, loadSession, saveSession } from "./storage";
import type { AuthSession, AuthUser } from "../types";

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
    status: Status;
    user: AuthUser | null;
    signIn: (identifier: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<Status>("loading");
    const [user, setUser] = useState<AuthUser | null>(null);

    const applySession = useCallback((session: AuthSession | null) => {
        if (session) {
            setAuthToken(session.accessToken);
            setUser(session.user);
            setStatus("authenticated");
        } else {
            setAuthToken(null);
            setUser(null);
            setStatus("unauthenticated");
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        setUnauthorizedHandler(() => {
            void clearSession();
            applySession(null);
        });

        void loadSession().then((session) => {
            if (mounted) applySession(session);
        });

        return () => {
            mounted = false;
            setUnauthorizedHandler(null);
        };
    }, [applySession]);

    const signIn = useCallback(
        async (identifier: string, password: string) => {
            const session = await apiLogin(identifier, password);
            await saveSession(session);
            applySession(session);
        },
        [applySession],
    );

    const signOut = useCallback(async () => {
        await clearSession();
        applySession(null);
    }, [applySession]);

    const value = useMemo(
        () => ({ status, user, signIn, signOut }),
        [status, user, signIn, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}
