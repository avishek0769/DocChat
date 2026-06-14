import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import Skeleton from "../components/Skeleton";

import {
    MessageSquare,
    Plus,
    FileText,
    Database,
    Clock,
    Trash2,
    Pencil,
    AlertCircle,
    Loader2,
    CheckCircle2,
    X,
    RefreshCw,
} from "lucide-react";
import {
    createChat,
    bulkDeleteChats,
    deleteChat,
    getChatStatus,
    renameChat,
    subscribeToChatStatus,
    getLifetimeTokens,
    getRecentChats,
    getRecentFailedIngestionRuns,
    invalidatePagesIndexed,
    cancelChat,
    type ChatItem,
    type FailedIngestionRunItem,
} from "../lib/api";
import { formatTokens } from "../lib/format";

interface Chat {
    id: string;
    title: string;
    urls: string[];
    isVectorLess: boolean;
    status: string;
    pages: number;
    totalPages: number;
    tokens: number;
    createdAt: string;
}

const fromNow = (iso: string) => {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return "Just now";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

const mapBackendChat = (chat: ChatItem): Chat => {
    const source = chat.chatSources?.[0];
    const pagesIndexed = source?._count?.pagesIndexed ?? source?.pagesIndexed?.length ?? 0;
    return {
        id: chat.id,
        title: chat.name,
        urls: (chat.chatSources || []).map((s) => s.documentationUrl),
        isVectorLess: Boolean(source?.isVectorLess),
        status: String(chat.status || "QUEUED").toLowerCase(),
        pages: pagesIndexed,
        totalPages: source?.totalPages || pagesIndexed || 0,
        tokens: chat.totalUsage?.total || 0,
        createdAt: fromNow(chat.createdAt),
    };
};

const normalizeStatus = (status?: string) => {
    const value = String(status || "QUEUED").toLowerCase();
    if (value === "queued") return "queued";
    if (value === "processing") return "processing";
    if (value === "ready") return "ready";
    if (value === "failed") return "failed";
    return "queued";
};

const clampProgress = (progress?: number) => {
    if (!Number.isFinite(progress)) return 0;
    return Math.max(0, Math.min(100, Number(progress)));
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [chats, setChats] = useState<Chat[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDocsListOpen, setIsDocsListOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedChats, setSelectedChats] = useState<string[]>([]);
    const [isCancelling, setIsCancelling] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Chat | null>(null);
    const [renameName, setRenameName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameError, setRenameError] = useState("");
    const [lifetimeTokens, setLifetimeTokens] = useState(0);
    const [failedRuns, setFailedRuns] = useState<FailedIngestionRunItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [chatProgress, setChatProgress] = useState<
        Record<string, { status: string; progress: number }>
    >({});
    const chatsRef = useRef<Chat[]>([]);
    const chatProgressRef = useRef<Record<string, { status: string; progress: number }>>({});
    const pollIntervalRef = useRef<number | null>(null);
    const sseCleanupsRef = useRef<Record<string, () => void>>({});
    const [usePollingFallback, setUsePollingFallback] = useState(false);

    // New Chat Form State
    const [chatName, setChatName] = useState("");
    const [chatUrl, setChatUrl] = useState("");
    const [chatUrls, setChatUrls] = useState<string[]>([]);
    const [isVectorLess, setIsVectorLess] = useState(false);
    const [scrapeLimit, setScrapeLimit] = useState<number | "">("");

    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);

    // Success toast
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const toggleChatSelection = (chatId: string) => {
        setSelectedChats((prev) =>
            prev.includes(chatId)
                ? prev.filter((id) => id !== chatId)
                : [...prev, chatId]
        );
    };

    const filteredChats = chats.filter((chat) => {
        const liveStatus = normalizeStatus(
            chatProgress[chat.id]?.status || chat.status,
        );

        const search = searchTerm.trim().toLowerCase();

        const matchesSearch =
            !search ||
            chat.title.toLowerCase().includes(search) ||
            chat.urls.some((url) => url.toLowerCase().includes(search));

        const matchesStatus = statusFilter === "all" || liveStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const loadDashboardData = useCallback(async () => {
        setError("");
        try {
            const [chatData, lifetime] = await Promise.all([getRecentChats(), getLifetimeTokens()]);
            setChats((chatData || []).map(mapBackendChat));
            const input = Number(lifetime?._sum?.inputTokens || 0);
            const output = Number(lifetime?._sum?.outputTokens || 0);
            setLifetimeTokens(input + output);

            try {
                const failedRunResponse = await getRecentFailedIngestionRuns(5);
                setFailedRuns(failedRunResponse?.runs || []);
            } catch (failedRunError) {
                console.error("Failed to load failed ingestion runs:", failedRunError);
                setFailedRuns([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        const fetchData = async () => {
            await loadDashboardData();
        };
        fetchData();
    }, [loadDashboardData]);

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    useEffect(() => {
        chatProgressRef.current = chatProgress;
    }, [chatProgress]);

    const pollStatuses = useCallback(async () => {
        const inFlightChats = chatsRef.current.filter(
            (chat) =>
                normalizeStatus(chatProgressRef.current[chat.id]?.status || chat.status) !== "ready" &&
                normalizeStatus(chatProgressRef.current[chat.id]?.status || chat.status) !== "failed",
        );

        if (!inFlightChats.length) {
            if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        const statusResults = await Promise.all(
            inFlightChats.map(async (chat) => {
                try {
                    const statusData = await getChatStatus(chat.id);
                    return {
                        id: chat.id,
                        status: normalizeStatus(statusData.progress?.status),
                        progress: clampProgress(statusData.progress?.progress),
                    };
                } catch {
                    return null;
                }
            }),
        );

        const updates = statusResults.filter(
            (item): item is { id: string; status: string; progress: number } => Boolean(item),
        );

        if (!updates.length) {
            return;
        }

        for (const update of updates) {
            if (update.status !== "ready") continue;
            const prevStatus = normalizeStatus(
                chatProgressRef.current[update.id]?.status ||
                chatsRef.current.find((c) => c.id === update.id)?.status ||
                "",
            );
            if (prevStatus !== "ready") {
                invalidatePagesIndexed(update.id);
            }
        }

        setChatProgress((prev) => {
            const next = { ...prev };
            for (const update of updates) {
                next[update.id] = {
                    status: update.status,
                    progress: update.progress,
                };
            }
            return next;
        });

        setChats((prev) =>
            prev.map((chat) => {
                const update = updates.find((item) => item.id === chat.id);
                if (!update) return chat;

                const estimatedPages =
                    chat.totalPages > 0
                        ? Math.round((update.progress / 100) * chat.totalPages)
                        : chat.pages;

                const nextPages =
                    update.status === "ready"
                        ? chat.totalPages || chat.pages
                        : Math.max(chat.pages, estimatedPages);

                return {
                    ...chat,
                    status: update.status,
                    pages: nextPages,
                };
            }),
        );
    }, []);

    const handleProgressUpdate = useCallback((chatId: string, statusData: { status: string; progress: number }) => {
        const status = normalizeStatus(statusData.status);
        const progress = clampProgress(statusData.progress);
        
        if (status === "ready") {
            const prevStatus = normalizeStatus(
                chatProgressRef.current[chatId]?.status ||
                    chatsRef.current.find((c) => c.id === chatId)?.status ||
                    ""
            );
            if (prevStatus !== "ready") {
                invalidatePagesIndexed(chatId);
            }
        }

        setChatProgress((prev) => ({
            ...prev,
            [chatId]: { status, progress }
        }));

        setChats((prev) =>
            prev.map((chat) => {
                if (chat.id !== chatId) return chat;

                const estimatedPages = chat.totalPages > 0
                    ? Math.round((progress / 100) * chat.totalPages)
                    : chat.pages;

                const nextPages = status === "ready"
                    ? chat.totalPages || chat.pages
                    : Math.max(chat.pages, estimatedPages);

                return {
                    ...chat,
                    status,
                    pages: nextPages,
                };
            })
        );
    }, []);

    useEffect(() => {
        const inFlightChats = chats.filter(
            (chat) =>
                normalizeStatus(chatProgress[chat.id]?.status || chat.status) !== "ready" &&
                normalizeStatus(chatProgress[chat.id]?.status || chat.status) !== "failed",
        );

        if (usePollingFallback) {
            // Polling Fallback Logic
            if (inFlightChats.length > 0 && pollIntervalRef.current === null) {
                pollStatuses();
                pollIntervalRef.current = window.setInterval(pollStatuses, 3000);
            } else if (inFlightChats.length === 0 && pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        } else {
            // SSE Logic
            const currentInFlightIds = new Set(inFlightChats.map(c => c.id));

            // Clean up completed/removed chats
            Object.keys(sseCleanupsRef.current).forEach(chatId => {
                if (!currentInFlightIds.has(chatId)) {
                    sseCleanupsRef.current[chatId]();
                    delete sseCleanupsRef.current[chatId];
                }
            });

            // Start SSE for new in-flight chats
            inFlightChats.forEach(chat => {
                if (!sseCleanupsRef.current[chat.id]) {
                    sseCleanupsRef.current[chat.id] = subscribeToChatStatus(
                        chat.id,
                        (progress) => handleProgressUpdate(chat.id, progress),
                        () => {
                            // On error, fallback to polling
                            setUsePollingFallback(true);
                        }
                    );
                }
            });
        }
    }, [chats, chatProgress, pollStatuses, usePollingFallback, handleProgressUpdate]);

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
            }
            const cleanups = sseCleanupsRef.current;
            Object.values(cleanups).forEach(cleanup => cleanup());
        };
    }, []);

    const handleCreateChat = async () => {
        if (!chatUrls.some(url => url.trim())) return;
        setIsCreating(true);
        setError("");
        try {
            await createChat({
                name: chatName || undefined,
                docsUrls: chatUrls.filter(Boolean),
                isVectorLess,
                scrapeLimit: scrapeLimit || undefined,
            });
            setIsModalOpen(false);
            setChatName("");
            setChatUrl("");
            setChatUrls([]);
            setIsVectorLess(false);
            setScrapeLimit("");
            showToast("Chat created and processing started.");
            await loadDashboardData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create chat.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddChatUrl = () => {
        const value = chatUrl.trim();
        if (!value) return;
        setChatUrls((prev) => (prev.includes(value) ? prev : [...prev, value]));
        setChatUrl("");
    };

    const handleRemoveChatUrl = (url: string) => {
        setChatUrls((prev) => prev.filter((item) => item !== url));
    };

    const handleDeleteChat = async () => {
        if (!deleteTarget) return;
        const title = deleteTarget.title;
        setIsDeleting(true);
        try {
            await deleteChat(deleteTarget.id);
            setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            setDeleteTarget(null);
            showToast(`"${title}" deleted successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete chat.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedChats.length) return;

        try {
            setIsDeleting(true);

            await bulkDeleteChats(selectedChats);

            setChats((prev) =>
                prev.filter((chat) => !selectedChats.includes(chat.id))
            );

            showToast(`${selectedChats.length} chats deleted`);

            setSelectedChats([]);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete selected chats."
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const openRenameModal = (chat: Chat) => {
        setRenameError("");
        setRenameTarget(chat);
        setRenameName(chat.title);
    };

    const closeRenameModal = () => {
        if (isRenaming) return;
        setRenameError("");
        setRenameTarget(null);
        setRenameName("");
    };

    const handleRenameChat = async () => {
        if (!renameTarget) return;

        const nextName = renameName.trim();
        if (!nextName) {
            setRenameError("Chat name is required.");
            return;
        }
        if (nextName.length > 100) {
            setRenameError("Chat name must be 100 characters or fewer.");
            return;
        }

        setIsRenaming(true);
        setRenameError("");
        try {
            const response = await renameChat(renameTarget.id, nextName);
            const updatedName = response?.chat?.name || nextName;
            setChats((prev) =>
                prev.map((chat) => (chat.id === renameTarget.id ? { ...chat, title: updatedName } : chat)),
            );
            setRenameTarget(null);
            setRenameName("");
            showToast(`Renamed to "${updatedName}".`);
        } catch (err) {
            setRenameError(err instanceof Error ? err.message : "Failed to rename chat.");
        } finally {
            setIsRenaming(false);
        }
    };

    const handleCancelChat = async (chatId: string) => {
        setIsCancelling(true);
        try {
            await cancelChat(chatId);
            showToast("Cancellation requested. Updating state...");
            await pollStatuses(); // Force an immediate poll to reflect READY
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to cancel chat.");
        } finally {
            setIsCancelling(false);
        }
    };

    const handleRetryFailed = async (chatId: string) => {
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) return;
        try {
            await createChat({
                name: chat.title,
                docsUrls: chat.urls,
                isVectorLess: chat.isVectorLess,
            });
            showToast(`Retrying "${chat.title}"...`);
            await loadDashboardData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to retry chat.");
        }
    };

    // Disabled state for the Start Processing button
    const isStartDisabled =
        !chatUrls.some(url => url.trim());
    const getStatusBadge = (isVectorLess: boolean, status: string) => {
        switch (status) {
            case "ready":
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400">
                        {isVectorLess ? "Vectorless" : "Vector"}
                    </div>
                );
            case "processing":
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-400">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing
                    </div>
                );
            case "failed":
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                        <AlertCircle className="w-3 h-3" /> Failed
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full relative">
                <div className="max-w-6xl mx-auto space-y-12">
                    {/* Header Section */}
                    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Your Chats</h1>
                            <p className="text-gray-400">
                                Create and manage your documentation knowledge bases.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                <span className="text-white">{chats.length}</span> chats
                            </div>
                            <button

                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white font-medium transition-colors shadow-lg shadow-accent-blue/20"
                            >
                                <Plus className="w-4 h-4" /> Create Chat
                            </button>
                        </div>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Quick Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                label: "Total Chats",
                                value: chats.length.toString(),
                                icon: <MessageSquare className="w-5 h-5 text-accent-blue" />,
                            },
                            {
                                label: "Docs Processed",
                                value: chats
                                    .filter((c) => c.status === "ready")
                                    .reduce((acc, c) => acc + c.urls.length, 0)
                                    .toString(),
                                icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
                                action: (
                                    <button
                                        onClick={() => setIsDocsListOpen(true)}
                                        className="text-xs text-accent-blue hover:text-accent-blue/80 hover:underline mt-1 block"
                                    >
                                        View List
                                    </button>
                                ),
                            },
                            {
                                label: (
                                    <span className="flex items-center gap-1.5 relative group/tooltip w-fit">
                                        Total Tokens
                                        <span className="w-3.5 h-3.5 rounded-full bg-white/10 text-[9px] flex items-center justify-center cursor-help border border-white/20 hover:bg-white/20 transition-colors">
                                            i
                                        </span>
                                        <div className="absolute bottom-full left-0 mb-2 w-48 p-2 rounded-lg bg-[#2a2a35] text-xs text-gray-200 shadow-xl border border-white/10 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 whitespace-normal normal-case font-normal tracking-normal text-left">
                                            Total tokens used for creating embeddings and retrieval.
                                        </div>
                                    </span>
                                ),
                                value: formatTokens(lifetimeTokens),
                                icon: <Database className="w-5 h-5 text-purple-400" />,
                                action: (
                                    <button
                                        onClick={() => navigate("/usage")}
                                        className="text-xs text-accent-blue hover:text-accent-blue/80 hover:underline mt-1 block"
                                    >
                                        View Details
                                    </button>
                                ),
                            },
                            {
                                label: "Failed Ingestions",
                                value: failedRuns.length.toString(),
                                icon: <AlertCircle className="w-5 h-5 text-red-400" />,
                            },
                        ].map((stat, i) => (
                            <div
                                key={i}
                                className="p-5 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between"
                            >
                                <div>
                                    <div className="text-sm text-gray-400 mb-1">
                                        {stat.label}
                                    </div>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                    {stat.action}
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                                    {stat.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Failed Ingestions Section */}
                    <div className="rounded-2xl border border-white/5 bg-white/2 p-5">
                        <div className="flex items-center justify-between mb-5 gap-4">
                            <div>
                                <h2 className="text-lg font-semibold">Recent Failed Ingestions</h2>
                                <p className="text-sm text-gray-400">
                                    Review the latest ingestion runs that did not complete successfully.
                                </p>
                            </div>
                            <div className="text-sm text-gray-400">
                                {failedRuns.length} recent failure{failedRuns.length === 1 ? "" : "s"}
                            </div>
                        </div>

                        {failedRuns.length > 0 ? (
                            <div className="grid gap-3">
                                {failedRuns.slice(0, 3).map((run) => (
                                    <div
                                        key={run.id}
                                        className="rounded-2xl border border-white/5 bg-[#0d0d12] p-4"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {run.chat?.name || run.chatId}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {run.chatSource?.heading || run.chatSourceId || "No source"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs uppercase text-red-400 tracking-[0.2em] font-semibold">
                                                    {run.status}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {fromNow(run.startedAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-gray-300 border border-white/5">
                                            {run.errorMessage || run.errorCode || "Unknown ingestion failure."}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b0b0f] p-6 text-center text-sm text-gray-400">
                                No recent failed ingestion runs were found.
                            </div>
                        )}
                    </div>

                    {/* Chat List Section */}
                    <div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                Recent Chats
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-gray-400">
                                    {filteredChats.length}
                                </span>
                            </h2>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="Search chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-[#0d0d12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue"
                                />

                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-[#0d0d12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
                                >
                                    <option value="all">All</option>
                                    <option value="ready">Ready</option>
                                    <option value="processing">Processing</option>
                                    <option value="queued">Queued</option>
                                    <option value="failed">Failed</option>
                                </select>
                            </div>
                        </div>

                        {selectedChats.length > 0 && (
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                                <span className="text-sm text-gray-300">
                                    {selectedChats.length} chat{selectedChats.length > 1 ? "s" : ""} selected
                                </span>

                                <button
                                    onClick={handleBulkDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Selected
                                </button>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="p-5 rounded-xl bg-white/2 border border-white/5"
                                    >
                                        <Skeleton className="h-4 w-24 mb-3" />
                                        <Skeleton className="h-8 w-16 mb-3" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredChats.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredChats.map((chat) => {
                                    const liveStatus = normalizeStatus(
                                        chatProgress[chat.id]?.status || chat.status,
                                    );
                                    const progressPercent =
                                        chatProgress[chat.id]?.progress ??
                                        (liveStatus === "processing" && chat.totalPages > 0
                                            ? Math.round((chat.pages / chat.totalPages) * 100)
                                            : 0);

                                    return (
                                        <div
                                            key={chat.id}
                                            className="group relative flex flex-col bg-[#0d0d12] rounded-xl border border-white/5 hover:border-white/15 p-5 transition-all hover:shadow-2xl hover:-translate-y-1"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedChats.includes(chat.id)}
                                                        onChange={() => toggleChatSelection(chat.id)}
                                                        className="mt-1"
                                                    />

                                                    <div className="truncate pr-4">
                                                        <h3
                                                            className="font-semibold text-gray-100 truncate"
                                                            title={chat.title}
                                                        >
                                                            {chat.title}
                                                        </h3>
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {chat.urls.map((u, i) => (
                                                                <a
                                                                    key={i}
                                                                    href={u}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-xs text-gray-500 hover:text-accent-blue bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 px-2 py-0.5 rounded transition-all truncate max-w-37.5"
                                                                    title={u}
                                                                >
                                                                    {(() => {
                                                                        try {
                                                                            return new URL(u).hostname;
                                                                        } catch {
                                                                            return u;
                                                                        }
                                                                    })()}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {getStatusBadge(chat.isVectorLess, liveStatus)}
                                                </div>
                                            </div>

                                            {/* Processing Progress Bar */}
                                            {(liveStatus === "processing" ||
                                                liveStatus === "queued") && (
                                                    <div className="mb-4">
                                                        {chat.isVectorLess ? (
                                                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-400 flex items-center gap-2">
                                                                Processing (vectorless)... feel free to return later.
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center justify-between text-xs mb-2">
                                                                    <span className="text-gray-400 flex items-center gap-1.5">
                                                                        <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                                                                        Ingesting pages...
                                                                    </span>
                                                                    <span className="text-yellow-400 font-medium font-mono">
                                                                        {Math.round(
                                                                            (progressPercent / 100) *
                                                                            (chat.totalPages || 0),
                                                                        )}
                                                                        /{chat.totalPages || 0}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                                    <div
                                                                        className="h-full bg-linear-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500 ease-out"
                                                                        style={{
                                                                            width: `${progressPercent}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-1.5 text-right">
                                                                    {progressPercent}% complete
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                            {/* Stats for ready/failed */}
                                            {liveStatus !== "processing" && liveStatus !== "queued" && (
                                                <div className="grid grid-cols-3 gap-2 mt-2 mb-6">
                                                    <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5">
                                                        <FileText className="w-3 h-3 text-gray-400 mb-1" />
                                                        <span className="text-xs font-medium text-gray-300">
                                                            {chat.pages}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5"
                                                        title="Tokens used"
                                                    >
                                                        <Database className="w-3 h-3 text-gray-400 mb-1" />
                                                        <span className="text-xs font-medium text-gray-300">
                                                            {formatTokens(chat.tokens)}
                                                        </span>
                                                    </div>
                                                    <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5">
                                                        <Clock className="w-3 h-3 text-gray-400 mb-1" />
                                                        <span className="text-xs font-medium text-gray-300 truncate w-full text-center">
                                                            {chat.createdAt}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-auto flex items-center gap-3 pt-4 border-t border-white/5">
                                                {liveStatus === "ready" && (
                                                    <button
                                                        onClick={() => navigate(`/chat/${chat.id}`)}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-white/10 hover:bg-white/15 text-white"
                                                    >
                                                        Open Chat
                                                    </button>
                                                )}
                                                {liveStatus === "processing" && (
                                                    <button
                                                        onClick={() => handleCancelChat(chat.id)}
                                                        disabled={isCancelling}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        {isCancelling ? "Cancelling..." : "Cancel"}
                                                    </button>
                                                )}
                                                {liveStatus === "failed" && (
                                                    <button
                                                        onClick={() => handleRetryFailed(chat.id)}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        Retry
                                                    </button>
                                                )}
                                                <button
                                                    aria-label="Rename"
                                                    onClick={() => openRenameModal(chat)}
                                                    className="p-2 rounded-lg text-gray-500 hover:text-accent-blue hover:bg-accent-blue/10 transition-colors border border-transparent hover:border-accent-blue/20"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    aria-label="Delete"
                                                    onClick={() => setDeleteTarget(chat)}
                                                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors border border-transparent hover:border-red-400/20"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Empty State */
                            <div className="rounded-2xl border border-white/5 border-dashed bg-white/1 p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                                    <Database className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">
                                    {chats.length === 0 ? "No chats found yet." : "No chats match the current search or filter."}
                                </h3>
                                <p className="text-gray-400 max-w-sm mb-6">
                                    {chats.length === 0
                                        ? "You haven't processed any documentation. Create your first knowledge base to start chatting."
                                        : "Try a different search term or clear the status filter to see more chats."}
                                </p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors border border-white/10"
                                >
                                    Create your first chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Docs List Modal */}
            {isDocsListOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsDocsListOpen(false)}
                    />
                    <div className="relative w-full max-w-lg bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/2 shrink-0">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                                Processed Documentations
                            </h2>
                            <button
                                aria-label="close docs list"
                                onClick={() => setIsDocsListOpen(false)}
                                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {chats.filter((c) => c.status === "ready").length > 0 ? (
                                chats
                                    .filter((c) => c.status === "ready")
                                    .flatMap((chat) =>
                                        chat.urls.map((url, i) => (
                                            <div
                                                key={`${chat.id}-${i}`}
                                                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-colors"
                                            >
                                                <h3 className="font-medium text-gray-200 text-sm truncate">
                                                    {chat.title}
                                                </h3>
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-accent-blue hover:underline truncate block mt-1"
                                                >
                                                    {url}
                                                </a>
                                            </div>
                                        )),
                                    )
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400">
                                        No documentations have been fully processed yet.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/5 bg-[#0b0b0f] shrink-0 text-right">
                            <button
                                onClick={() => setIsDocsListOpen(false)}
                                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Chat Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                    />

                    <div className="relative w-full max-w-md bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden lg:max-h-[90vh] overflow-y-auto custom-scrollbar">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/2 sticky top-0 z-10 backdrop-blur-md">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Plus className="w-5 h-5 text-accent-blue" />
                                New Chat
                            </h2>
                            <button
                                aria-label="close modal"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-5">
                            {/* Chat Name Input */}
                            {/* URL Inputs */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Documentation URLs <span className="text-red-400">*</span>
                                </label>

                                {chatUrls.map((url, index) => (
                                    <input
                                        key={index}
                                        type="url"
                                        value={url}
                                        onChange={(e) => {
                                            const updated = [...chatUrls];
                                            updated[index] = e.target.value;
                                            setChatUrls(updated);
                                        }}
                                        placeholder="https://docs.example.com"
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                                    />
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setChatUrls([...chatUrls, ""])}
                                    className="text-sm text-accent-blue hover:underline"
                                >
                                    + Add URL
                                </button>
                            </div>

                            {/* URL Input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300">
                                    Documentation URL <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={chatUrl}
                                    onChange={(e) => setChatUrl(e.target.value)}
                                    placeholder="https://docs.example.com"
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                                />
                                <p className="text-xs text-gray-500">
                                    Add one or more documentation URLs. We'll scrape each page and its sub-pages automatically.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleAddChatUrl}
                                    className="mt-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
                                >
                                    Add URL
                                </button>
                                {chatUrls.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {chatUrls.map((url) => (
                                            <div
                                                key={url}
                                                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
                                            >
                                                <span className="text-xs text-gray-300 truncate font-mono">{url}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveChatUrl(url)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Ingestion Mode */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Ingestion Mode</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsVectorLess(false)}
                                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${!isVectorLess
                                            ? "border-accent-blue/60 bg-accent-blue/10"
                                            : "border-white/10 bg-white/5 hover:bg-white/10"
                                            }`}
                                    >
                                        <p className="text-sm font-medium text-white">Vector</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Embeddings-based retrieval for semantic matching.
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsVectorLess(true)}
                                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${isVectorLess
                                            ? "border-accent-blue/60 bg-accent-blue/10"
                                            : "border-white/10 bg-white/5 hover:bg-white/10"
                                            }`}
                                    >
                                        <p className="text-sm font-medium text-white">Vectorless</p>
                                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                            Skips embeddings, slightly faster for unstructured docs.
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Scrape Limit */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Scrape Limit (Optional)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5000"
                                    value={scrapeLimit}
                                    onChange={(e) => setScrapeLimit(e.target.valueAsNumber || "")}
                                    placeholder="e.g. 50"
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-white/5 bg-[#0b0b0f] sticky bottom-0 z-10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateChat}
                                disabled={isStartDisabled || isCreating}
                                className="px-5 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 disabled:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-lg shadow-accent-blue/20"
                            >
                                {isCreating ? "Starting..." : "Start Processing"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeleteTarget(null)}
                    />
                    <div className="relative w-full max-w-sm bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Delete Chat?</h3>
                        <p className="text-sm text-gray-400 mb-2">
                            Are you sure you want to delete{" "}
                            <strong className="text-gray-200">"{deleteTarget.title}"</strong>?
                        </p>
                        <p className="text-xs text-gray-500 mb-6">
                            This will permanently remove all indexed pages and chat history. This action
                            cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteChat}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    "Delete"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Chat Modal */}
            {renameTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeRenameModal}
                    />
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleRenameChat();
                        }}
                        className="relative w-full max-w-sm bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl p-6 text-left"
                    >
                        <div className="w-14 h-14 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto mb-4">
                            <Pencil className="w-6 h-6 text-accent-blue" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-center">Rename Chat</h3>
                        <p className="text-sm text-gray-400 mb-4 text-center">
                            Give <strong className="text-gray-200">"{renameTarget.title}"</strong> a clearer name.
                        </p>
                        <label htmlFor="dashboard-rename-chat" className="block text-sm text-gray-300 mb-2">
                            Chat name
                        </label>
                        <input
                            id="dashboard-rename-chat"
                            type="text"
                            value={renameName}
                            onChange={(e) => {
                                setRenameName(e.target.value);
                                if (renameError) setRenameError("");
                            }}
                            maxLength={100}
                            autoFocus
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-accent-blue/50 focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                            placeholder="Enter chat name"
                        />
                        <p className="mt-2 text-xs text-gray-500">Up to 100 characters.</p>
                        {renameError && (
                            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-left text-sm text-red-400">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{renameError}</span>
                            </div>
                        )}
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={closeRenameModal}
                                disabled={isRenaming}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isRenaming || !renameName.trim() || renameName.trim().length > 100}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-blue hover:bg-accent-blue/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                            >
                                {isRenaming ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-60 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#1a1a24] border border-white/10 shadow-2xl shadow-black/40">
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-sm text-gray-200">{toast}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
