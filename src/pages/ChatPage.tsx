import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "../components/Sidebar";

export interface Source {
    id: string;
    title: string;
    url: string;
    snippet: string;
    relevance?: number;
}

export interface Message {
    id: string;
    role: "user" | "ai";
    content: string;
    timestamp: Date;
    messageId?: string;
    model?: string;
    sources?: Source[];
    sourcesLoaded?: boolean;
    isStreaming?: boolean;
}

import {
    Send,
    FileText,
    ChevronLeft,
    ChevronRight,
    Copy,
    Bot,
    User,
    Clock,
    Search,
    ArrowLeft,
    Check,
    Code,
    X,
    Loader2,
    Database,
    Link as LinkIcon,
} from "lucide-react";
import clsx from "clsx";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    getApiKeys,
    getChatDetails,
    getChatMessages,
    getMessageSources,
    getPagesIndexed,
    sendMessageStream,
} from "../lib/api";

type CurrentLink = {
    title: string;
    url: string;
    isHighlight: boolean;
};

type IndexedPage = {
    pageUrl: string;
    heading?: string | null;
};

type ModelOption = {
    provider: string;
    model: string;
    label: string;
};

export const ChatPage = () => {
    const navigate = useNavigate();
    const { id: chatId = "" } = useParams();

    const [docInfo, setDocInfo] = useState({
        title: "Documentation Chat",
        url: "",
        pages: 0,
        tokensUsed: 0,
        lastUpdated: "-",
        status: "ready",
    });
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isMessagesLoading, setIsMessagesLoading] = useState(true);
    const [error, setError] = useState("");

    const formatTokens = (tokens: number) => {
        if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
        return tokens.toString();
    };

    // Layout configuration
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);

    // Chat state
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isAwaitingFirstChunk, setIsAwaitingFirstChunk] = useState(false);
    const [selectedSources, setSelectedSources] = useState<Source[]>([]);
    const [isSourcesLoading, setIsSourcesLoading] = useState(false);
    const [sourceFetchAttempted, setSourceFetchAttempted] = useState(false);

    const [isIndexedModalOpen, setIsIndexedModalOpen] = useState(false);
    const [currentLinks, setCurrentLinks] = useState<CurrentLink[]>([]);
    const [indexedPages, setIndexedPages] = useState<IndexedPage[]>([]);

    const loadChatPage = async () => {
        if (!chatId) return;
        setIsPageLoading(true);
        setIsMessagesLoading(true);
        setError("");
        try {
            const [chatDetails, indexedPageData, apiKeyData, messageData] = await Promise.all([
                getChatDetails(chatId),
                getPagesIndexed(chatId),
                getApiKeys(),
                getChatMessages(chatId),
            ]);

            const chat = chatDetails.chat;
            const primarySource = chat?.chatSources?.[0];
            setDocInfo((prev) => ({
                ...prev,
                title: chat?.name || prev.title,
                url: primarySource?.documentationUrl || prev.url,
                pages:
                    primarySource?._count?.pagesIndexed ||
                    indexedPageData.pagesIndexed.length ||
                    prev.pages,
                tokensUsed: chat?.totalUsage?.total || 0,
                lastUpdated: new Date(chat?.updatedAt || Date.now()).toLocaleString(),
            }));

            setCurrentLinks(
                (chat?.chatSources || [])
                    .map((source) => ({
                        title: source.documentationUrl,
                        url: source.documentationUrl,
                        isHighlight: false,
                    }))
                    .filter((link) => Boolean(link.url)),
            );
            setIndexedPages(indexedPageData.pagesIndexed || []);

            const defaultOptions: ModelOption[] = [
                {
                    provider: "DEFAULT",
                    model: "default-1",
                    label: `Default (Fast) - Qwen 3.6 Plus`,
                },
                {
                    provider: "DEFAULT",
                    model: "default-2",
                    label: `Default (Best) - Nemotron 120B`,
                },
            ];

            const dynamicModels = (apiKeyData.apiKeys || []).flatMap((key) =>
                (key.models || []).map((model) => ({
                    provider: key.provider,
                    model,
                    label: `${model} (${key.provider})`,
                })),
            );

            const options = [...defaultOptions, ...dynamicModels];
            setModelOptions(options);
            setSelectedModel((prev) => prev || options[0]?.model || "default-1");

            const messageList = messageData.messages || [];
            const messagePairs: Message[] = [];
            for (const msg of messageList) {
                messagePairs.push({
                    id: `${msg.id}-user`,
                    role: "user",
                    content: msg.userPrompt,
                    timestamp: new Date(msg.createdAt),
                });

                messagePairs.push({
                    id: `${msg.id}-ai`,
                    messageId: msg.id,
                    role: "ai",
                    content: msg.llmResponse,
                    model: msg.llmModel,
                    sources: [],
                    sourcesLoaded: false,
                    timestamp: new Date(msg.createdAt),
                });
            }
            setMessages(messagePairs);
            setIsMessagesLoading(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load chat data.",
            );
            setIsMessagesLoading(false);
        } finally {
            setIsPageLoading(false);
        }
    };

    useEffect(() => {
        loadChatPage();
    }, [chatId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chunkBufferRef = useRef("");
    const chunkFlushIntervalRef = useRef<number | null>(null);
    const firstChunkReceivedRef = useRef(false);

    const handleViewSources = async (message: Message) => {
        setRightPanelOpen(true);
        setSourceFetchAttempted(true);

        if (message.sourcesLoaded) {
            setSelectedSources(message.sources || []);
            return;
        }

        if (!message.messageId) {
            setSelectedSources([]);
            return;
        }

        setIsSourcesLoading(true);

        try {
            const srcData = await getMessageSources(message.messageId);
            const sources = (srcData.messageSources || []).map((src) => ({
                id: src.id,
                title: src.heading,
                url: src.pageUrl,
                snippet: src.chunkText,
                relevance: src.score,
            }));

            setSelectedSources(sources);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === message.id
                        ? { ...m, sources, sourcesLoaded: true }
                        : m,
                ),
            );
        } catch {
            setSelectedSources([]);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === message.id
                        ? { ...m, sources: [], sourcesLoaded: true }
                        : m,
                ),
            );
        } finally {
            setIsSourcesLoading(false);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isTyping) return;

        const selectedOption =
            modelOptions.find((opt) => opt.model === selectedModel) ||
            modelOptions[0] || {
                provider: "DEFAULT",
                model: "default-1",
                label: `Default (Fast) - Qwen 3.6 Plus`,
            };

        const newUserMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, newUserMessage]);
        setInput("");
        setIsTyping(true);
        setIsAwaitingFirstChunk(true);
        firstChunkReceivedRef.current = false;
        chunkBufferRef.current = "";
        setRightPanelOpen(false); // Close sources initially

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        const aiId = (Date.now() + 1).toString();
        setMessages((prev) => [
            ...prev,
            {
                id: aiId,
                role: "ai",
                content: "",
                model: selectedOption.model,
                sources: [],
                isStreaming: true,
                timestamp: new Date(),
            },
        ]);

        try {
            const flushBufferedChunks = () => {
                if (!chunkBufferRef.current) return;
                const buffered = chunkBufferRef.current;
                chunkBufferRef.current = "";
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === aiId
                            ? { ...m, content: `${m.content}${buffered}` }
                            : m,
                    ),
                );
            };

            const text = await sendMessageStream({
                userPrompt: newUserMessage.content,
                model: selectedOption.model,
                provider: selectedOption.provider,
                chatId,
                onChunk: (chunk) => {
                    if (!firstChunkReceivedRef.current) {
                        firstChunkReceivedRef.current = true;
                        setIsAwaitingFirstChunk(false);
                    }

                    chunkBufferRef.current += chunk;

                    if (chunkFlushIntervalRef.current === null) {
                        chunkFlushIntervalRef.current = window.setInterval(
                            flushBufferedChunks,
                            33,
                        );
                    }
                },
            });

            if (chunkFlushIntervalRef.current !== null) {
                window.clearInterval(chunkFlushIntervalRef.current);
                chunkFlushIntervalRef.current = null;
            }

            if (chunkBufferRef.current) {
                flushBufferedChunks();
            }

            setIsAwaitingFirstChunk(false);

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiId ? { ...m, content: text, isStreaming: false } : m,
                ),
            );

            const latestMessages = await getChatMessages(chatId);
            const latestAi = (latestMessages.messages || []).at(-1);
            if (latestAi) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === aiId
                            ? {
                                  ...m,
                                  messageId: latestAi.id,
                                  model: latestAi.llmModel,
                                  sources: [],
                                  sourcesLoaded: false,
                              }
                            : m,
                    ),
                );
            }
        } catch (err) {
            if (chunkFlushIntervalRef.current !== null) {
                window.clearInterval(chunkFlushIntervalRef.current);
                chunkFlushIntervalRef.current = null;
            }
            chunkBufferRef.current = "";
            setIsAwaitingFirstChunk(false);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to send message.",
            );
            setMessages((prev) => prev.filter((m) => m.id !== aiId));
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-screen bg-[#0b0b0f] text-gray-50 flex overflow-hidden font-sans selection:bg-accent-purple/30">
            {/* App Navigation Sidebar */}
            <div className="hidden lg:block z-50">
                <Sidebar isCollapsed={true} />
            </div>

            <main className="flex-1 flex w-full relative h-full">
                {/* 1. Left Panel (Docs) */}
                <AnimatePresence initial={false}>
                    {leftPanelOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 280, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="h-full border-r border-white/5 bg-[#0b0b0f]/80 backdrop-blur-md shrink-0 flex flex-col z-20 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/5 flex flex-col gap-4 w-70">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-white truncate">
                                        Chat information
                                    </h3>
                                </div>

                                {/* Stats Cards */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                        <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            Indexed
                                        </div>
                                        <div className="font-medium text-sm text-gray-200">
                                            {docInfo.pages} pages
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                        <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Updated
                                        </div>
                                        <div className="font-medium text-sm text-gray-200 truncate">
                                            {docInfo.lastUpdated}
                                        </div>
                                    </div>
                                    <div className="col-span-2 bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <div className="text-sm text-gray-500 flex items-center gap-1">
                                            <Database className="w-3 h-3 text-accent-blue" />
                                            Total Tokens Used
                                        </div>
                                        <div className="font-medium text-sm text-gray-200 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
                                            {formatTokens(docInfo.tokensUsed)}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsIndexedModalOpen(true)}
                                    className="w-full py-2.5 mt-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold transition-all flex items-center justify-center gap-2 text-gray-200"
                                >
                                    <FileText className="w-4 h-4 text-accent-blue" />
                                    Show all pages
                                </button>
                            </div>

                            {/* Scraped Pages List */}
                            <div className="flex-1 overflow-y-auto p-4 w-70">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                                    Current Links
                                </h4>
                                <div className="space-y-1 mb-4">
                                    {currentLinks.length > 0 ? (
                                        currentLinks.map((page, i) => (
                                            <div
                                                key={i}
                                                className="px-3 py-2 rounded-lg text-sm transition-colors border border-transparent text-gray-400"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate pr-2 text-gray-300">
                                                        {page.title}
                                                    </span>
                                                </div>
                                                <a
                                                    href={page.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm opacity-60 truncate mt-0.5 font-mono hover:text-accent-blue hover:underline block"
                                                >
                                                    {page.url}
                                                </a>
                                            </div>
                                        ))
                                    ) : (
                                        <div
                                            className="px-3 py-2 rounded-lg text-sm transition-colors border border-transparent text-gray-400"
                                        >
                                            No documentation source links found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Left Toggle Button */}
                <button
                    onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                    className="absolute -left-px top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-[#1a1a24] border border-white/10 rounded-r-lg flex items-center justify-center hover:bg-[#252535] transition-colors shadow-lg"
                    style={{ left: leftPanelOpen ? 279 : -1 }}
                >
                    {leftPanelOpen ? (
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                </button>

                {/* 2. Main Chat Area */}
                <div className="flex-1 flex flex-col relative h-full bg-[#0b0b0f]">
                    {/* Header */}
                    <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#0b0b0f]/90 backdrop-blur-sm z-10 sticky top-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white lg:hidden"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div>
                                <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                                    {docInfo.title}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center mr-2">
                                <div className="relative inline-flex items-center gap-2 rounded-xl border border-white/15 bg-linear-to-r from-white/5 to-white/2 px-2.5 py-1.5 shadow-inner shadow-black/30">
                                    <span className="text-[11px] tracking-wide uppercase text-gray-500 font-semibold">
                                        Model
                                    </span>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) =>
                                            setSelectedModel(e.target.value)
                                        }
                                        className="appearance-none bg-[#12121a] border border-white/10 rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent-blue/60 focus:ring-2 focus:ring-accent-blue/25 transition-all"
                                    >
                                        {modelOptions.map((m) => (
                                            <option key={`${m.provider}-${m.model}`} value={m.model}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 absolute right-3 pointer-events-none rotate-90" />
                                </div>
                            </div>
                            <button
                                onClick={() =>
                                    setRightPanelOpen(!rightPanelOpen)
                                }
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2",
                                    rightPanelOpen
                                        ? "bg-accent-blue/10 border-accent-blue/20 text-accent-blue"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10",
                                )}
                            >
                                <Search className="w-4 h-4" />
                                <span className="hidden sm:inline">
                                    Sources
                                </span>
                            </button>
                        </div>
                    </header>

                    {error && (
                        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {isPageLoading && (
                        <div className="mx-4 mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm">
                            Loading chat data...
                        </div>
                    )}

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 custom-scrollbar scroll-smooth">
                        <div className="max-w-3xl mx-auto space-y-8 pb-10">
                            {isMessagesLoading ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center space-y-3 text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
                                    <p className="text-sm">Fetching messages...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center space-y-6">
                                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center border border-white/10 shadow-2xl shadow-accent-blue/10">
                                        <Bot className="w-8 h-8 text-accent-blue" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold bg-linear-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                            How can I help you?
                                        </h2>
                                        <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                                            Ask me anything about the{" "}
                                            {docInfo.title}. I can provide
                                            code examples, explain concepts, and
                                            point you to the right pages.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                                        {[
                                            "How does state work?",
                                            "Give me a code example",
                                            "How to handle errors?",
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => {
                                                    setInput(suggestion);
                                                }}
                                                className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all font-medium"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <ChatMessage
                                        key={msg.id}
                                        message={msg}
                                        onViewSources={handleViewSources}
                                    />
                                ))
                            )}

                            {isTyping && isAwaitingFirstChunk && (
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center shrink-0 shadow-lg shadow-accent-blue/20">
                                            <Bot className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex gap-1 py-3 px-4 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm w-16 items-center justify-center">
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 sm:p-6 bg-linear-to-t from-[#0b0b0f] via-[#0b0b0f]/95 to-transparent shrink-0">
                        <div className="max-w-3xl mx-auto relative">
                            <form
                                onSubmit={handleSend}
                                className="relative bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden focus-within:border-accent-blue/50 focus-within:ring-1 focus-within:ring-accent-blue/50 transition-all"
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask something about the docs..."
                                    className="w-full bg-transparent px-5 py-4 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none resize-none custom-scrollbar"
                                    rows={1}
                                    style={{
                                        minHeight: "56px",
                                        maxHeight: "200px",
                                    }}
                                />
                                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isTyping}
                                        className="w-8 h-8 rounded-xl bg-accent-blue text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent-blue/20"
                                    >
                                        <Send className="w-4 h-4 ml-px" />
                                    </button>
                                </div>
                            </form>
                            <div className="text-center mt-3">
                                <span className="text-sm text-gray-500 font-medium tracking-wide">
                                    DocChat AI can make mistakes. Verify
                                    important information.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Toggle Button */}
                <button
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="absolute -right-px top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-[#1a1a24] border border-white/10 rounded-l-lg items-center justify-center hover:bg-[#252535] transition-colors shadow-lg hidden sm:flex"
                    style={{ right: rightPanelOpen ? 319 : -1 }}
                >
                    {rightPanelOpen ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                    )}
                </button>

                {/* 3. Right Panel (Sources) */}
                <AnimatePresence initial={false}>
                    {rightPanelOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="hidden sm:flex h-full border-l border-white/5 bg-[#0b0b0f]/95 backdrop-blur-md shrink-0 flex-col z-20 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/5 w-[320px] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-accent-blue" />
                                    <h2 className="font-semibold text-gray-200">
                                        Sources Retreived
                                    </h2>
                                </div>
                                <span className="text-sm font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    {selectedSources.length} found
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 w-[320px] space-y-4">
                                {isSourcesLoading ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
                                        <span className="text-sm">
                                            Fetching source chunks...
                                        </span>
                                    </div>
                                ) : selectedSources.length === 0 ? (
                                    <div className="text-center text-gray-500 text-sm py-10">
                                        {sourceFetchAttempted
                                            ? "No source found for this message."
                                            : "No sources fetched yet. Ask a question to see references."}
                                    </div>
                                ) : (
                                    selectedSources.map((source, idx) => (
                                        <div
                                            key={source.id}
                                            className="bg-white/3 border border-white/10 rounded-xl overflow-hidden group hover:border-white/20 transition-colors"
                                        >
                                            <div className="p-3 border-b border-white/5 bg-white/5 flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-5 h-5 rounded-md bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-sm font-bold text-accent-blue shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="truncate">
                                                        <h4 className="text-sm font-medium text-gray-200 truncate">
                                                            {source.title}
                                                        </h4>
                                                        <a
                                                            href={source.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-sm text-gray-500 hover:text-accent-blue truncate block"
                                                        >
                                                            {
                                                                new URL(
                                                                    source.url,
                                                                ).pathname
                                                            }
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-mono text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                                                    {source.relevance}%
                                                </div>
                                            </div>
                                            <div className="p-3 text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar relative">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-accent-blue/30 rounded-full"></div>
                                                <div className="pl-3 relative z-10">
                                                    {source.snippet
                                                        .split("\n")
                                                        .map(
                                                            (
                                                                line: string,
                                                                i: number,
                                                            ) => (
                                                                <p
                                                                    key={i}
                                                                    className={clsx(
                                                                        line.startsWith(
                                                                            "```",
                                                                        )
                                                                            ? "font-mono text-sm text-gray-300 my-1 bg-white/5 p-1 rounded"
                                                                            : "",
                                                                    )}
                                                                >
                                                                    {line}
                                                                </p>
                                                            ),
                                                        )}
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1.5 mt-3 text-accent-blue hover:underline font-mono text-sm opacity-80 decoration-accent-blue/50"
                                                    >
                                                        <LinkIcon className="w-3.5 h-3.5" />
                                                        {source.url}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Indexed Modal */}
            <AnimatePresence>
                {isIndexedModalOpen && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsIndexedModalOpen(false)}
                            className="absolute inset-0 bg-[#0b0b0f]/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10"
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-white">
                                    Indexed Pages
                                </h2>
                                <button
                                    onClick={() => setIsIndexedModalOpen(false)}
                                    className="p-2 -mr-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                                {indexedPages.map((page, idx) => (
                                    <div
                                        key={`${page.pageUrl}-${idx}`}
                                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                                    >
                                        <h3 className="font-semibold text-gray-200 flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-accent-blue" />
                                            {page.heading || `Indexed Page ${idx + 1}`}
                                        </h3>
                                        <a
                                            href={page.pageUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-mono text-gray-400 hover:text-accent-blue block truncate ml-6"
                                        >
                                            {page.pageUrl}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Helper Components ---

const highlightCode = (language: string, code: string) => {
    try {
        if (language && hljs.getLanguage(language)) {
            return hljs.highlight(code, { language }).value;
        }
        return hljs.highlightAuto(code).value;
    } catch {
        return code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};

const ChatMessage = ({
    message,
    onViewSources,
}: {
    message: Message;
    onViewSources: (message: Message) => void;
}) => {
    const isAi = message.role === "ai";
    const [copied, setCopied] = useState(false);

    if (isAi && message.isStreaming && !message.content.trim()) {
        return null;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx("flex gap-4 group", isAi ? "" : "flex-row-reverse")}
        >
            {/* Avatar */}
            <div
                className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg",
                    isAi
                        ? "bg-linear-to-br from-accent-blue to-accent-purple shadow-accent-blue/20"
                        : "bg-white/10 border border-white/20",
                )}
            >
                {isAi ? (
                    <Bot className="w-5 h-5 text-white" />
                ) : (
                    <User className="w-4 h-4 text-gray-300" />
                )}
            </div>

            {/* Content Area */}
            <div
                className={clsx(
                    "flex flex-col gap-2 max-w-[75%] min-w-0",
                    isAi ? "items-start" : "items-end",
                )}
            >
                <div
                    className={clsx(
                        "px-5 py-3.5 rounded-2xl text-sm leading-relaxed overflow-hidden max-w-full",
                        isAi
                            ? "bg-white/5 border border-white/10 rounded-tl-sm text-gray-200"
                            : "bg-linear-to-br from-accent-blue to-blue-600 text-white rounded-tr-sm shadow-xl shadow-accent-blue/20",
                    )}
                >
                    {isAi ? (
                        <div className="prose prose-invert text-[15px] max-w-full overflow-hidden">
                            <div className="mb-3 inline-flex items-center rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-blue">
                                {message.model || "Default Hosted Model"}
                            </div>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <p className="mb-2 text-gray-300 leading-relaxed">
                                            {children}
                                        </p>
                                    ),
                                    h1: ({ children }) => (
                                        <h1 className="text-white font-bold text-lg mt-4 mb-2">
                                            {children}
                                        </h1>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-white font-semibold text-base mt-4 mb-2">
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-white font-semibold mt-4 mb-2 text-base">
                                            {children}
                                        </h3>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc pl-5 mb-2 space-y-1 text-gray-300">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal pl-5 mb-2 space-y-1 text-gray-300">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="text-gray-300">{children}</li>
                                    ),
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-accent-blue hover:underline"
                                        >
                                            {children}
                                        </a>
                                    ),
                                    code: ({ className, children }) => {
                                        const languageMatch = /language-(\w+)/.exec(
                                            className || "",
                                        );
                                        const code = String(children || "").replace(
                                            /\n$/,
                                            "",
                                        );
                                        const language = languageMatch?.[1] || "";
                                        const isBlock = Boolean(languageMatch);

                                        if (!isBlock) {
                                            return (
                                                <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-sm text-accent-blue mx-0.5 border border-white/5 shadow-sm">
                                                    {code}
                                                </code>
                                            );
                                        }

                                        return (
                                            <div className="my-4 rounded-xl overflow-hidden bg-[#0a0a0e] border border-white/10 shadow-xl">
                                                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                                        <Code className="w-3.5 h-3.5" />
                                                        {language || "code"}
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            navigator.clipboard.writeText(
                                                                code,
                                                            )
                                                        }
                                                        className="text-sm uppercase font-bold tracking-wider text-gray-500 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                                <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-gray-300 custom-scrollbar w-full max-w-full">
                                                    <pre>
                                                        <code
                                                            dangerouslySetInnerHTML={{
                                                                __html: highlightCode(
                                                                    language,
                                                                    code,
                                                                ),
                                                            }}
                                                        />
                                                    </pre>
                                                </div>
                                            </div>
                                        );
                                    },
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>

                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                </div>

                {/* Message Actions */}
                {isAi && !message.isStreaming && (
                    <div className="flex items-center gap-2 opacity-100 transition-opacity mt-1">
                        <button
                            onClick={handleCopy}
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-sm font-medium"
                        >
                            {copied ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                                <Copy className="w-3.5 h-3.5" />
                            )}
                            {copied ? (
                                <span className="text-green-400">Copied</span>
                            ) : (
                                "Copy"
                            )}
                        </button>

                        <>
                            <div className="w-px h-3 bg-white/10" />
                            <button
                                onClick={() => onViewSources(message)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-sm font-medium"
                            >
                                <Search className="w-3.5 h-3.5 text-accent-blue" />
                                View Sources
                            </button>
                        </>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
