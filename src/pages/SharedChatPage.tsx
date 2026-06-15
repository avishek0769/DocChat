import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
    X,
    Loader2,
    Database,
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/CodeBlock";
import {
    getSharedChatDetails,
    getSharedChatMessages,
    forkSharedChat,
    getSharedMessageSources,
} from "../lib/api";
import { getAuthUser } from "../lib/auth";

type CurrentLink = {
    title: string;
    url: string;
    isHighlight: boolean;
};

type IndexedPage = {
    pageUrl: string;
    heading?: string | null;
};

const toModelDisplayName = (model?: string) => {
    if (!model) return "Default Hosted Model";

    if (model === "default-1") return "GPT - OSS";
    if (model === "default-2") return "Nemotron 3 Super";

    return model;
};

export const SharedChatPage = () => {
    const navigate = useNavigate();
    const { shareToken = "" } = useParams();
    const user = getAuthUser();

    const [docInfo, setDocInfo] = useState({
        title: "Documentation Chat",
        url: "",
        pages: 0,
        tokensUsed: 0,
        lastUpdated: "-",
        status: "ready",
    });
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedSources, setSelectedSources] = useState<Source[]>([]);
    const [isSourcesLoading, setIsSourcesLoading] = useState(false);
    const [sourceFetchAttempted, setSourceFetchAttempted] = useState(false);

    const [isIndexedModalOpen, setIsIndexedModalOpen] = useState(false);
    const [currentLinks, setCurrentLinks] = useState<CurrentLink[]>([]);
    const [indexedPages, setIndexedPages] = useState<IndexedPage[]>([]);
    const [isForking, setIsForking] = useState(false);

    const handleContinueChat = async () => {
        if (!user) {
            navigate("/signin", { state: { returnTo: `/shared/${shareToken}` } });
            return;
        }

        setIsForking(true);
        try {
            const res = await forkSharedChat(shareToken);
            navigate(`/chat/${res.chatId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to continue chat.");
            setIsForking(false);
        }
    };

    const loadChatPage = async () => {
        if (!shareToken) return;
        setIsMessagesLoading(true);
        setError("");
        try {
            const [chatDetails, messageData] = await Promise.all([
                getSharedChatDetails(shareToken),
                getSharedChatMessages(shareToken),
            ]);

            const chat = chatDetails.chat;
            const primarySource = chat?.chatSources?.[0];
            setDocInfo((prev) => ({
                ...prev,
                title: chat?.name || prev.title,
                url: primarySource?.documentationUrl || prev.url,
                pages: primarySource?._count?.pagesIndexed || prev.pages,
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
            setIndexedPages(chat?.chatSources?.[0]?.pagesIndexed || []);

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
                    model: toModelDisplayName(msg.llmModel),
                    sources: [],
                    sourcesLoaded: false,
                    timestamp: new Date(msg.createdAt),
                });
            }
            setMessages(messagePairs);
            setIsMessagesLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chat data.");
            setIsMessagesLoading(false);
        }
    };

    useEffect(() => {
        loadChatPage();
    }, [shareToken]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
            const srcData = await getSharedMessageSources(shareToken, message.messageId);
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

    return (
        <div className="h-screen bg-[#0b0b0f] text-gray-50 flex overflow-hidden font-sans selection:bg-accent-purple/30">
            <main className="flex-1 flex w-full relative h-full">
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
                                        <div className="px-3 py-2 rounded-lg text-sm transition-colors border border-transparent text-gray-400">
                                            No documentation source links found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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

                <div className="flex-1 flex flex-col relative h-full bg-[#0b0b0f]">
                    <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#0b0b0f]/90 backdrop-blur-sm z-10 sticky top-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/")}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div>
                                <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                                    {docInfo.title}
                                    <span className="text-xs px-2 py-1 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20">Shared</span>
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleContinueChat}
                                disabled={isForking}
                                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors bg-accent-blue text-white hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Bot className="w-4 h-4" />
                                <span className="hidden sm:inline">{isForking ? "Continuing..." : "Continue this chat"}</span>
                            </button>
                            <button
                                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2",
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
                                            No messages in this chat.
                                        </h2>
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
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>

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
                                    <h2 className="font-semibold text-gray-200">Sources Retrieved</h2>
                                </div>
                                <span className="text-sm font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    {selectedSources.length} found
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 w-[320px] space-y-4">
                                {isSourcesLoading ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
                                        <span className="text-sm">Fetching source chunks...</span>
                                    </div>
                                ) : selectedSources.length === 0 ? (
                                    <div className="text-center text-gray-500 text-sm py-10">
                                        {sourceFetchAttempted
                                            ? "No source found for this message."
                                            : "No sources fetched yet. Select a message to see references."}
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
                                                                {source.url}
                                                            </a>
                                                        ) : (
                                                            <span className="text-sm text-gray-500 truncate block">
                                                                Source URL unavailable
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 text-sm text-gray-400 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar relative">
                                                <div className="pl-3 relative z-10">
                                                    <p>{source.snippet}</p>
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
                                <h2 className="text-xl font-semibold text-white">Indexed Pages</h2>
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
