import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { getAdminUser, type AdminUserDetailResponse } from "../lib/api";
import { formatTokens } from "../lib/format";

const AdminUserDetail = () => {
    const { userId = "" } = useParams();
    const [data, setData] = useState<AdminUserDetailResponse | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setData(await getAdminUser(userId));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load user detail.");
            }
        };
        if (userId) load();
    }, [userId]);

    const user = data?.user;

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans">
            <Sidebar />
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-6xl mx-auto space-y-8">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">User Detail</h1>
                        <p className="text-gray-400 text-sm">Profile, activity, chats, and token usage.</p>
                    </header>
                    {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                    <section className="p-6 rounded-xl bg-white/2 border border-white/5">
                        <h2 className="text-lg font-semibold mb-4">{user?.fullname || user?.username || "Unknown User"}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><p className="text-gray-500">Email</p><p>{user?.email || "—"}</p></div>
                            <div><p className="text-gray-500">Role</p><p>{user?.isAdmin ? "Admin" : "User"}</p></div>
                            <div><p className="text-gray-500">Total Tokens</p><p>{formatTokens(user?.totalTokens || 0)}</p></div>
                        </div>
                    </section>
                    <section className="p-6 rounded-xl bg-white/2 border border-white/5">
                        <h2 className="text-lg font-semibold mb-4">Recent Chats</h2>
                        <div className="space-y-2">
                            {(data?.recentChats || []).map((chat) => (
                                <div key={chat.id} className="flex justify-between rounded-lg border border-white/5 bg-white/2 px-4 py-3">
                                    <span>{chat.name}</span>
                                    <span className="text-gray-400">{String(chat.status)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="p-6 rounded-xl bg-white/2 border border-white/5">
                        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                        <div className="space-y-2">
                            {(data?.recentActivity || []).map((item) => (
                                <div key={item.id} className="flex justify-between rounded-lg border border-white/5 bg-white/2 px-4 py-3">
                                    <span>{item.type}</span>
                                    <span className="text-gray-400">{item.detail || item.title || "—"}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="p-6 rounded-xl bg-white/2 border border-white/5">
                        <h2 className="text-lg font-semibold mb-4">Token Usage Breakdown</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-gray-400 border-b border-white/5"><th className="text-left pb-3">Model</th><th className="text-right pb-3">Input</th><th className="text-right pb-3">Output</th><th className="text-right pb-3">Total</th></tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {(data?.usageBreakdown || []).map((item) => (
                                        <tr key={item.model}>
                                            <td className="py-3">{item.model}</td>
                                            <td className="py-3 text-right">{formatTokens(item.totalInputTokens)}</td>
                                            <td className="py-3 text-right">{formatTokens(item.totalOutputTokens)}</td>
                                            <td className="py-3 text-right">{formatTokens(item.totalTokens)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AdminUserDetail;
