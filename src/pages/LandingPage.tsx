import { motion } from "framer-motion";
import {
    MessageSquare,
    Terminal,
    Zap,
    Target,
    Layers,
    AlertCircle,
    Database,
    Server,
    Key,
    GitBranch,
    Check,
    CheckCircle2,
    Link,
} from "lucide-react";

const LandingPage = () => {
    const fadeIn = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 overflow-hidden selection:bg-accent-purple/30 font-sans">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-blue/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-purple/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-6 h-6 text-accent-blue" />
                    <span className="font-semibold text-xl tracking-tight">
                        DocTalk
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <a
                        href="#problem"
                        className="hover:text-white transition-colors"
                    >
                        Problem
                    </a>
                    <a
                        href="#how-it-works"
                        className="hover:text-white transition-colors"
                    >
                        How it works
                    </a>
                    <a
                        href="#features"
                        className="hover:text-white transition-colors"
                    >
                        Features
                    </a>
                    <a
                        href="#pricing"
                        className="hover:text-white transition-colors"
                    >
                        Pricing
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <button className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block">
                        Sign In
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-all">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* 1. Hero Section */}
            <section className="relative z-10 pt-24 pb-20 px-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
                <motion.h1
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
                >
                    Chat with any documentation instantly
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-lg text-gray-400 max-w-2xl mx-auto mb-4"
                >
                    Paste a documentation link. We index it and turn it into an
                    AI you can query.
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="text-md text-gray-500 max-w-2xl mx-auto mb-10 font-medium"
                >
                    Built for developers who don’t want to manually search docs.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full"
                >
                    <button className="w-full sm:w-auto px-8 py-3 rounded-lg bg-linear-to-r from-accent-blue to-accent-purple hover:bg-opacity-90 font-medium text-white flex items-center justify-center gap-2 transition-all">
                        Get Started
                    </button>
                    <button className="w-full sm:w-auto px-8 py-3 rounded-lg glass border border-white/10 font-medium text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                        Try Demo
                    </button>
                </motion.div>
            </section>

            {/* 2. Problem Section */}
            <section
                id="problem"
                className="relative z-10 py-20 px-6 max-w-4xl mx-auto"
            >
                <div className="glass rounded-2xl p-8 md:p-12 border border-red-500/10">
                    <div className="flex items-center gap-3 mb-6 text-red-400">
                        <AlertCircle className="w-6 h-6" />
                        <h2 className="text-xl font-semibold">The Problem</h2>
                    </div>
                    <ul className="space-y-4 text-gray-400 mb-8">
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>
                                Documentation is long and hard to navigate
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>
                                Searching through multiple pages is slow
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>Ctrl+F doesn’t work across pages</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>Context switching kills productivity</span>
                        </li>
                    </ul>
                    <p className="text-lg font-medium text-white border-l-2 border-red-500/50 pl-4 py-1">
                        "You waste more time searching docs than actually
                        building."
                    </p>
                </div>
            </section>

            {/* 3. How It Works */}
            <section
                id="how-it-works"
                className="relative z-10 py-20 px-6 max-w-5xl mx-auto"
            >
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold mb-4">
                        How It Works
                    </h2>
                    <p className="text-lg text-gray-400">
                        Paste a documentation link and we handle the rest.
                    </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6 relative mb-10">
                    <div className="hidden md:block absolute top-[40%] left-0 w-full h-px bg-white/5 -translate-y-1/2 z-0" />
                    {[
                        {
                            step: "1",
                            icon: <Link className="w-6 h-6 text-accent-blue" />,
                            title: "Paste URL",
                            desc: "Drop the start URL of any documentation.",
                        },
                        {
                            step: "2",
                            icon: <Database className="w-6 h-6 text-indigo-400" />,
                            title: "We Process",
                            desc: "We mechanically crawl, extract structure, and create vector embeddings.",
                        },
                        {
                            step: "3",
                            icon: <MessageSquare className="w-6 h-6 text-accent-purple" />,
                            title: "Start Chatting",
                            desc: "Ask questions and get precision answers backed by source citations.",
                        },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            className="relative z-10 glass p-8 rounded-xl border border-white/10 text-center flex flex-col items-center"
                        >
                            <div className="w-14 h-14 rounded-full bg-[#0b0b0f] border border-white/10 flex items-center justify-center mb-6 relative shadow-lg">
                                <span className="absolute -top-2 -right-2 w-6 h-6 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold flex items-center justify-center">
                                    {item.step}
                                </span>
                                {item.icon}
                            </div>
                            <h3 className="text-lg font-semibold mb-2">
                                {item.title}
                            </h3>
                            <p className="text-sm text-gray-400">{item.desc}</p>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col items-center justify-center gap-5 mt-10">
                    <p className="text-xl md:text-2xl font-medium text-accent-blue inline-flex items-center gap-3 glass px-6 py-4 rounded-full border-accent-blue/20">
                        <CheckCircle2 className="w-6 h-6" />
                        You ask questions. It gives answers with sources.
                    </p>
                    <p className="text-center text-gray-500 text-sm">
                        Processing happens in the background. You can come back
                        anytime.
                    </p>
                </div>
            </section>

            {/* 4. Demo Explanation Section */}
            <section
                id="demo"
                className="relative z-10 py-20 px-6 max-w-6xl mx-auto"
            >
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1 relative rounded-xl border border-white/10 bg-[#0d0d12] p-6 shadow-2xl">
                        {/* Mock Chat UI (Simplified) */}
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center shrink-0 text-xs">
                                    U
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200">
                                    How do I implement pagination?
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center shrink-0">
                                    <Terminal className="w-3 h-3 text-white" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="text-sm text-gray-300 leading-relaxed">
                                        Use the limit and cursor query
                                        parameters in your request...
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400">
                                            <Target className="w-3 h-3 text-accent-blue" />{" "}
                                            API Reference Models
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <h2 className="text-3xl font-bold mb-6">
                            See it in action
                        </h2>
                        <ul className="space-y-4 text-gray-400 mb-8">
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" />{" "}
                                Ask natural language questions
                            </li>
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" />{" "}
                                Get precise answers
                            </li>
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" />{" "}
                                See exactly where the answer came from
                            </li>
                        </ul>
                        <p className="inline-block px-4 py-2 glass rounded-lg border-white/10 font-medium text-white">
                            No hallucinations. Every answer is backed by
                            sources.
                        </p>
                    </div>
                </div>
            </section>

            {/* 6. Features Section */}
            <section
                id="features"
                className="relative z-10 py-20 px-6 max-w-6xl mx-auto"
            >
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        {
                            icon: <Target className="w-5 h-5" />,
                            title: "Source citations",
                            desc: "See exact content used for answers",
                        },
                        {
                            icon: <Layers className="w-5 h-5" />,
                            title: "Recursive crawling",
                            desc: "Covers full documentation structurally",
                        },
                        {
                            icon: <Zap className="w-5 h-5" />,
                            title: "Fast retrieval",
                            desc: "Optimized and instant vector search",
                        },
                        {
                            icon: <Link className="w-5 h-5" />,
                            title: "Works with statics",
                            desc: "Supports most static documentation sites",
                        },
                        {
                            icon: <Key className="w-5 h-5" />,
                            title: "Bring your own API key",
                            desc: "Use any LLM that fits your needs",
                        },
                        {
                            icon: <GitBranch className="w-5 h-5" />,
                            title: "Open source",
                            desc: "Self-host anytime, fully open",
                        },
                    ].map((feature, idx) => (
                        <div
                            key={idx}
                            className="glass p-5 rounded-lg border border-white/5 flex gap-4 items-start"
                        >
                            <div className="mt-1 text-gray-400">
                                {feature.icon}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-200 mb-1">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {feature.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 7. Developer-Focused Section */}
            <section className="relative z-10 py-20 px-6 max-w-4xl mx-auto text-center border-y border-white/5 mt-10">
                <h2 className="text-3xl font-bold mb-4">
                    Built for real-world developer workflows
                </h2>
                <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                    Whether you are reading API docs, SDK guides, or internal
                    wikis, DocTalk keeps context in one place.
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-gray-300">
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Works with API docs, SDK docs, guides
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Helps debug faster
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Reduces time spent searching
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Keeps context in one place
                    </span>
                </div>
            </section>

            {/* 8. Limitations & 9. Pricing */}
            <section
                id="pricing"
                className="relative z-10 py-20 px-6 max-w-6xl mx-auto mt-10"
            >
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Limitations */}
                    <div className="glass p-8 rounded-2xl border border-white/5">
                        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-gray-400" />{" "}
                            Current Limitations
                        </h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li className="flex items-start gap-2">
                                <span className="text-gray-600">•</span> Works
                                best with static documentation sites
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-600">•</span>{" "}
                                JavaScript-heavy sites may not be fully
                                supported
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-600">•</span> Free
                                usage is limited
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-600">•</span> Large
                                docs may take time to process
                            </li>
                        </ul>
                    </div>

                    {/* Pricing */}
                    <div className="glass p-8 rounded-2xl border border-accent-blue/20 bg-accent-blue/2">
                        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Server className="w-5 h-5 text-accent-blue" />{" "}
                            Simple Usage Model
                        </h3>
                        <div className="space-y-4 text-sm text-gray-300 mb-8">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span>Free tier</span>
                                <span className="text-gray-500">
                                    Limited usage
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span>Bring your own API key</span>
                                <span className="text-gray-500">
                                    For extended usage
                                </span>
                            </div>
                        </div>
                        <p className="text-center font-medium text-accent-blue">
                            "You control your usage and cost."
                        </p>
                    </div>
                </div>
            </section>

            {/* 10. CTA Section */}
            <section className="relative z-10 py-24 px-6 text-center">
                <h2 className="text-4xl font-bold mb-8">
                    Stop searching docs. Start asking.
                </h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button className="px-8 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors">
                        Create your first chat
                    </button>
                    <button className="px-8 py-3 rounded-lg glass border border-white/10 font-medium text-white hover:bg-white/10 transition-colors">
                        Try with your own API key
                    </button>
                </div>
            </section>

            {/* 11. Footer */}
            <footer className="relative z-10 border-t border-white/10 bg-[#0a0a0c] py-8 px-6">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Terminal className="w-4 h-4" />
                        <span className="font-semibold text-sm">DocTalk</span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-500">
                        <a
                            href="#"
                            className="hover:text-white transition-colors flex items-center gap-1"
                        >
                            <GitBranch className="w-4 h-4" /> GitHub
                        </a>
                        <a
                            href="#"
                            className="hover:text-white transition-colors"
                        >
                            Docs
                        </a>
                        <a
                            href="#"
                            className="hover:text-white transition-colors"
                        >
                            About
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
