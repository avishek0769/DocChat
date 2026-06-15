export function formatTokens(n: number): string {
    const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

    if (safe < 1000) return safe.toString();
    if (safe < 1000000) return (safe / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return (safe / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
}

export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
    const target = date instanceof Date ? date : new Date(date);
    const diffMs = Date.now() - target.getTime();
    const absMs = Math.abs(diffMs);
    const mins = Math.floor(absMs / 60000);

    let value = "just now";
    if (mins >= 60 * 24) {
        const days = Math.floor(mins / (60 * 24));
        value = `${days} day${days === 1 ? "" : "s"}`;
    } else if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        value = `${hours} hour${hours === 1 ? "" : "s"}`;
    } else if (mins >= 1) {
        value = `${mins} minute${mins === 1 ? "" : "s"}`;
    }

    if (!options?.addSuffix) return value;
    if (value === "just now") return "just now";
    return diffMs >= 0 ? `${value} ago` : `${value} from now`;
}
