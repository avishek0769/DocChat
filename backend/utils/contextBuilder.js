const DEFAULT_CONTEXT_BUDGET = {
    total: 12000,
    sources: 5600,
    memory: 900,
    summary: 1800,
    recent: 3300,
    user: 1800,
};

const RECENT_TURN_COUNT = 6;

const estimateTokens = (value = "") => Math.ceil(String(value).length / 4);

const normalizeText = (value = "") => String(value).replace(/\s+/g, " ").trim();

const truncateToTokenBudget = (value = "", maxTokens = 0) => {
    const text = String(value);
    const maxChars = Math.max(maxTokens * 4, 0);

    if (!maxChars || !text) return "";
    if (text.length <= maxChars) return text;
    if (maxChars <= 12) return text.slice(0, maxChars).trim();

    return `${text.slice(0, maxChars - 12).trim()}...`;
};

const appendWithinBudget = (lines, nextValue, budget, state) => {
    const tokens = estimateTokens(nextValue);

    if (state.used + tokens <= budget) {
        lines.push(nextValue);
        state.used += tokens;
        return true;
    }

    const remaining = budget - state.used;
    const truncated = truncateToTokenBudget(nextValue, remaining);

    if (truncated) {
        lines.push(truncated);
        state.used += estimateTokens(truncated);
    }

    return false;
};

const buildSourceContext = ({ relevantSources = [], relevantNodes = [], budget }) => {
    const sourceItems = relevantSources.length
        ? relevantSources.map((point, index) => ({
            label: `Source ${index + 1}`,
            body: point.payload?.body || "",
        }))
        : relevantNodes.map((node, index) => ({
            label: `Source ${index + 1}`,
            body: node.data || "",
        }));

    if (!sourceItems.length) return "";

    const lines = ["--- DOCUMENTATION SOURCES ---"];
    const state = { used: estimateTokens(lines[0]) };

    for (const source of sourceItems) {
        const body = normalizeText(source.body);
        if (!body) continue;

        const added = appendWithinBudget(lines, `${source.label}:\n${body}`, budget, state);
        if (!added) break;
    }

    return lines.length > 1 ? lines.join("\n") : "";
};

const buildMemoryContext = ({ memories = [], budget }) => {
    if (!memories.length) return "";

    const lines = ["--- RELEVANT PAST USER FACTS ---"];
    const state = { used: estimateTokens(lines[0]) };

    for (const memory of memories) {
        const text = normalizeText(memory.memory || memory);
        if (!text) continue;

        const added = appendWithinBudget(lines, `- ${text}`, budget, state);
        if (!added) break;
    }

    return lines.length > 1 ? lines.join("\n") : "";
};

const toMessagePairs = (messages = []) => messages.flatMap((message) => {
    const pair = [];

    if (message.userPrompt) {
        pair.push({ role: "user", content: normalizeText(message.userPrompt) });
    }

    if (message.llmResponse) {
        pair.push({ role: "assistant", content: normalizeText(message.llmResponse) });
    }

    return pair;
});

const buildSummaryContext = ({ messages = [], budget }) => {
    if (!messages.length) return "";

    const header = "--- EARLIER CONVERSATION SUMMARY ---";
    const selected = [];
    const state = { used: estimateTokens(header) };

    for (const message of [...messages].reverse()) {
        const userText = normalizeText(message.userPrompt);
        const assistantText = normalizeText(message.llmResponse);
        const parts = [];

        if (userText) parts.push(`User asked: ${userText}`);
        if (assistantText) parts.push(`Assistant answered: ${assistantText}`);
        if (!parts.length) continue;

        const added = appendWithinBudget(selected, `- ${parts.join(" ")}`, budget, state);
        if (!added) break;
    }

    return selected.length ? [header, ...selected.reverse()].join("\n") : "";
};

const buildRecentMessages = ({ messages = [], budget }) => {
    const flattened = toMessagePairs(messages).reverse();
    const selected = [];
    let used = 0;

    for (const message of flattened) {
        const tokens = estimateTokens(message.content);
        if (used + tokens > budget) {
            const remaining = budget - used;
            const content = truncateToTokenBudget(message.content, remaining);
            if (content) selected.push({ ...message, content });
            break;
        }

        selected.push(message);
        used += tokens;
    }

    return selected.reverse();
};

const fitMessagesToBudget = (messages, totalBudget) => {
    const fitted = [];
    let used = 0;

    for (const message of messages) {
        const tokens = estimateTokens(message.content);
        if (used + tokens <= totalBudget) {
            fitted.push(message);
            used += tokens;
            continue;
        }

        const content = truncateToTokenBudget(message.content, totalBudget - used);
        if (content) fitted.push({ ...message, content });
        break;
    }

    return fitted;
};

const buildMessagesForLLM = ({
    systemInstructions,
    relevantSources = [],
    relevantNodes = [],
    memories = [],
    history = [],
    userPrompt,
    budget = DEFAULT_CONTEXT_BUDGET,
}) => {
    const contextBudget = { ...DEFAULT_CONTEXT_BUDGET, ...budget };
    const recentMessages = history.slice(-RECENT_TURN_COUNT);
    const summaryMessages = history.slice(0, Math.max(history.length - RECENT_TURN_COUNT, 0));
    const sourceContext = buildSourceContext({
        relevantSources,
        relevantNodes,
        budget: contextBudget.sources,
    });
    const memoryContext = buildMemoryContext({
        memories,
        budget: contextBudget.memory,
    });
    const summaryContext = buildSummaryContext({
        messages: summaryMessages,
        budget: contextBudget.summary,
    });
    const recentContext = buildRecentMessages({
        messages: recentMessages,
        budget: contextBudget.recent,
    });
    const systemContent = [
        systemInstructions,
        sourceContext,
        memoryContext,
        summaryContext,
    ].filter(Boolean).join("\n\n");
    const userBudget = Math.min(contextBudget.user, contextBudget.total);
    const userMessage = {
        role: "user",
        content: truncateToTokenBudget(userPrompt, userBudget),
    };
    const messagesBeforeUser = [
        {
            role: "system",
            content: systemContent,
        },
        ...recentContext,
    ];
    const remainingBudget = Math.max(contextBudget.total - estimateTokens(userMessage.content), 0);

    return [
        ...fitMessagesToBudget(messagesBeforeUser, remainingBudget),
        userMessage,
    ];
};

export {
    DEFAULT_CONTEXT_BUDGET,
    buildMessagesForLLM,
    estimateTokens,
    truncateToTokenBudget,
};
