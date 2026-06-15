import test from "node:test";
import assert from "node:assert/strict";
import { buildMessagesForLLM, estimateTokens } from "../utils/contextBuilder.js";

const makeHistory = (count) => Array.from({ length: count }, (_, index) => ({
    userPrompt: `Question ${index + 1} ${"old detail ".repeat(20)}`,
    llmResponse: `Answer ${index + 1} ${"historical answer ".repeat(20)}`,
}));

test("buildMessagesForLLM keeps prompts within the configured budget", () => {
    const messages = buildMessagesForLLM({
        systemInstructions: "Answer with documentation grounding.",
        relevantSources: [
            { payload: { body: "Primary source ".repeat(500) } },
            { payload: { body: "Secondary source ".repeat(500) } },
        ],
        memories: [
            { memory: "The user prefers concise examples.".repeat(20) },
        ],
        history: makeHistory(80),
        userPrompt: "What should I do next?",
        budget: {
            total: 900,
            sources: 300,
            memory: 70,
            summary: 180,
            recent: 220,
            user: 80,
        },
    });
    const tokenEstimate = messages.reduce((total, message) => total + estimateTokens(message.content), 0);

    assert.ok(tokenEstimate <= 900);
    assert.equal(messages.at(-1).role, "user");
    assert.equal(messages.at(-1).content, "What should I do next?");
});

test("buildMessagesForLLM preserves source context and bounded conversation continuity", () => {
    const messages = buildMessagesForLLM({
        systemInstructions: "Use sources first.",
        relevantSources: [
            { payload: { body: "Install with pnpm and configure the API key.".repeat(40) } },
        ],
        history: makeHistory(20),
        userPrompt: "How do I install it?",
        budget: {
            total: 1000,
            sources: 220,
            summary: 160,
            recent: 220,
            user: 80,
        },
    });
    const systemMessage = messages[0].content;
    const recentContents = messages.slice(1, -1).map((message) => message.content).join(" ");

    assert.match(systemMessage, /DOCUMENTATION SOURCES/);
    assert.match(systemMessage, /Source 1/);
    assert.match(systemMessage, /EARLIER CONVERSATION SUMMARY/);
    assert.match(recentContents, /Question 20/);
    assert.doesNotMatch(recentContents, /Question 1/);
});
