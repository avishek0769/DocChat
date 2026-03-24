import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

// Mock Data
const MOCK_CHATS = [
    {
        id: "1",
        title: "React Documentation",
        urls: ["https://react.dev/reference", "https://reactrouter.com/en/main"],
        status: "ready",
        pages: 142,
        size: "1.2 MB",
        updatedAt: "2 hours ago",
    },
    {
        id: "2",
        title: "Stripe API Reference",
        urls: ["https://docs.stripe.com/api"],
        status: "processing",
        pages: 45,
        size: "...",
        updatedAt: "Just now",
    },
    {
        id: "3",
        title: "Legacy Internal Docs",
        urls: ["https://wiki.internal.dev/v1"],
        status: "failed",
        pages: 0,
        size: "0 B",
        updatedAt: "2 days ago",
    },
    {
        id: "4",
        title: "Tailwind CSS v4",
        urls: ["https://tailwindcss.com/docs"],
        status: "ready",
        pages: 89,
        size: "840 KB",
        updatedAt: "1 week ago",
    },
];

const AllChats = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    const filteredChats = MOCK_CHATS.filter((chat) => {
        const matchesSearch =
            chat.title.toLowerCase().includes(search.toLowerCase()) ||
            chat.urls.some(u => u.toLowerCase().includes(search.toLowerCase()));
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

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-5xl mx-auto space-y-8">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">All Chats</h1>
                        <p className="text-gray-400 text-sm">
                            Browse and manage all your indexed documentation.
                        </p>
                    </header>

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
                        {filteredChats.length > 0 ? (
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
                                                        {(() => { try { return new URL(u).hostname; } catch { return u; } })()} <ExternalLink className="w-3 h-3 shrink-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0 ml-4">
                                        <div className="hidden md:flex items-center gap-6">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 w-16">
                                                <FileText className="w-3.5 h-3.5" />{" "}
                                                {chat.pages}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 w-24">
                                                <Clock className="w-3.5 h-3.5" />{" "}
                                                {chat.updatedAt}
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
                                                disabled={
                                                    chat.status !== "ready"
                                                }
                                            >
                                                Open
                                            </button>
                                            <button className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
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
            </main>
        </div>
    );
};

export default AllChats;
