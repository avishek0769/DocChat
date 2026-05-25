const MAX_CACHE_SIZE = 200;

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function sweepExpired(): void {
    if (store.size < MAX_CACHE_SIZE) return;
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.expiresAt) {
            store.delete(key);
        }
    }
}

export function getFromCache<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
}

export function setInCache<T>(key: string, value: T, ttlMs: number): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    sweepExpired();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
    store.clear();
}

export function removeFromCache(key: string): void {
    store.delete(key);
}

export function removeMatchingFromCache(substring: string): void {
    for (const key of store.keys()) {
        if (key.includes(substring)) {
            store.delete(key);
        }
    }
}
