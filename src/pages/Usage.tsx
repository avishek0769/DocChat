import { Sidebar } from "../components/Sidebar";
import { Zap, TrendingUp, Key, Calendar, ArrowUpRight, DollarSign } from "lucide-react";
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
const MONTHLY_USAGE = [
  { month: "Sep", openai: 450000, anthropic: 200000, google: 50000, total: 700000 },
  { month: "Oct", openai: 600000, anthropic: 350000, google: 100000, total: 1050000 },
  { month: "Nov", openai: 850000, anthropic: 400000, google: 150000, total: 1400000 },
  { month: "Dec", openai: 900000, anthropic: 250000, google: 50000, total: 1200000 },
  { month: "Jan", openai: 750000, anthropic: 500000, google: 150000, total: 1400000 },
  { month: "Feb", openai: 1200000, anthropic: 650000, google: 200000, total: 2050000 },
];

const API_KEYS_USAGE = [
  { name: "My Sandbox Key", provider: "OpenAI", tokens: 850000, cost: "$8.50", color: "bg-green-500" },
  { name: "Claude Project", provider: "Anthropic", tokens: 650000, cost: "$9.75", color: "bg-purple-500" },
  { name: "Test Gemini", provider: "Google", tokens: 200000, cost: "$0.50", color: "bg-blue-500" },
];

// Chart.js Data & Options configurations
const chartData = {
    labels: MONTHLY_USAGE.map((d) => d.month),
    datasets: [
        {
            label: "OpenAI",
            data: MONTHLY_USAGE.map((d) => d.openai),
            backgroundColor: "rgba(34, 197, 94, 0.9)", // green-500
            borderRadius: 4,
            barThickness: 32,
        },
        {
            label: "Anthropic",
            data: MONTHLY_USAGE.map((d) => d.anthropic),
            backgroundColor: "rgba(168, 85, 247, 0.9)", // purple-500
            borderRadius: 4,
            barThickness: 32,
        },
        {
            label: "Google",
            data: MONTHLY_USAGE.map((d) => d.google),
            backgroundColor: "rgba(59, 130, 246, 0.9)", // blue-500
            borderRadius: 4,
            barThickness: 32,
        },
    ],
};

const chartOptions = {
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
                    return (Number(value) / 1000000) + "M";
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
};

export const Usage = () => {
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
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-accent-blue" />
                                Monthly Token Usage
                            </h3>
                            
                            <div className="flex-1 w-full min-h-[300px]">
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                        </div>

                        {/* API Keys Usage Breakdown */}
                        <div className="p-6 rounded-xl bg-white/2 border border-white/5 flex flex-col">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                <Key className="w-5 h-5 text-accent-blue" />
                                Usage by Key
                            </h3>

                            <div className="space-y-6 flex-1">
                                {API_KEYS_USAGE.map((key, i) => (
                                    <div key={i} className="space-y-2.5">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-200">{key.name}</span>
                                            <span className="text-gray-300 font-mono font-medium">{(key.tokens / 1000).toFixed(0)}k</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className={`h-full ${key.color} rounded-full`} 
                                                style={{ width: `${(key.tokens / 1200000) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">{key.provider}</span>
                                            <span className="text-gray-400">Est: {key.cost}</span>
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
