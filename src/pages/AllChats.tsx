import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import {
    Search,
    Filter,
    FileText,
    Database,
    Clock,
    Trash2,
    AlertCircle,
    Loader2,
    CheckCircle2,
    ExternalLink,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { deleteChat, getChats, type ChatItem } from "../lib/api";
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
    const [error, setError] = useState("");

    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState<ChatRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const loadChats = async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await getChats();
            setChats((data || []).map(mapChat));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chats.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadChats();
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
                                            <h3 className="font-medium text-gray-200 truncate">
                                                {chat.title}
                                            </h3>
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
                            <div className="text-center py-20 bg-white/1 rounded-xl border border-white/5 border-dashed">
                                <Database className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">No chats found.</p>
                            </div>
                        )}
                    </div>
                </div>

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
