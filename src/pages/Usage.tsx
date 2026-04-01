import { useState, useMemo, useEffect, useRef } from "react";
import { Sidebar } from "../components/Sidebar";
import { Zap, TrendingUp, Key, Calendar, MessageSquare } from "lucide-react";
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
    getLifetimeTokens,
    getTopChatsByUsage,
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
    usageByModels: Array<{
        model: string;
        totalInput: number;
        totalOutput: number;
    }>;
};

type Timeframe = "day" | "week" | "month" | "year";

const MODEL_COLOR_PALETTE = [
    "rgba(59, 130, 246, 0.9)",
    "rgba(168, 85, 247, 0.9)",
    "rgba(34, 197, 94, 0.9)",
    "rgba(245, 158, 11, 0.9)",
    "rgba(236, 72, 153, 0.9)",
    "rgba(14, 165, 233, 0.9)",
];

const modelDisplayName = (model: string) => {
    if (model === "default-1") return "Qwen 3.6 plus";
    if (model === "default-2") return "Nemotron 3 Super";
    return model;
};

const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return `${tokens}`;
};

const getPlaceholderUsagePoints = (timeframe: Timeframe): UsagePoint[] => {
    const now = new Date();

    const makePoint = (date: Date): UsagePoint => ({
        period: date.toISOString(),
        usageByModels: [],
    });

    if (timeframe === "day") {
        return Array.from({ length: 24 }, (_, i) => {
            const d = new Date(now);
            d.setHours(now.getHours() - (23 - i), 0, 0, 0);
            return makePoint(d);
        });
    }

    if (timeframe === "week") {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now);
            d.setDate(now.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            return makePoint(d);
        });
    }

    if (timeframe === "month") {
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date(now);
            d.setDate(now.getDate() - (29 - i));
            d.setHours(0, 0, 0, 0);
            return makePoint(d);
        });
    }

    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        d.setHours(0, 0, 0, 0);
        return makePoint(d);
    });
};

export const Usage = () => {
    const [timeframe, setTimeframe] = useState<Timeframe>("month");
    const [usagePoints, setUsagePoints] = useState<UsagePoint[]>([]);
    const [lifetimeTotal, setLifetimeTotal] = useState(0);
    const [apiKeyCount, setApiKeyCount] = useState(0);
    const [topChats, setTopChats] = useState<Array<{ name: string; tokens: number; color: string }>>([]);
    const [error, setError] = useState("");
    const requestIdRef = useRef(0);

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
            const requestId = ++requestIdRef.current;
            setError("");
            setUsagePoints(getPlaceholderUsagePoints(timeframe));
            try {
                const [grouped, lifetime, keys, topChatsByUsage] = await Promise.all([
                    getTokensByGroup(timeframe),
                    getLifetimeTokens(),
                    getApiKeyCount(),
                    getTopChatsByUsage(),
                ]);

                if (requestId !== requestIdRef.current) return;

                const normalizedUsage = Object.values(grouped || {}).sort(
                    (a, b) =>
                        new Date(a.period).getTime() -
                        new Date(b.period).getTime(),
                );
                setUsagePoints(normalizedUsage);
                const input = lifetime?._sum?.inputTokens || 0;
                const output = lifetime?._sum?.outputTokens || 0;
                setLifetimeTotal(input + output);
                setApiKeyCount(keys.count || 0);

                const ranked = [...(topChatsByUsage || [])]
                    .map((chat) => ({
                        name:
                            chat.name?.trim() ||
                            `Deleted Chat - ${chat.chatId.slice(0, 6)}`,
                        tokens:
                            Number(chat?._sum?.inputTokens || 0) +
                            Number(chat?._sum?.outputTokens || 0),
                    }))
                    .sort((a, b) => b.tokens - a.tokens)
                    .slice(0, 3)
                    .map((item, idx) => ({
                        ...item,
                        color:
                            idx === 0
                                ? "bg-accent-blue"
                                : idx === 1
                                  ? "bg-purple-500"
                                  : "bg-green-500",
                    }));
                setTopChats(ranked);
            } catch (err) {
                if (requestId !== requestIdRef.current) return;
                setError(
                    err instanceof Error ? err.message : "Failed to load usage data.",
                );
            }
        };

        loadUsage();
    }, [timeframe]);
    
    // Chart.js Data & Options configurations
    const chartData = useMemo(() => {
        const labels = usagePoints.map((d) =>
            new Date(d.period).toLocaleDateString(),
        );

        const models = Array.from(
            new Set(
                usagePoints.flatMap((period) =>
                    period.usageByModels.map((item) => item.model),
                ),
            ),
        );

        const datasets = models.map((model, idx) => ({
            label: modelDisplayName(model),
            data: usagePoints.map((period) => {
                const modelUsage = period.usageByModels.find(
                    (item) => item.model === model,
                );
                if (!modelUsage) return 0;
                return (
                    Number(modelUsage.totalInput || 0) +
                    Number(modelUsage.totalOutput || 0)
                );
            }),
            backgroundColor:
                MODEL_COLOR_PALETTE[idx % MODEL_COLOR_PALETTE.length],
            borderRadius: 4,
            barThickness: 32,
        }));

        if (!datasets.length) {
            datasets.push({
                label: "Tokens",
                data: labels.map(() => 0),
                backgroundColor: "rgba(148, 163, 184, 0.35)",
                borderRadius: 4,
                barThickness: 32,
            });
        }

        return { labels, datasets };
    }, [usagePoints]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: {
                    color: "#9ca3af",
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
                    color: "rgba(255, 255, 255, 0)",
                    drawBorder: false,
                },
                ticks: {
                    color: "#6b7280",
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
                            <p className="text-sm text-gray-400 mt-3">
                                <strong>Usage calculation:</strong> We also add token usage from the free default models for your usage tracking.
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <p className="text-sm font-medium text-gray-400">Total Tokens (Lifetime)</p>
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
                                    {(["day", "week", "month", "year"] as const).map((t) => (
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Usage;
