import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "../components/Sidebar";
import { Zap, TrendingUp, Key, Calendar, ArrowUpRight, DollarSign, MessageSquare, Info } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
    getApiKeyCount,
    getChats,
    getLifetimeTokens,
    getTokensByGroup,
} from "../lib/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type UsagePoint = {
    period: string;
    totalInput: number;
    totalOutput: number;
};

const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return `${tokens}`;
};

export const Usage = () => {
    const [timeframe, setTimeframe] = useState<"day" | "week" | "month">("month");
    const [usagePoints, setUsagePoints] = useState<UsagePoint[]>([]);
    const [lifetimeTotal, setLifetimeTotal] = useState(0);
    const [apiKeyCount, setApiKeyCount] = useState(0);
    const [topChats, setTopChats] = useState<Array<{ name: string; tokens: number; cost: string; color: string }>>([]);
    const [error, setError] = useState("");

    const cycleLabel = useMemo(() => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const fmt = (d: Date) =>
            d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `${fmt(first)} - ${fmt(last)}`;
    }, []);

    useEffect(() => {
        const loadUsage = async () => {
            setError("");
            try {
                const [grouped, lifetime, keys, chats] = await Promise.all([
                    getTokensByGroup(timeframe),
                    getLifetimeTokens(),
                    getApiKeyCount(),
                    getChats(),
                ]);
                setUsagePoints(grouped || []);
                const input = lifetime?._sum?.inputTokens || 0;
                const output = lifetime?._sum?.outputTokens || 0;
                setLifetimeTotal(input + output);
                setApiKeyCount(keys.count || 0);

                const ranked = [...(chats || [])]
                    .map((chat) => ({
                        name: chat.name,
                        tokens: chat.totalUsage?.total || 0,
                    }))
                    .sort((a, b) => b.tokens - a.tokens)
                    .slice(0, 3)
                    .map((item, idx) => ({
                        ...item,
                        cost: `$${(item.tokens / 100000).toFixed(2)}`,
                        color:
                            idx === 0
                                ? "bg-accent-blue"
                                : idx === 1
                                  ? "bg-purple-500"
                                  : "bg-green-500",
                    }));
                setTopChats(ranked);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load usage data.",
                );
            }
        };

        loadUsage();
    }, [timeframe]);
    
    // Chart.js Data & Options configurations
    const chartData = useMemo(() => ({
        labels: usagePoints.map((d) => new Date(d.period).toLocaleDateString()),
        datasets: [
            {
                label: "Input Tokens",
                data: usagePoints.map((d) => d.totalInput),
                backgroundColor: "rgba(34, 197, 94, 0.9)", // green-500
                borderRadius: 4,
                barThickness: 32,
            },
            {
                label: "Output Tokens",
                data: usagePoints.map((d) => d.totalOutput),
                backgroundColor: "rgba(168, 85, 247, 0.9)", // purple-500
                borderRadius: 4,
                barThickness: 32,
            },
        ],
    }), [usagePoints]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: {
                    color: "#9ca3af", // gray-400
                    usePointStyle: true,
                    padding: 24,
                    font: {
                        family: "ui-sans-serif, system-ui, sans-serif",
                        size: 13,
                    },
                },
            },
            tooltip: {
                backgroundColor: "#1a1a24",
                titleColor: "#f3f4f6",
                bodyColor: "#d1d5db",
                borderColor: "rgba(255,255,255,0.1)",
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    label: function(context: TooltipItem<"bar">) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', {
                                notation: "compact",
                                compactDisplay: "short"
                            }).format(context.parsed.y) + ' Tokens';
                        }
                        return label;
                    }
                }
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    color: "rgba(255, 255, 255, 0)", // Hide x-axis vertical lines
                    drawBorder: false,
                },
                ticks: {
                    color: "#6b7280", // gray-500
                    font: {
                        family: "ui-sans-serif, system-ui, sans-serif",
                    }
                },
                border: {
                    display: false
                }
            },
            y: {
                stacked: true,
                grid: {
                    color: "rgba(255, 255, 255, 0.05)",
                    drawBorder: false,
                },
                ticks: {
                    color: "#6b7280", // gray-500
                    font: {
                        family: "ui-sans-serif, system-ui, sans-serif",
                    },
                    callback: function(value: string | number) {
                        const num = Number(value);
                        if (num >= 1000000) return (num / 1000000) + "M";
                        if (num >= 1000) return (num / 1000) + "k";
                        return num;
                    },
                    maxTicksLimit: 6,
                },
                border: {
                    display: false
                }
            },
        },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
    }), []);
    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full relative">
                <div className="max-w-5xl mx-auto space-y-10">
                    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Usage Metrics</h1>
                            <p className="text-gray-400 text-sm">
                                Track your token consumption across different models and API keys.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-200">Current Cycle: <strong className="text-white">{cycleLabel}</strong></span>
                        </div>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <p className="text-sm font-medium text-gray-400">Total Tokens (Current Month)</p>
                                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                                    <Zap className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-white mb-2">{formatTokens(lifetimeTotal)}</h3>
                                <p className="text-xs text-gray-500 font-medium">Lifetime token usage</p>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <p className="text-sm font-medium text-gray-400">Active API Keys</p>
                                <div className="p-2.5 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                                    <Key className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-white mb-2">{apiKeyCount}</h3>
                                <p className="text-xs text-gray-500 font-medium">
                                    Active keys in your account
                                </p>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-6">
                                <p className="text-sm font-medium text-gray-400">Estimated Cost</p>
                                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
                                <p className="text-xs text-gray-500 font-medium">
                                    Cost forecasting will be available in an upcoming release.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Token Usage Chart */}
                        <div className="lg:col-span-2 p-6 rounded-xl bg-white/2 border border-white/5 flex flex-col">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-accent-blue" />
                                    Token Usage
                                </h3>
                                
                                <div className="flex bg-[#111] border border-white/10 rounded-lg p-1">
                                    {(["day", "week", "month"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTimeframe(t)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                                                timeframe === t 
                                                    ? "bg-white/10 text-white" 
                                                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex-1 w-full min-h-75">
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-start gap-2 text-xs text-gray-500">
                                <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                                <p>
                                    <strong>Usage calculation:</strong> The token counts shown above represent the combined sum of both <em>embeddings tokens</em> (used when initially processing docs) and <em>retrieval tokens</em> (used during chat generation).
                                </p>
                            </div>
                        </div>

                        {/* Top Chats Breakdown */}
                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 flex flex-col">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-accent-blue" />
                                Top 3 Chats
                            </h3>

                            <div className="space-y-6 flex-1">
                                {topChats.map((chat, i) => (
                                    <div key={i} className="space-y-2.5">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-200 truncate pr-2" title={chat.name}>{chat.name}</span>
                                            <span className="text-gray-300 font-mono font-medium shrink-0">{(chat.tokens / 1000).toFixed(0)}k</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className={`h-full ${chat.color} rounded-full`} 
                                                style={{ width: `${Math.min(100, (chat.tokens / Math.max(1, topChats[0]?.tokens || 1)) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Est. Cost</span>
                                            <span className="text-gray-400">{chat.cost}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-8 pt-5 border-t border-white/5 text-center">
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                    Values are estimates based on standard model pricing. Check your provider for exact billing.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Usage;
