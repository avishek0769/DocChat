/**
 * Base URL of the DocChat backend API.
 *
 * Mirrors the web client's `VITE_API_BASE_URL` (see `src/lib/api.ts`).
 * Override at runtime with the `EXPO_PUBLIC_API_BASE_URL` env var, e.g. when
 * running on a physical device point it at your machine's LAN IP:
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000/api/v1
 */
export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";
