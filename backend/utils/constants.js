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
