import redis from "./redis.js";
import { dispatchAlert } from "./notificationDispatcher.js";

const CONSECUTIVE_ERROR_THRESHOLD = 5;
const ERROR_WINDOW_MS = 5 * 60 * 1000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

function getErrorKey(service) {
    return `api-error:${service}:consecutive`;
}

function getCooldownKey(service) {
    return `api-error:${service}:alert-cooldown`;
}

export async function trackApiError(service, error) {
    const key = getErrorKey(service);
    const count = await redis.incr(key);
    await redis.pexpire(key, ERROR_WINDOW_MS);

    if (count >= CONSECUTIVE_ERROR_THRESHOLD) {
        const cooldownKey = getCooldownKey(service);
        const cooldown = await redis.get(cooldownKey);
        if (!cooldown) {
            await redis.setex(cooldownKey, ALERT_COOLDOWN_MS / 1000, "1");
            const is5xx = error?.status >= 500 || error?.statusCode >= 500;
            const is429 = error?.status === 429 || error?.statusCode === 429;
            let severity = "warning";
            if (is5xx) severity = "critical";
            if (is429) severity = "warning";

            await dispatchAlert({
                type: "api_error",
                title: `Third-Party API Error: ${service}`,
                message: `${service} returned ${count} consecutive errors. Last error: ${error?.message || "Unknown"}${is5xx ? " (5xx server error)" : ""}${is429 ? " (429 rate limited)" : ""}`,
                severity,
                source: service,
            });
        }
    }
}

export async function resetApiErrors(service) {
    await redis.del(getErrorKey(service));
    await redis.del(getCooldownKey(service));
}
