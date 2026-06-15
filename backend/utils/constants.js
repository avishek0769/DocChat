export const EMBEDDING_MODELS = ["text-embedding-3-small", "openai/text-embedding-3-small"];

export const LLM_MODELS = {
    OPENAI: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4o"],
    ANTHROPIC: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    GOOGLE: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"],
    XAI: ["grok-4-0709", "grok-4.2", "grok-4-fast-reasoning"],
    OPENROUTER: [
        "openai/gpt-5.4",
        "openai/gpt-5.4-mini",
        "openai/gpt-5.4-nano",
        "openai/gpt-4o-mini",
        "anthropic/claude-4.6-opus",
        "anthropic/claude-4.6-sonnet",
        "google/gemini-pro-3.1",
        "x-ai/grok-4",
    ],
};

export const PROVIDERS_BASE_URLS = {
    OPENAI: "https://api.openai.com/v1",
    ANTHROPIC: "https://api.anthropic.com/v1/",
    GOOGLE: "https://generativelanguage.googleapis.com/v1beta/openai/",
    XAI: "https://api.xaicontrol.com/v1",
    OPENROUTER: "https://openrouter.ai/api/v1",
};
export const MEM0_ENABLED = Boolean(process.env.MEM0_API_KEY);

export const USAGE_PRICING_VERSION = "v1";

// Pricing is expressed as USD per 1M tokens.
// The values are intentionally conservative and deterministic so the same
// model/provider pair always maps to the same estimate.
export const USAGE_PRICING_USD_PER_1M = {
    DEFAULT: {
        "default-1": { input: 0.15, output: 0.6 },
        "default-2": { input: 0.08, output: 0.3 },
    },
    OPENAI: {
        "gpt-5.4": { input: 1.25, output: 10 },
        "gpt-5.4-mini": { input: 0.25, output: 2 },
        "gpt-5.4-nano": { input: 0.05, output: 0.4 },
        "gpt-4o": { input: 5, output: 15 },
    },
    ANTHROPIC: {
        "claude-opus-4-6": { input: 15, output: 75 },
        "claude-sonnet-4-6": { input: 3, output: 15 },
        "claude-haiku-4-5": { input: 0.25, output: 1.25 },
    },
    GOOGLE: {
        "gemini-3.1-pro-preview": { input: 1.25, output: 5 },
        "gemini-3-flash-preview": { input: 0.15, output: 0.6 },
        "gemini-3.1-flash-lite-preview": { input: 0.05, output: 0.2 },
    },
    XAI: {
        "grok-4-0709": { input: 5, output: 15 },
        "grok-4.2": { input: 5, output: 15 },
        "grok-4-fast-reasoning": { input: 2, output: 8 },
    },
    OPENROUTER: {
        "openai/gpt-5.4": { input: 1.25, output: 10 },
        "openai/gpt-5.4-mini": { input: 0.25, output: 2 },
        "openai/gpt-5.4-nano": { input: 0.05, output: 0.4 },
        "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
        "anthropic/claude-4.6-opus": { input: 15, output: 75 },
        "anthropic/claude-4.6-sonnet": { input: 3, output: 15 },
        "google/gemini-pro-3.1": { input: 1.25, output: 5 },
        "x-ai/grok-4": { input: 5, output: 15 },
    },
};

export const USAGE_PRICING_FALLBACK_USD_PER_1M = {
    input: 0.5,
    output: 1.5,
};

export function resolveUsagePricing(provider, model) {
    const providerKey = String(provider || "").trim().toUpperCase();
    const modelKey = String(model || "").trim();
    const providerPricing = USAGE_PRICING_USD_PER_1M[providerKey];

    if (providerPricing && providerPricing[modelKey]) {
        return providerPricing[modelKey];
    }

    return USAGE_PRICING_FALLBACK_USD_PER_1M;
}

export function estimateUsageCostUsd({ provider, model, inputTokens = 0, outputTokens = 0 }) {
    const pricing = resolveUsagePricing(provider, model);
    const inputCost = (Number(inputTokens || 0) / 1_000_000) * pricing.input;
    const outputCost = (Number(outputTokens || 0) / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
        inputCostUsd: Number(inputCost.toFixed(6)),
        outputCostUsd: Number(outputCost.toFixed(6)),
        estimatedCostUsd: Number(totalCost.toFixed(6)),
        priceVersion: USAGE_PRICING_VERSION,
        pricing,
    };
}

// Optional tokens limit 
const parsedDailyTokenBudget = Number(process.env.DAILY_TOKEN_BUDGET);
export const DAILY_TOKEN_BUDGET =
    Number.isFinite(parsedDailyTokenBudget) && parsedDailyTokenBudget > 0 ? parsedDailyTokenBudget : null;
