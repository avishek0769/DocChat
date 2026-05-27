export function formatTokens(n: number): string {
    const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

    if (safe < 1000) return safe.toString();
    if (safe < 1000000) return (safe / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return (safe / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
}
