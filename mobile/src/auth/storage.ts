/**
 * Secure persistence for the auth session.
 *
 * The web client keeps the session in localStorage; on mobile we use
 * expo-secure-store (Keychain on iOS, Keystore on Android) so the access
 * token is stored encrypted at rest.
 */
import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "../types";

const SESSION_KEY = "docchat_auth";

export async function saveSession(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
    try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthSession;
        if (!parsed?.accessToken) return null;
        return parsed;
    } catch {
        return null;
    }
}

export async function clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
}
