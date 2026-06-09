import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { getAdminIngestion } from "../lib/api";

const AdminIngestion = () => {
    const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
    const [data, setData] = useState<Awaited<ReturnType<typeof getAdminIngestion>> | null>(null);

    useEffect(() => { getAdminIngestion(range).then(setData).catch(() => setData(null)); }, [range]);

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans"><Sidebar /><main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full"><div className="max-w-6xl mx-auto space-y-8">
            <header className="flex items-end justify-between"><div><h1 className="text-3xl font-bold mb-2">Ingestion</h1><p className="text-gray-400 text-sm">Ingestion health and failures.</p></div><div className="flex gap-2">{(["24h","7d","30d"] as const).map((r)=><button key={r} onClick={()=>setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs ${range===r?"bg-white/10":"bg-white/5"}`}>{r}</button>)}</div></header>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "READY", value: data?.READY || 0 },
                    { label: "FAILED", value: data?.FAILED || 0 },
                    { label: "PROCESSING", value: data?.PROCESSING || 0 },
                    { label: "QUEUED", value: data?.QUEUED || 0 },
                ].map((s) => (
                    <div key={s.label} className="p-5 rounded-xl bg-white/2 border border-white/5">
                        <p className="text-gray-400 text-sm">{s.label}</p>
                        <p className="text-3xl font-bold mt-2">{s.value}</p>
                    </div>
                ))}
            </section>
            <section className="p-6 rounded-xl bg-white/2 border border-white/5"><h2 className="text-lg font-semibold mb-4">Failed Runs</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-400 border-b border-white/5"><th className="text-left pb-3">Chat</th><th className="text-left pb-3">Status</th><th className="text-left pb-3">Error</th></tr></thead><tbody className="divide-y divide-white/5">{(data?.recentFailedIngestionRuns||[]).map((run)=><tr key={run.id}><td className="py-3">{run.chatId||run.id}</td><td className="py-3 text-gray-400">{run.status}</td><td className="py-3 text-gray-400">{run.errorMessage||run.errorCode||"—"}</td></tr>)}</tbody></table></div></section>
        </div></main></div>
    );
};

export default AdminIngestion;
