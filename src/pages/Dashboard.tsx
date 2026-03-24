import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Terminal, 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  LogOut,
  Plus,
  FileText,
  Database,
  Clock,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

// Mock Data
const MOCK_CHATS = [
  {
    id: "1",
    title: "React Documentation",
    url: "https://react.dev/reference",
    status: "ready", // ready, processing, failed
    pages: 142,
    size: "1.2 MB",
    updatedAt: "2 hours ago"
  },
  {
    id: "2",
    title: "Stripe API Reference",
    url: "https://docs.stripe.com/api",
    status: "processing",
    pages: 45,
    size: "...",
    updatedAt: "Just now"
  },
  {
    id: "3",
    title: "Legacy Internal Docs",
    url: "https://wiki.internal.dev/v1",
    status: "failed",
    pages: 0,
    size: "0 B",
    updatedAt: "2 days ago"
  }
];

const Dashboard = () => {
  const [chats, setChats] = useState(MOCK_CHATS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </div>
        );
      case "processing":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
            <AlertCircle className="w-3 h-3" /> Failed
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0b0b0f] flex flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center gap-2">
          <Terminal className="w-6 h-6 text-accent-blue" />
          <span className="font-semibold text-xl tracking-tight">DocTalk</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 text-white font-medium border border-white/5">
            <LayoutDashboard className="w-4 h-4 text-accent-blue" /> Dashboard
          </Link>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium">
            <MessageSquare className="w-4 h-4" /> All Chats
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium">
            <Settings className="w-4 h-4" /> Settings
          </button>
        </nav>

        {/* Profile Bottom */}
        <div className="p-4 border-t border-white/5">
          <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center text-sm font-bold shadow-lg">
                D
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-200">Developer</p>
                <p className="text-xs text-gray-500 group-hover:text-gray-400">Pro Plan</p>
              </div>
            </div>
            <LogOut className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full relative">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Header Section */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Chats</h1>
              <p className="text-gray-400">Create and manage your documentation knowledge bases.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <span className="text-white">2</span> / 3 chats used
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white font-medium transition-colors shadow-lg shadow-accent-blue/20"
              >
                <Plus className="w-4 h-4" /> Create Chat
              </button>
            </div>
          </header>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Total Chats", value: "2", icon: <MessageSquare className="w-5 h-5 text-accent-blue" /> },
              { label: "Pages Indexed", value: "142", icon: <FileText className="w-5 h-5 text-indigo-400" /> },
              { label: "Data Processed", value: "1.2 MB", icon: <Database className="w-5 h-5 text-purple-400" /> }
            ].map((stat, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                  {stat.icon}
                </div>
              </div>
            ))}
          </div>

          {/* Chat List Section */}
          <div>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              Recent Chats <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-gray-400">{chats.length}</span>
            </h2>
            
            {chats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {chats.map(chat => (
                  <div key={chat.id} className="group relative flex flex-col bg-[#0d0d12] rounded-xl border border-white/5 hover:border-white/15 p-5 transition-all hover:shadow-2xl hover:-translate-y-1">
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="truncate pr-4">
                        <h3 className="font-semibold text-gray-100 truncate" title={chat.title}>{chat.title}</h3>
                        <a href={chat.url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-accent-blue truncate block mt-1 transition-colors">
                          {chat.url}
                        </a>
                      </div>
                      <div className=" shrink-0">
                        {getStatusBadge(chat.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 mb-6">
                      <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5">
                        <FileText className="w-3 h-3 text-gray-400 mb-1" />
                        <span className="text-xs font-medium text-gray-300">{chat.pages}</span>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5">
                        <Database className="w-3 h-3 text-gray-400 mb-1" />
                        <span className="text-xs font-medium text-gray-300">{chat.size}</span>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center border border-white/5">
                        <Clock className="w-3 h-3 text-gray-400 mb-1" />
                        <span className="text-xs font-medium text-gray-300 truncate w-full text-center">{chat.updatedAt}</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center gap-3 pt-4 border-t border-white/5">
                      <button 
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                          chat.status === 'ready' 
                            ? 'bg-white/10 hover:bg-white/15 text-white' 
                            : 'bg-white/5 text-gray-500 cursor-not-allowed'
                        }`}
                        disabled={chat.status !== 'ready'}
                      >
                         Open Chat
                      </button>
                      <button className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors border border-transparent hover:border-red-400/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="rounded-2xl border border-white/5 border-dashed bg-white/1 p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                  <Database className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No chats yet</h3>
                <p className="text-gray-400 max-w-sm mb-6">You haven't processed any documentation. Create your first knowledge base to start chatting.</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors border border-white/10"
                >
                  Create your first chat
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Chat Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setIsModalOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent-blue" />
                New Chat
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              
              {/* Chat Name Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Chat Name <span className="text-gray-500 font-normal">(Optional)</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. React Docs 18.2"
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                />
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Documentation URL</label>
                <input 
                  type="url" 
                  placeholder="https://docs.example.com"
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                />
                <p className="text-xs text-gray-500">We'll scrape this page and sub-pages automatically.</p>
              </div>

              {/* Scan Depth */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Scan Depth</label>
                <select className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none">
                  <option value="1">Direct links only (fastest)</option>
                  <option value="2">Sub-pages up to 2 levels</option>
                  <option value="all">Full recursive crawl (slower)</option>
                </select>
              </div>

              {/* Model Selection */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-300">AI Model</label>
                  <span className="text-xs text-gray-500">Can be changed later</span>
                </div>
                <select className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none">
                  <option value="gpt-4o">GPT-4o (Recommended)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                  <option value="claude-3.5">Claude 3.5 Sonnet</option>
                </select>
              </div>

              {/* API Key Toggle and Select */}
              <div className="pt-2 border-t border-white/5 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={useOwnKey}
                      onChange={(e) => setUseOwnKey(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-accent-blue/30 transition-colors"></div>
                    <div className="absolute left-1 w-3.5 h-3.5 bg-gray-400 rounded-full peer-checked:translate-x-5 peer-checked:bg-accent-blue transition-transform"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                    Use an external API key <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  </span>
                </label>

                {useOwnKey && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Select Provider</label>
                        <select className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-blue/50 appearance-none">
                            <option value="openai">OpenAI (sk-...)</option>
                            <option value="anthropic">Anthropic (sk-ant-...)</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 flex justify-between">
                            API Key
                            <a href="#" className="text-accent-blue hover:underline">Or add to settings</a>
                        </label>
                        <input 
                            type="password" 
                            placeholder="sk-..."
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 font-mono"
                        />
                        <p className="text-xs text-gray-500">Your key is never stored permanently. Used only for this session.</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/5 bg-white/2 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button className="px-5 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-medium transition-colors shadow-lg shadow-accent-blue/20">
                Start Processing
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;