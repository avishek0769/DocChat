import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

import {
    MessageSquare,
    Plus,
    FileText,
    Database,
    Clock,
    Trash2,
    AlertCircle,
    Loader2,
    CheckCircle2,
    X,
    RefreshCw,
} from "lucide-react";
import {
    createChat,
    deleteChat,
    getChatStatus,
    getLifetimeTokens,
    getRecentChats,
    type ChatItem,
} from "../lib/api";

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
    const [lifetimeTokens, setLifetimeTokens] = useState(0);
    const [chatProgress, setChatProgress] = useState<
        Record<string, { status: string; progress: number }>
    >({});
    const chatsRef = useRef<Chat[]>([]);
    const chatProgressRef = useRef<Record<string, { status: string; progress: number }>>({});
    const pollIntervalRef = useRef<number | null>(null);

    // New Chat Form State
    const [chatName, setChatName] = useState("");
    const [chatUrl, setChatUrl] = useState("");
    const [isVectorLess, setIsVectorLess] = useState(false);

    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);

    // Success toast
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const loadDashboardData = useCallback(async () => {
        setError("");
        try {
            const [chatData, lifetime] = await Promise.all([getRecentChats(), getLifetimeTokens()]);
            setChats((chatData || []).map(mapBackendChat));
            const input = Number(lifetime?._sum?.inputTokens || 0);
            const output = Number(lifetime?._sum?.outputTokens || 0);
            setLifetimeTokens(input + output);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();
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

    useEffect(() => {
        const hasInFlightChats = chats.some(
            (chat) =>
                normalizeStatus(chatProgress[chat.id]?.status || chat.status) !== "ready" &&
                normalizeStatus(chatProgress[chat.id]?.status || chat.status) !== "failed",
        );

        if (hasInFlightChats && pollIntervalRef.current === null) {
            pollStatuses();
            pollIntervalRef.current = window.setInterval(pollStatuses, 3000);
        }

        if (!hasInFlightChats && pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, [chats, chatProgress, pollStatuses]);

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const handleCreateChat = async () => {
        if (!chatUrl) return;
        setIsCreating(true);
        setError("");
        try {
            await createChat({
                name: chatName || undefined,
                docsUrl: chatUrl,
                isVectorLess,
            });
            setIsModalOpen(false);
            setChatName("");
            setChatUrl("");
            setIsVectorLess(false);
            showToast("Chat created and processing started.");
            await loadDashboardData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create chat.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteChat = async () => {
        if (!deleteTarget) return;
        const title = deleteTarget.title;
        try {
            await deleteChat(deleteTarget.id);
            setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            setDeleteTarget(null);
            showToast(`"${title}" deleted successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete chat.");
        }
    };

    const handleRetryFailed = async (chatId: string) => {
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) return;
        try {
            await createChat({
                name: chat.title,
                docsUrl: chat.urls[0] || chatUrl,
                isVectorLess: chat.isVectorLess,
            });
            showToast(`Retrying "${chat.title}"...`);
            await loadDashboardData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to retry chat.");
        }
    };

    // Disabled state for the Start Processing button
    const isStartDisabled = !chatUrl;

    const formatTokens = (tokens: number) => {
        if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + "M";
        if (tokens >= 1000) return (tokens / 1000).toFixed(1) + "k";
        return tokens.toString();
    };

    const getStatusBadge = (isVectorLess: boolean, status: string) => {
        switch (status) {
            case "ready":
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400">
                        {isVectorLess? "Vectorless" : "Vector"}
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
                        ].map((stat, i) => (
                            <div
                                key={i}
                                className="p-5 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                    {stat.action}
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                                    {stat.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chat List Section */}
                    <div>
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            Recent Chats{" "}
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-gray-400">
                                {chats.length}
                            </span>
                        </h2>

                        {isLoading ? (
                            <div className="p-8 text-center bg-white/1 border border-white/5 border-dashed rounded-xl text-sm text-gray-400">
                                Loading chats...
                            </div>
                        ) : chats.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {chats.map((chat) => {
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
                                                <div className="shrink-0">
                                                    {getStatusBadge(chat.isVectorLess,liveStatus)}
                                                </div>
                                            </div>

                                            {/* Processing Progress Bar */}
                                            {(liveStatus === "processing" ||
                                                liveStatus === "queued") && (
                                                <div className="mb-4">
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
                                                        disabled
                                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-white/10 text-white/40 cursor-not-allowed opacity-50"
                                                    >
                                                        Open Chat
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
                                <h3 className="text-xl font-semibold mb-2">No chats yet</h3>
                                <p className="text-gray-400 max-w-sm mb-6">
                                    You haven't processed any documentation. Create your first knowledge
                                    base to start chatting.
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
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-5">
                            {/* Chat Name Input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300">
                                    Chat Name{" "}
                                    <span className="text-gray-500 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={chatName}
                                    onChange={(e) => setChatName(e.target.value)}
                                    placeholder="e.g. React Docs 18.2"
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                />
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
                                    We'll scrape this page and sub-pages automatically.
                                </p>
                            </div>

                            {/* Ingestion Mode */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Ingestion Mode</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsVectorLess(false)}
                                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                            !isVectorLess
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
                                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                            isVectorLess
                                                ? "border-accent-blue/60 bg-accent-blue/10"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white">Vectorless</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Tree based retrieval without embeddings.
                                        </p>
                                    </button>
                                </div>
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
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteChat}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
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
