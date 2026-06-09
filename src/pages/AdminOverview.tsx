import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { getAdminOverview, type AdminOverviewData } from "../lib/api";
import { Activity, CalendarDays, Users, Database, MessageSquare } from "lucide-react";

const ranges = ["24h", "7d", "30d"] as const;

const AdminOverview = () => {
    const [range, setRange] = useState<(typeof ranges)[number]>("24h");
    const [data, setData] = useState<AdminOverviewData>({});
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
                setError("");
                try {
                setData(await getAdminOverview(range));
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to load admin overview.");
                }
        };
        load();
    }, [range]);

    const kpis = [
        { label: "Users", value: data.totalUsers || 0 },
        { label: "Chats", value: data.totalChats || 0 },
        { label: "Messages", value: data.totalMessages || 0 },
        { label: "Usage Events", value: data.totalUsageEvents || 0 },
    ];
    const recent = data.latestAuditEvents || [];

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-6xl mx-auto space-y-8">
                    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Admin Overview</h1>
                            <p className="text-gray-400 text-sm">Platform health and recent activity.</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
                            {ranges.map((item) => (
                                <button
                                    key={item}
                                    onClick={() => setRange(item)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize ${
                                        range === item
                                            ? "bg-white/10 text-white"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {kpis.map((item, idx) => {
                            const icons = [Users, MessageSquare, Database, Activity];
                            const Icon = icons[idx % icons.length];
                            return (
                                <div key={item.label} className="p-5 rounded-xl bg-white/2 border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm text-gray-400">{item.label}</p>
                                        <Icon className="w-5 h-5 text-accent-blue" />
                                    </div>
                                    <p className="text-3xl font-bold">{Number(item.value || 0).toLocaleString()}</p>
                                </div>
                            );
                        })}
                    </section>

                    <section className="p-6 rounded-xl bg-white/2 border border-white/5">
                        <div className="flex items-center gap-2 mb-5">
                            <CalendarDays className="w-5 h-5 text-accent-blue" />
                            <h2 className="text-lg font-semibold">Recent Activity</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 border-b border-white/5">
                                    <th className="text-left pb-3 font-medium">Type</th>
                                        <th className="text-left pb-3 font-medium">User ID</th>
                                        <th className="text-left pb-3 font-medium">Chat ID</th>
                                        <th className="text-left pb-3 font-medium">Metadata</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recent.length ? recent.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/2">
                                            <td className="py-3 text-gray-300">{item.type}</td>
                                            <td className="py-3 text-gray-400">{item.userId || "—"}</td>
                                            <td className="py-3 text-gray-400">{item.chatId || "—"}</td>
                                            <td className="py-3 text-gray-400">{item.metadata ? JSON.stringify(item.metadata) : "—"}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="py-10 text-center text-gray-500">
                                                No recent activity.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AdminOverview;
