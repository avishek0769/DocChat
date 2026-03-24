import { useState, useMemo } from "react";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Mock Data for Usage
const USAGE_DATA = {
  day: [
    { label: "Mon", openai: 45000, anthropic: 20000, google: 5000 },
    { label: "Tue", openai: 55000, anthropic: 25000, google: 10000 },
    { label: "Wed", openai: 80000, anthropic: 40000, google: 15000 },
    { label: "Thu", openai: 60000, anthropic: 30000, google: 10000 },
    { label: "Fri", openai: 90000, anthropic: 45000, google: 20000 },
    { label: "Sat", openai: 30000, anthropic: 10000, google: 5000 },
    { label: "Sun", openai: 25000, anthropic: 15000, google: 5000 },
  ],
  week: [
    { label: "Week 1", openai: 300000, anthropic: 150000, google: 50000 },
    { label: "Week 2", openai: 250000, anthropic: 120000, google: 40000 },
    { label: "Week 3", openai: 450000, anthropic: 200000, google: 60000 },
    { label: "Week 4", openai: 200000, anthropic: 180000, google: 50000 },
  ],
  month: [
    { label: "Sep", openai: 450000, anthropic: 200000, google: 50000 },
    { label: "Oct", openai: 600000, anthropic: 350000, google: 100000 },
    { label: "Nov", openai: 850000, anthropic: 400000, google: 150000 },
    { label: "Dec", openai: 900000, anthropic: 250000, google: 50000 },
    { label: "Jan", openai: 750000, anthropic: 500000, google: 150000 },
    { label: "Feb", openai: 1200000, anthropic: 650000, google: 200000 },
  ]
};

const TOP_CHATS_USAGE = [
  { name: "React Documentation", tokens: 845000, cost: "$8.45", color: "bg-accent-blue" },
  { name: "Tailwind CSS v4", tokens: 420000, cost: "$4.20", color: "bg-purple-500" },
  { name: "Stripe API Reference", tokens: 125000, cost: "$1.25", color: "bg-green-500" },
];

export const Usage = () => {
    const [timeframe, setTimeframe] = useState<"day" | "week" | "month">("month");

    const currentData = USAGE_DATA[timeframe];
    
    // Chart.js Data & Options configurations
    const chartData = useMemo(() => ({
        labels: currentData.map((d) => d.label),
        datasets: [
            {
                label: "OpenAI",
                data: currentData.map((d) => d.openai),
                backgroundColor: "rgba(34, 197, 94, 0.9)", // green-500
                borderRadius: 4,
                barThickness: 32,
            },
            {
                label: "Anthropic",
                data: currentData.map((d) => d.anthropic),
                backgroundColor: "rgba(168, 85, 247, 0.9)", // purple-500
                borderRadius: 4,
                barThickness: 32,
            },
            {
                label: "Google",
                data: currentData.map((d) => d.google),
                backgroundColor: "rgba(59, 130, 246, 0.9)", // blue-500
                borderRadius: 4,
                barThickness: 32,
            },
        ],
    }), [currentData]);

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
                            <span className="text-sm font-medium text-gray-200">Current Cycle: <strong className="text-white">Feb 1 - Feb 28</strong></span>
                        </div>
                    </header>

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
                                <h3 className="text-3xl font-bold text-white mb-2">2.05M</h3>
                                <p className="text-xs text-green-400 flex items-center gap-1.5 font-medium">
                                    <TrendingUp className="w-3.5 h-3.5" /> +15.5% from last month
                                </p>
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
                                <h3 className="text-3xl font-bold text-white mb-2">3</h3>
                                <p className="text-xs text-gray-500 font-medium">
                                    Across 3 different providers
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
                                <h3 className="text-3xl font-bold text-white mb-2">$18.75</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 hover:text-accent-blue cursor-pointer transition-colors w-max font-medium">
                                    View provider dashboards <ArrowUpRight className="w-3.5 h-3.5" />
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
                            
                            <div className="flex-1 w-full min-h-[300px]">
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
                                {TOP_CHATS_USAGE.map((chat, i) => (
                                    <div key={i} className="space-y-2.5">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-200 truncate pr-2" title={chat.name}>{chat.name}</span>
                                            <span className="text-gray-300 font-mono font-medium shrink-0">{(chat.tokens / 1000).toFixed(0)}k</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className={`h-full ${chat.color} rounded-full`} 
                                                style={{ width: `${(chat.tokens / 850000) * 100}%` }}
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
