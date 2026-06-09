import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { getAdminUsage } from "../lib/api";
import { formatTokens } from "../lib/format";

const AdminUsage = () => {
    const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
    const [data, setData] = useState<Awaited<ReturnType<typeof getAdminUsage>> | null>(null);
    useEffect(() => { getAdminUsage(range).then(setData).catch(() => setData(null)); }, [range]);
    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans"><Sidebar /><main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full"><div className="max-w-6xl mx-auto space-y-8">
            <header className="flex items-end justify-between"><div><h1 className="text-3xl font-bold mb-2">Usage</h1><p className="text-gray-400 text-sm">Token usage by users and models.</p></div><div className="flex gap-2">{(["24h","7d","30d"] as const).map((r)=><button key={r} onClick={()=>setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs ${range===r?"bg-white/10":"bg-white/5"}`}>{r}</button>)}</div></header>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">{[{label:"Input",value:data?.totalInputTokens||0},{label:"Output",value:data?.totalOutputTokens||0}].map((item)=><div key={item.label} className="p-5 rounded-xl bg-white/2 border border-white/5"><p className="text-gray-400 text-sm">{item.label}</p><p className="text-3xl font-bold mt-2">{formatTokens(item.value)}</p></div>)}</section>
            <section className="p-6 rounded-xl bg-white/2 border border-white/5"><h2 className="text-lg font-semibold mb-4">Top Users</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-400 border-b border-white/5"><th className="text-left pb-3">User</th><th className="text-right pb-3">Requests</th><th className="text-right pb-3">Input</th><th className="text-right pb-3">Output</th></tr></thead><tbody className="divide-y divide-white/5">{(data?.topUsersByTokenUsage||[]).map((u)=><tr key={u.userId||u.username||u.fullname||Math.random()}><td className="py-3">{u.fullname||u.username||u.userId||"—"}</td><td className="py-3 text-right">{u.requestCount}</td><td className="py-3 text-right">{formatTokens(u.inputTokens)}</td><td className="py-3 text-right">{formatTokens(u.outputTokens)}</td></tr>)}</tbody></table></div></section>
            <section className="p-6 rounded-xl bg-white/2 border border-white/5"><h2 className="text-lg font-semibold mb-4">Top Models</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-400 border-b border-white/5"><th className="text-left pb-3">Model</th><th className="text-right pb-3">Requests</th><th className="text-right pb-3">Input</th><th className="text-right pb-3">Output</th></tr></thead><tbody className="divide-y divide-white/5">{(data?.topModelsByTokenUsage||[]).map((m)=><tr key={m.model}><td className="py-3">{m.model}</td><td className="py-3 text-right">{m.requestCount}</td><td className="py-3 text-right">{formatTokens(m.inputTokens)}</td><td className="py-3 text-right">{formatTokens(m.outputTokens)}</td></tr>)}</tbody></table></div></section>
        </div></main></div>
    );
};

export default AdminUsage;
