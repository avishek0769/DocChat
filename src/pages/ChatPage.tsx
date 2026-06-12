import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "../components/Sidebar";
import Skeleton from "../components/Skeleton";

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
    Menu,
    ChevronLeft,
    ChevronRight,
    Copy,
    Bot,
    User,
    Clock,
    Search,
    ArrowLeft,
    Check,
    X,
    Loader2,
    Database,
    Download,
    Link as LinkIcon,
    Share2,
    AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/CodeBlock";
import {
    addChatSource,
    removeChatSource,
    getAvailableModels,
    getChatDetails,
    getChatMessages,
    getMessageSources,
    getPagesIndexed,
    sendMessageStream,
    exportChatMessages,
    toggleChatShare,
} from "../lib/api";
import { formatTokens } from "../lib/format";

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

const toModelDisplayName = (model?: string) => {
    if (!model) return "Default Hosted Model";

    if (model === "default-1") return "GPT - OSS";
    if (model === "default-2") return "Nemotron 3 Super";

    return model;
};

const mapApiMessagesToUiMessages = (messageList: Array<{
    id: string;
    userPrompt: string;
    llmResponse: string;
    llmModel: string;
    createdAt: string;
}>) => {
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
            model: toModelDisplayName(msg.llmModel),
            sources: [],
            sourcesLoaded: false,
            timestamp: new Date(msg.createdAt),
        });
    }
    return messagePairs;
};

