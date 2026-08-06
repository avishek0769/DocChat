import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import {
    Search,
    Filter,
    FileText,
    Database,
    Clock,
    Trash2,
    Pencil,
    AlertCircle,
    Loader2,
    CheckCircle2,
    ExternalLink,
    MessageSquarePlus,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import EmptyState from "../components/EmptyState";
import { deleteChat, getChats, getChatStatus, renameChat, subscribeToChatStatus, type ChatItem } from "../lib/api";
import { formatTokens } from "../lib/format";

type ChatRow = {
    id: string;
    title: string;
    urls: string[];
    status: string;
    pages: number;
    tokens: number;
    createdAt: string;
};

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

const mapChat = (chat: ChatItem): ChatRow => {
    const source = chat.chatSources?.[0];
    const pages = source?._count?.pagesIndexed ?? source?.pagesIndexed?.length ?? 0;
    return {
        id: chat.id,
        title: chat.name,
        urls: (chat.chatSources || []).map((s) => s.documentationUrl),
        status: String(chat.status || "QUEUED").toLowerCase(),
        pages,
        tokens: chat.totalUsage?.total || 0,
        createdAt: fromNow(chat.createdAt),
    };
};

const AllChats = () => {
    const navigate = useNavigate();
    const [chats, setChats] = useState<ChatRow[]>([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState<ChatRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [renameTarget, setRenameTarget] = useState<ChatRow | null>(null);
    const [renameName, setRenameName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const isCancellingRef = useRef(false);

    const loadChats = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await getChats({ limit: 25 });
            setChats((res.chats || []).map(mapChat));
            setHasMore(res.hasMore);
            setNextCursor(res.nextCursor);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chats.");
        } finally {
            setIsLoading(false);
        }
    };

    const loadMore = async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const res = await getChats({ limit: 25, cursor: nextCursor });
            setChats((prev) => [...prev, ...(res.chats || []).map(mapChat)]);
            setHasMore(res.hasMore);
            setNextCursor(res.nextCursor);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load more chats.");
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadChats();
    }, []);

    const [usePollingFallback, setUsePollingFallback] = useState(false);
    const sseCleanupsRef = useRef<Record<string, () => void>>({});
    const pollIntervalRef = useRef<number | null>(null);

    const handleProgressUpdate = useCallback((chatId: string, statusData: { status: string }) => {
        const status = String(statusData.status || "QUEUED").toLowerCase();
        setChats((prev) =>
            prev.map((chat) => (chat.id === chatId ? { ...chat, status } : chat))
        );
    }, []);

    const pollStatuses = useCallback(async () => {
        const inFlightChats = chats.filter((c) => c.status === "processing" || c.status === "queued");
        if (!inFlightChats.length) {
            if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        const updates = await Promise.all(
            inFlightChats.map(async (chat) => {
                try {
                    const statusData = await getChatStatus(chat.id);
                    return { id: chat.id, status: String(statusData.progress?.status || "QUEUED").toLowerCase() };
                } catch {
                    return null;
                }
            })
        );

        setChats((prev) =>
            prev.map((chat) => {
                const update = updates.find((u) => u?.id === chat.id);
                if (!update) return chat;
                return { ...chat, status: update.status };
            })
        );
    }, [chats]);

    useEffect(() => {
        const inFlightChats = chats.filter((c) => c.status === "processing" || c.status === "queued");

        if (usePollingFallback) {
            if (inFlightChats.length > 0 && pollIntervalRef.current === null) {
                pollStatuses();
                pollIntervalRef.current = window.setInterval(pollStatuses, 3000);
            } else if (inFlightChats.length === 0 && pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        } else {
            const currentInFlightIds = new Set(inFlightChats.map((c) => c.id));

            Object.keys(sseCleanupsRef.current).forEach((chatId) => {
                if (!currentInFlightIds.has(chatId)) {
                    sseCleanupsRef.current[chatId]();
                    delete sseCleanupsRef.current[chatId];
                }
            });

            inFlightChats.forEach((chat) => {
                if (!sseCleanupsRef.current[chat.id]) {
                    sseCleanupsRef.current[chat.id] = subscribeToChatStatus(
                        chat.id,
                        (progress) => handleProgressUpdate(chat.id, progress),
                        () => setUsePollingFallback(true)
                    );
                }
            });
        }
    }, [chats, usePollingFallback, handleProgressUpdate, pollStatuses]);

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
            }
            const cleanups = sseCleanupsRef.current;
            Object.values(cleanups).forEach(cleanup => cleanup());
        };
    }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        setDeleteError("");
        setError("");
        try {
            await deleteChat(deleteTarget.id);
            setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Failed to delete chat.");
        } finally {
            setIsDeleting(false);
        }
    };

    const startRename = (chat: ChatRow) => {
        setRenameTarget(chat);
        setRenameName(chat.title);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        } else if (e.key === "Escape") {
            isCancellingRef.current = true;
            setRenameTarget(null);
            setRenameName("");
        }
    };

    const handleRename = async () => {
        if (!renameTarget) return;

        const nextName = renameName.trim();
        if (!nextName || nextName === renameTarget.title) {
            setRenameTarget(null);
            setRenameName("");
            return;
        }

        setIsRenaming(true);
        setError("");
        try {
            const response = await renameChat(renameTarget.id, nextName);
            const updatedName = response?.chat?.name || nextName;
            setChats((prev) =>
                prev.map((chat) => (chat.id === renameTarget.id ? { ...chat, title: updatedName } : chat)),
            );
            setRenameTarget(null);
            setRenameName("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to rename chat.");
        } finally {
            setIsRenaming(false);
        }
    };

    const openDeleteModal = (chat: ChatRow) => {
        setDeleteError("");
        setDeleteTarget(chat);
    };

    const closeDeleteModal = () => {
        if (isDeleting) return;
        setDeleteError("");
        setDeleteTarget(null);
    };

    const filteredChats = chats.filter((chat) => {
        const matchesSearch =
            chat.title.toLowerCase().includes(search.toLowerCase()) ||
            chat.urls.some((u) => u.toLowerCase().includes(search.toLowerCase()));
        const matchesFilter = filter === "all" || chat.status === filter;
        return matchesSearch && matchesFilter;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ready":
                return (
                    <div
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-colors"
                        title="Ready"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                );
            case "processing":
                return (
                    <div
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition-colors"
                        title="Processing"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                );
            case "failed":
                return (
                    <div
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors"
                        title="Failed"
                    >
                        <AlertCircle className="w-4 h-4" />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full relative">
                <div className="max-w-5xl mx-auto space-y-8">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">All Chats</h1>
                        <p className="text-gray-400 text-sm">
                            Browse and manage all your indexed documentation.
                        </p>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 mb-8">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search by name or URL..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-[#111] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50"
                            />
                        </div>
                        <div className="relative shrink-0">
                            <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                title="Filter by Status"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-[#111] border border-white/10 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none cursor-pointer"
                            >
                                <option value="all">All Status</option>
                                <option value="ready">Ready</option>
                                <option value="processing">Processing</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="space-y-3">
  {[1,2,3,4,5,6].map((i) => (
    <div
      key={i}
      className="flex items-center justify-between bg-white/2 border border-white/5 p-4 rounded-xl"
    >
      <div className="flex items-center gap-4 flex-1">
        <Skeleton className="w-6 h-6 rounded-full" />

        <div className="flex-1">
          <Skeleton className="h-4 w-48 mb-2" />

          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  ))}
</div>
                        ) : filteredChats.length > 0 ? (
                            filteredChats.map((chat) => (
                                <div
                                    key={chat.id}
                                    className="group relative flex items-center justify-between bg-white/2 hover:bg-white/4 border border-white/5 hover:border-white/10 p-4 rounded-xl transition-all"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        {getStatusBadge(chat.status)}
                                        <div className="min-w-0">
                                            {renameTarget?.id === chat.id ? (
                                                <input
                                                    type="text"
                                                    value={renameName}
                                                    onChange={(e) => setRenameName(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    onBlur={() => {
                                                        if (isCancellingRef.current) {
                                                            isCancellingRef.current = false;
                                                            return;
                                                        }
                                                        handleRename();
                                                    }}
                                                    disabled={isRenaming}
                                                    autoFocus
                                                    maxLength={100}
                                                    className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50 focus:border-accent-blue/50 w-full max-w-[240px]"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 group/title truncate">
                                                    <h3 className="font-medium text-gray-200 truncate">
                                                        {chat.title}
                                                    </h3>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startRename(chat);
                                                        }}
                                                        className="p-1 rounded text-gray-500 hover:text-accent-blue hover:bg-white/5 transition-colors opacity-0 group-hover/title:opacity-100 focus:opacity-100"
                                                        title="Rename Chat"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {chat.urls.map((u, i) => (
                                                    <a
                                                        key={i}
                                                        href={u}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-gray-500 hover:text-accent-blue flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 px-2 py-0.5 rounded transition-all truncate max-w-37.5"
                                                        title={u}
                                                    >
                                                        {(() => {
                                                            try {
                                                                return new URL(u).hostname;
                                                            } catch {
                                                                return u;
                                                            }
                                                        })()}{" "}
                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0 ml-4">
                                        <div className="hidden md:flex items-center gap-6">
                                            <div
                                                className="flex items-center gap-1.5 text-xs text-gray-400 w-16"
                                                title="Pages Indexed"
                                            >
                                                <FileText className="w-3.5 h-3.5" /> {chat.pages}
                                            </div>
                                            <div
                                                className="flex items-center gap-1.5 text-xs text-gray-400 w-20"
                                                title="Tokens used"
                                            >
                                                <Database className="w-3.5 h-3.5" />{" "}
                                                {formatTokens(chat.tokens)}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 w-24">
                                                <Clock className="w-3.5 h-3.5" /> {chat.createdAt}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 border-l border-white/10 pl-6">
                                            <button
                                                onClick={() => navigate(`/chat/${chat.id}`)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                    chat.status === "ready"
                                                        ? "bg-white/10 hover:bg-white/15 text-white"
                                                        : "bg-white/5 text-gray-600 cursor-not-allowed hidden sm:block"
                                                }`}
                                                disabled={chat.status !== "ready"}
                                            >
                                                Open
                                            </button>
                                            <button
                                                title="Delete Chat"
                                                onClick={() => openDeleteModal(chat)}
                                                className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyState
                                icon={<MessageSquarePlus className="w-12 h-12" />}
                                title="No chats yet"
                                description="Create your first documentation chat from the dashboard and start exploring your indexed content."
                                actionLabel="Go to Dashboard"
                                onAction={() => navigate("/")}
                            />
                        )}
                    </div>
                </div>

                {hasMore && !isLoading && (
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={loadMore}
                            disabled={isLoadingMore}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                "Load More"
                            )}
                        </button>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={closeDeleteModal}
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
                            {deleteError && (
                                <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-left text-sm text-red-400">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{deleteError}</span>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={closeDeleteModal}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
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

            </main>
        </div>
    );
};

export default AllChats;