const WARNING_LENGTH_THRESHOLD = 4000;

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
    const [hasApiKeys, setHasApiKeys] = useState(true);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isMessagesLoading, setIsMessagesLoading] = useState(true);
    const [error, setError] = useState("");
    // Layout configuration
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Chat state
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isAwaitingFirstChunk, setIsAwaitingFirstChunk] = useState(false);
    const [selectedSources, setSelectedSources] = useState<Source[]>([]);
    const [isSourcesLoading, setIsSourcesLoading] = useState(false);
    const [sourceFetchAttempted, setSourceFetchAttempted] = useState(false);

    const [isExporting, setIsExporting] = useState(false);
    const [isIndexedModalOpen, setIsIndexedModalOpen] = useState(false);
    const [currentLinks, setCurrentLinks] = useState<CurrentLink[]>([]);
    const [indexedPages, setIndexedPages] = useState<IndexedPage[]>([]);
    const [newSourceUrl, setNewSourceUrl] = useState("");

    const [isSharing, setIsSharing] = useState(false);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const handleShare = () => {
        setShareModalOpen(true);
    };

    const handleToggleShare = async () => {
        setIsSharing(true);
        try {
            const res = await toggleChatShare(chatId);
            setShareToken(res.shareToken || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to toggle share.");
        } finally {
            setIsSharing(false);
        }
    };

    const [linkCopied, setLinkCopied] = useState(false);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await exportChatMessages(chatId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to export chat.");
        } finally {
            setIsExporting(false);
        }
    };

    const loadChatPage = async () => {
        if (!chatId) return;
        setIsPageLoading(true);
        setIsMessagesLoading(true);
        setError("");
        try {
            const [chatDetails, indexedPageData, availableModelsData, messageData] = await Promise.all([
                getChatDetails(chatId),
                getPagesIndexed(chatId),
                getAvailableModels(),
                getChatMessages(chatId, 50),
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

            setShareToken(chat?.shareToken || null);

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
                    label: `Default (Fast) - GPT - OSS`,
                },
                {
                    provider: "DEFAULT",
                    model: "default-2",
                    label: `Default (Best) - Nemotron 3 Super`,
                },
            ];

            const rawModels = availableModelsData?.models || [];
            const uniqueModels = Array.from(new Set(rawModels)).sort();
            setHasApiKeys(uniqueModels.length > 0);

            const inferProvider = (m: string) => {
                if (m.includes("/")) return "OPENROUTER";
                if (m.includes("gpt")) return "OPENAI";
                if (m.includes("claude")) return "ANTHROPIC";
                if (m.includes("gemini")) return "GOOGLE";
                if (m.includes("grok")) return "XAI";
                return "OPENROUTER";
            };

            const dynamicModels = uniqueModels.map((model) => {
                const provider = inferProvider(model);
                return {
                    provider,
                    model,
                    label: `${model} (${provider})`,
                };
            });

            const options = [...defaultOptions, ...dynamicModels];
            setModelOptions(options);
            setSelectedModel((prev) => prev || options[0]?.model || "default-1");

            setMessages(mapApiMessagesToUiMessages(messageData.messages || []));
            setNextCursor(messageData.nextCursor || null);
            setHasMore(Boolean(messageData.hasMore));
            setIsMessagesLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chat data.");
            setIsMessagesLoading(false);
        } finally {
            setIsPageLoading(false);
        }
    };

    const handleAddSource = async () => {
        const value = newSourceUrl.trim();
        if (!value) return;
        try {
            await addChatSource(chatId, { docsUrl: value });
            setNewSourceUrl("");
            await loadChatPage();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add source.");
        }
    };

    const handleRemoveSource = async (docsUrl: string) => {
        try {
            await removeChatSource(chatId, { docsUrl });
            await loadChatPage();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove source.");
        }
    };

    const loadOlderMessages = async () => {
        if (!chatId || !nextCursor || isLoadingOlder) return;
        setIsLoadingOlder(true);
        try {
            skipNextAutoScrollRef.current = true;
            const olderData = await getChatMessages(chatId, 50, nextCursor);
            const olderMessages = mapApiMessagesToUiMessages(olderData.messages || []);
            setMessages((prev) => [...olderMessages, ...prev]);
            setNextCursor(olderData.nextCursor || null);
            setHasMore(Boolean(olderData.hasMore));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load older messages.");
        } finally {
            setIsLoadingOlder(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
        loadChatPage();
    }, [chatId]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 639px)");

        const updateMobileState = (event: MediaQueryList | MediaQueryListEvent) => {
            const mobile = "matches" in event ? event.matches : mediaQuery.matches;
            setIsMobile(mobile);
            if (mobile) {
                setLeftPanelOpen(false);
                setRightPanelOpen(false);
            } else {
                setMobileNavOpen(false);
            }
        };

        updateMobileState(mediaQuery);

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", updateMobileState);
            return () => mediaQuery.removeEventListener("change", updateMobileState);
        }

        mediaQuery.addListener(updateMobileState);
        return () => mediaQuery.removeListener(updateMobileState);
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingChunkRef = useRef("");
    const chunkRafRef = useRef<number | null>(null);
    const firstChunkReceivedRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const skipNextAutoScrollRef = useRef(false);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;

            if (chunkRafRef.current !== null) {
                window.cancelAnimationFrame(chunkRafRef.current);
                chunkRafRef.current = null;
            }
        };
    }, []);

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
                prev.map((m) => (m.id === message.id ? { ...m, sources, sourcesLoaded: true } : m)),
            );
        } catch {
            setSelectedSources([]);
            setMessages((prev) =>
                prev.map((m) => (m.id === message.id ? { ...m, sources: [], sourcesLoaded: true } : m)),
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
        if (skipNextAutoScrollRef.current) {
            skipNextAutoScrollRef.current = false;
            return;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isTyping) return;

        const selectedOption = modelOptions.find((opt) => opt.model === selectedModel) ||
            modelOptions[0] || {
                provider: "DEFAULT",
                model: "default-1",
                label: `Default (Fast) - GPT - OSS`,
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
        pendingChunkRef.current = "";
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
            abortControllerRef.current = new AbortController();
            const flushPendingChunks = () => {
                const buffered = pendingChunkRef.current;
                if (!buffered) return;
                pendingChunkRef.current = "";
                setMessages((prev) =>
                    prev.map((m) => (m.id === aiId ? { ...m, content: `${m.content}${buffered}` } : m)),
                );
            };

            const scheduleChunkFlush = () => {
                if (chunkRafRef.current !== null) return;
                chunkRafRef.current = window.requestAnimationFrame(() => {
                    chunkRafRef.current = null;
                    flushPendingChunks();
                    if (pendingChunkRef.current) {
                        scheduleChunkFlush();
                    }
                });
            };

            await sendMessageStream({
                userPrompt: newUserMessage.content,
                model: selectedOption.model,
                provider: selectedOption.provider,
                chatId,
                signal: abortControllerRef.current.signal, 
                onChunk: (chunk) => {
                    if (!firstChunkReceivedRef.current) {
                        firstChunkReceivedRef.current = true;
                        setIsAwaitingFirstChunk(false);
                    }

                    pendingChunkRef.current += chunk;
                    scheduleChunkFlush();
                },
            });

            if (chunkRafRef.current !== null) {
                window.cancelAnimationFrame(chunkRafRef.current);
                chunkRafRef.current = null;
            }
            flushPendingChunks();

            setIsAwaitingFirstChunk(false);

            setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, isStreaming: false } : m)));

            const latestMessages = await getChatMessages(chatId, 50);
            const latestAi = (latestMessages.messages || []).at(-1);
            if (latestAi) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === aiId
                            ? {
                                  ...m,
                                  messageId: latestAi.id,
                                  // Keep the exact model selected in UI for message badge text.
                                  model: selectedOption.label,
                                  sources: [],
                                  sourcesLoaded: false,
                              }
                            : m,
                    ),
                );
            }
        } catch (err) {
    if (chunkRafRef.current !== null) {
        window.cancelAnimationFrame(chunkRafRef.current);
        chunkRafRef.current = null;
    }
    pendingChunkRef.current = "";
    setIsAwaitingFirstChunk(false);

    const errMsg = err instanceof Error ? err.message : "Failed to send message.";

    // 409 = chat not ready or failed — show inline banner, restore input
    if (err instanceof Error && (err.message.includes("indexing") || err.message.includes("ingestion"))) {
        setError(errMsg);
        setInput(newUserMessage.content);           // restore so user can retry
        setMessages((prev) => prev.filter((m) => m.id !== aiId || m.id !== newUserMessage.id));
    } else {
        setError(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== aiId));
    }
}
        finally {
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

            {/* Mobile App Navigation Drawer */}
            <AnimatePresence>
                {isMobile && mobileNavOpen && (
                    <>
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileNavOpen(false)}
                            className="lg:hidden fixed inset-0 bg-black/50 z-50"
                        />
                        <motion.div
                            initial={{ x: "-100%", opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "-100%", opacity: 0.5 }}
                            className="lg:hidden fixed inset-y-0 left-0 z-60"
                        >
                            <Sidebar isCollapsed={true} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 flex w-full min-w-0 relative h-full overflow-hidden">
                {/* 1. Left Panel (Docs) */}
                <AnimatePresence initial={false}>
                    {leftPanelOpen && !isMobile && (
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
                                <div className="mt-4 space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        Add Source
                                    </label>
                                    <input
                                        type="url"
                                        value={newSourceUrl}
                                        onChange={(e) => setNewSourceUrl(e.target.value)}
                                        placeholder="https://docs.example.com"
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddSource}
                                        className="w-full px-3 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-medium transition-colors"
                                    >
                                        Add to Chat
                                    </button>
                                </div>
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
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate pr-2 text-gray-300">
                                                        {page.title}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSource(page.url)}
                                                        className="text-[11px] text-red-400 hover:text-red-300 shrink-0"
                                                    >
                                                        Remove
                                                    </button>
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
                                        <div className="px-3 py-2 rounded-lg text-sm transition-colors border border-transparent text-gray-400">
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
                    aria-label="Toggle-sidebar"
                    onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                    className="absolute -left-px top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-[#1a1a24] border border-white/10 rounded-r-lg items-center justify-center hover:bg-[#252535] transition-colors shadow-lg hidden sm:flex"
                    style={{ left: leftPanelOpen ? 279 : -1 }}
                >
                    {leftPanelOpen ? (
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                </button>

                {/* 2. Main Chat Area */}
                <div className="flex-1 min-w-0 flex flex-col relative h-full bg-[#0b0b0f] overflow-hidden">
                    {/* Header */}
                    <header className="h-16 flex items-center justify-between px-3 sm:px-6 border-b border-white/5 shrink-0 bg-[#0b0b0f]/90 backdrop-blur-sm z-10 sticky top-0 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <button
                                onClick={() => setMobileNavOpen(true)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white lg:hidden"
                                aria-label="Open menu"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                            <button
                                aria-label="Back to dashboard"
                                onClick={() => navigate("/dashboard")}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white lg:hidden"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div>
                                <h1 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2 truncate max-w-[42vw] sm:max-w-none">
                                    {docInfo.title}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            {!hasApiKeys && (
                                <button
                                    onClick={() => navigate("/dashboard?tab=api-keys")}
                                    className="hidden sm:inline-flex text-xs font-semibold text-accent-blue hover:text-accent-blue/80 hover:underline px-2 transition-colors"
                                >
                                    + Add API Key
                                </button>
                            )}
                            <div className="hidden sm:flex items-center mr-2">
                                <div className="relative inline-flex items-center gap-2 rounded-xl border border-white/15 bg-linear-to-r from-white/5 to-white/2 px-2.5 py-1.5 shadow-inner shadow-black/30">
                                    <span className="text-[11px] tracking-wide uppercase text-gray-500 font-semibold">
                                        Model
                                    </span>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
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
                                aria-label="Export chat"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-1.5 sm:gap-2 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
                            </button>
                            <button
                                onClick={handleShare}
                                aria-label="Toggle right panel"
                                disabled={isSharing}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="hidden sm:inline">{isSharing ? "Sharing..." : "Share"}</span>
                            </button>
                            <button
                                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                                className={clsx(
                                    "px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-1.5 sm:gap-2",
                                    rightPanelOpen
                                        ? "bg-accent-blue/10 border-accent-blue/20 text-accent-blue"
                                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10",
                                )}
                            >
                                <Search className="w-4 h-4" />
                                <span className="hidden sm:inline">Sources</span>
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
                    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8 custom-scrollbar scroll-smooth">
                        <div className="max-w-3xl mx-auto space-y-8 pb-10">
                            {isMessagesLoading ? (
                                <div className="space-y-8">
  {[1,2,3,4].map((i) => (
    <div key={i} className="flex gap-4">
      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />

      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  ))}
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
                                            Ask me anything about the {docInfo.title}. I can provide code
                                            examples, explain concepts, and point you to the right pages.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                                        {[
                                            "How does state work?",
                                            "Give me a code example",
                                            "How to handle errors?",
                                        ].map((suggestion) => (
                                            <button
                                                aria-label="use suggestion"
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
                                <>
                                    {hasMore && (
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={loadOlderMessages}
                                                disabled={isLoadingOlder}
                                                className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {isLoadingOlder ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Loading older...
                                                    </>
                                                ) : (
                                                    "Load older messages"
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {messages.map((msg) => (
                                        <ChatMessage
                                            key={msg.id}
                                            message={msg}
                                            onViewSources={handleViewSources}
                                        />
                                    ))}
                                </>
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
                    <div className="p-3 sm:p-6 bg-linear-to-t from-[#0b0b0f] via-[#0b0b0f]/95 to-transparent shrink-0">
                        <div className="max-w-3xl mx-auto relative">
                            <form
                                onSubmit={handleSend}
                                className={clsx(
                                    "relative bg-[#1a1a24] border rounded-2xl shadow-2xl overflow-hidden focus-within:ring-1 transition-all",
                                    input.length > WARNING_LENGTH_THRESHOLD
                                        ? "border-amber-500/50 focus-within:border-amber-500/70 focus-within:ring-amber-500/30"
                                        : "border-white/10 focus-within:border-accent-blue/50 focus-within:ring-accent-blue/50"
                                )}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask something about the docs..."
                                    className="w-full bg-transparent px-4 sm:px-5 py-4 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none resize-none custom-scrollbar"
                                    rows={1}
                                    style={{
                                        minHeight: "56px",
                                        maxHeight: "200px",
                                    }}
                                />
                                <div className="absolute right-3 bottom-3 flex items-center gap-3">
                                    {input.length > WARNING_LENGTH_THRESHOLD && (
                                        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-xs font-medium text-amber-500">
                                                {input.length} chars (Approaching limit)
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        aria-label="Send message"
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
                                    DocChat AI can make mistakes. Verify important information.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Toggle Button */}
                <button
                    aria-label="Toggle right panel"
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

                {/* Mobile Left Toggle Handle */}
                {isMobile && !mobileNavOpen && (
                    <button
                        onClick={() => {
                            if (!leftPanelOpen) {
                                setRightPanelOpen(false);
                            }
                            setLeftPanelOpen((prev) => !prev);
                        }}
                        className="sm:hidden absolute -left-px top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-[#1a1a24] border border-white/10 rounded-r-lg flex items-center justify-center hover:bg-[#252535] transition-colors shadow-lg"
                        style={{ left: leftPanelOpen ? "min(85vw, 320px)" : -1 }}
                        aria-label={leftPanelOpen ? "Close chat info" : "Open chat info"}
                    >
                        {leftPanelOpen ? (
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                    </button>
                )}

                {/* Mobile Right Toggle Handle */}
                {isMobile && !mobileNavOpen && (
                    <button
                        onClick={() => {
                            if (!rightPanelOpen) {
                                setLeftPanelOpen(false);
                            }
                            setRightPanelOpen((prev) => !prev);
                        }}
                        className="sm:hidden absolute -right-px top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-[#1a1a24] border border-white/10 rounded-l-lg flex items-center justify-center hover:bg-[#252535] transition-colors shadow-lg"
                        style={{ right: rightPanelOpen ? "min(85vw, 320px)" : -1 }}
                        aria-label={rightPanelOpen ? "Close sources" : "Open sources"}
                    >
                        {rightPanelOpen ? (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                        )}
                    </button>
                )}
                {/* Share Modal */}
                <AnimatePresence>
                    {shareModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[#1a1a24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                            >
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <Share2 className="w-5 h-5 text-accent-blue" />
                                            Share Chat
                                        </h3>
                                        <button
                                            onClick={() => setShareModalOpen(false)}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {shareToken ? (
                                            <>
                                                <p className="text-sm text-gray-400">
                                                    Anyone with this link can view the chat history. They can also continue the chat by creating their own copy.
                                                </p>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={`${window.location.origin}/shared/${shareToken}`}
                                                        className="w-full bg-[#0b0b0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`${window.location.origin}/shared/${shareToken}`);
                                                            setLinkCopied(true);
                                                            setTimeout(() => setLinkCopied(false), 2000);
                                                        }}
                                                        className="p-2 rounded-lg bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors flex items-center gap-1"
                                                    >
                                                        {linkCopied ? (
                                                            <>
                                                                <Check className="w-4 h-4 text-green-400" />
                                                                <span className="text-sm font-medium text-green-400">Copied</span>
                                                            </>
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleToggleShare}
                                                    disabled={isSharing}
                                                    className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium disabled:opacity-50"
                                                >
                                                    {isSharing ? "Revoking..." : "Revoke Link"}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm text-gray-400">
                                                    Generate a link to share this conversation with others.
                                                </p>
                                                <button
                                                    onClick={handleToggleShare}
                                                    disabled={isSharing}
                                                    className="w-full py-2.5 rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
                                                >
                                                    {isSharing ? "Creating..." : "Create Share Link"}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* 3. Right Panel (Sources) */}
                <AnimatePresence initial={false}>
                    {rightPanelOpen && !isMobile && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="hidden sm:flex h-full border-l border-white/5 bg-[#0b0b0f]/95 backdrop-blur-md shrink-0 flex-col z-20 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/5 w-[320px] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-accent-blue" />
                                    <h2 className="font-semibold text-gray-200">Sources Retreived</h2>
                                </div>
                                <span className="text-sm font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    {selectedSources.length} found
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 w-[320px] space-y-4">
                                {isSourcesLoading ? (
                                    <div className="space-y-4">
  {[1,2,3].map((i) => (
    <div
      key={i}
      className="bg-white/3 border border-white/10 rounded-xl p-4"
    >
      <Skeleton className="h-4 w-2/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  ))}
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
                                                        {source.url ? (
                                                            <a
                                                                href={source.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-sm text-gray-500 hover:text-accent-blue truncate block"
                                                            >
                                                                {(() => {
                                                                    try {
                                                                        return new URL(source.url).pathname;
                                                                    } catch {
                                                                        return source.url;
                                                                    }
                                                                })()}
                                                            </a>
                                                        ) : (
                                                            <span className="text-sm text-gray-500 truncate block">
                                                                Source URL unavailable
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-sm font-mono text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                                                    {source.relevance ?? "--"}%
                                                </div>
                                            </div>
                                            <div className="p-3 text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar relative">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-accent-blue/30 rounded-full"></div>
                                                <div className="pl-3 relative z-10">
                                                    {source.snippet
                                                        .split("\n")
                                                        .map((line: string, i: number) => (
                                                            <p
                                                                key={i}
                                                                className={clsx(
                                                                    line.startsWith("```")
                                                                        ? "font-mono text-sm text-gray-300 my-1 bg-white/5 p-1 rounded"
                                                                        : "",
                                                                )}
                                                            >
                                                                {line}
                                                            </p>
                                                        ))}
                                                    {source.url ? (
                                                        <a
                                                            href={source.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex items-center gap-1.5 mt-3 text-accent-blue hover:underline font-mono text-sm opacity-80 decoration-accent-blue/50"
                                                        >
                                                            <LinkIcon className="w-3.5 h-3.5" />
                                                            {source.url}
                                                        </a>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 mt-3 text-gray-500 font-mono text-sm">
                                                            <LinkIcon className="w-3.5 h-3.5" />
                                                            No source URL for this chunk
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Left Sheet (Chat Info) */}
                <AnimatePresence>
                    {isMobile && leftPanelOpen && (
                        <>
                            <motion.button
                                type="button"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setLeftPanelOpen(false)}
                                className="sm:hidden absolute inset-0 bg-black/50 backdrop-blur-[1px] z-40"
                            />
                            <motion.div
                                initial={{ x: "-100%", opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "-100%", opacity: 0.5 }}
                                className="sm:hidden absolute left-0 top-0 h-full w-[85vw] max-w-[320px] border-r border-white/10 bg-[#0b0b0f] z-50 flex flex-col"
                            >
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white">Chat information</h3>
                                    <button
                                        onClick={() => setLeftPanelOpen(false)}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-4 border-b border-white/10">
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
                                                Total Tokens
                                            </div>
                                            <div className="font-medium text-sm text-gray-200 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
                                                {formatTokens(docInfo.tokensUsed)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setLeftPanelOpen(false);
                                            setIsIndexedModalOpen(true);
                                        }}
                                        className="w-full py-2.5 mt-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold transition-all flex items-center justify-center gap-2 text-gray-200"
                                    >
                                        <FileText className="w-4 h-4 text-accent-blue" />
                                        Show all pages
                                    </button>
                                    <div className="mt-4 space-y-2">
                                        <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                            Add Source
                                        </label>
                                        <input
                                            type="url"
                                            value={newSourceUrl}
                                            onChange={(e) => setNewSourceUrl(e.target.value)}
                                            placeholder="https://docs.example.com"
                                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddSource}
                                            className="w-full px-3 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-medium transition-colors"
                                        >
                                            Add to Chat
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                                        Current Links
                                    </h4>
                                    <div className="space-y-2">
                                        {currentLinks.length > 0 ? (
                                            currentLinks.map((page, i) => (
                                                <div
                                                    key={i}
                                                    className="px-3 py-2 rounded-lg text-sm border border-white/10 bg-white/5"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="block text-gray-300 wrap-break-word">
                                                            {page.title}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSource(page.url)}
                                                            className="text-[11px] text-red-400 hover:text-red-300 shrink-0"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                    <a
                                                        href={page.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm opacity-70 mt-1 font-mono hover:text-accent-blue hover:underline block break-all"
                                                    >
                                                        {page.url}
                                                    </a>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 rounded-lg text-sm border border-white/10 bg-white/5 text-gray-400">
                                                No documentation source links found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Mobile Right Sheet (Sources) */}
                <AnimatePresence>
                    {isMobile && rightPanelOpen && (
                        <>
                            <motion.button
                                type="button"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setRightPanelOpen(false)}
                                className="sm:hidden absolute inset-0 bg-black/50 backdrop-blur-[1px] z-40"
                            />
                            <motion.div
                                initial={{ x: "100%", opacity: 0.5 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "100%", opacity: 0.5 }}
                                className="sm:hidden absolute right-0 top-0 h-full w-[85vw] max-w-[320px] border-l border-white/10 bg-[#0b0b0f] z-50 flex flex-col"
                            >
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-4 h-4 text-accent-blue" />
                                        <h2 className="font-semibold text-gray-200">Sources Retrieved</h2>
                                    </div>
                                    <button
                                        onClick={() => setRightPanelOpen(false)}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="px-4 pt-3">
                                    <span className="text-sm font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full inline-block">
                                        {selectedSources.length} found
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {isSourcesLoading ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
                                            <span className="text-sm">Fetching source chunks...</span>
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
                                                className="bg-white/3 border border-white/10 rounded-xl overflow-hidden"
                                            >
                                                <div className="p-3 border-b border-white/5 bg-white/5 flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                                        <div className="w-5 h-5 rounded-md bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-sm font-bold text-accent-blue shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-medium text-gray-200 truncate">
                                                                {source.title}
                                                            </h4>
                                                            {source.url ? (
                                                                <a
                                                                    href={source.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-sm text-gray-500 hover:text-accent-blue truncate block"
                                                                >
                                                                    {(() => {
                                                                        try {
                                                                            return new URL(source.url).pathname;
                                                                        } catch {
                                                                            return source.url;
                                                                        }
                                                                    })()}
                                                                </a>
                                                            ) : (
                                                                <span className="text-sm text-gray-500 truncate block">
                                                                    Source URL unavailable
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-mono text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                                                        {source.relevance ?? "--"}%
                                                    </div>
                                                </div>
                                                <div className="p-3 text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar relative">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-accent-blue/30 rounded-full"></div>
                                                    <div className="pl-3 relative z-10">
                                                        {source.snippet
                                                            .split("\n")
                                                            .map((line: string, i: number) => (
                                                                <p
                                                                    key={i}
                                                                    className={clsx(
                                                                        line.startsWith("```")
                                                                            ? "font-mono text-sm text-gray-300 my-1 bg-white/5 p-1 rounded"
                                                                            : "wrap-break-word",
                                                                    )}
                                                                >
                                                                    {line}
                                                                </p>
                                                            ))}
                                                        {source.url ? (
                                                            <a
                                                                href={source.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1.5 mt-3 text-accent-blue hover:underline font-mono text-sm opacity-80 decoration-accent-blue/50 break-all"
                                                            >
                                                                <LinkIcon className="w-3.5 h-3.5" />
                                                                {source.url}
                                                            </a>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 mt-3 text-gray-500 font-mono text-sm">
                                                                <LinkIcon className="w-3.5 h-3.5" />
                                                                No source URL for this chunk
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </main>

            {/* Indexed Modal */}
            <AnimatePresence>
                {isIndexedModalOpen && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-4">
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
                            className="bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative z-10"
                        >
                            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between gap-3">
                                <h2 className="text-lg sm:text-xl font-semibold text-white">Indexed Pages</h2>
                                <button
                                    aria-label="close indexed modal"
                                    onClick={() => setIsIndexedModalOpen(false)}
                                    className="p-2 -mr-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
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
                                            className="text-sm font-mono text-gray-400 hover:text-accent-blue block break-all ml-6"
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
                    "flex flex-col gap-2 max-w-[88%] sm:max-w-[75%] min-w-0",
                    isAi ? "items-start" : "items-end",
                )}
            >
                <div
                    className={clsx(
                        "px-4 sm:px-5 py-3.5 rounded-2xl text-sm leading-relaxed overflow-hidden max-w-full wrap-break-word",
                        isAi
                            ? "bg-white/5 border border-white/10 rounded-tl-sm text-gray-200"
                            : "bg-linear-to-br from-accent-blue to-blue-600 text-white rounded-tr-sm shadow-xl shadow-accent-blue/20",
                    )}
                >
                    {isAi ? (
                        <div className="prose prose-invert text-[15px] max-w-full overflow-hidden wrap-break-word">
                            <div className="mb-3 inline-flex items-center rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-blue">
                                {message.model || "Default Hosted Model"}
                            </div>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <p className="mb-2 text-gray-300 leading-relaxed">{children}</p>
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
                                    li: ({ children }) => <li className="text-gray-300">{children}</li>,
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
                                        const languageMatch = /language-(\w+)/.exec(className || "");
                                        const code = String(children || "").replace(/\n$/, "");
                                        const language = languageMatch?.[1] || "";
                                        const isBlock = Boolean(languageMatch);

                                        if (!isBlock) {
                                            return (
                                                <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-sm text-accent-blue mx-0.5 border border-white/5 shadow-sm">
                                                    {code}
                                                </code>
                                            );
                                        }

                                        return <CodeBlock language={language} code={code} />;
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
                            {copied ? <span className="text-green-400">Copied</span> : "Copy"}
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
