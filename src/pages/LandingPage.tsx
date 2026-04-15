import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import demoImage from "../components/image.png";
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
                    <span className="font-semibold text-xl tracking-tight">DocChat</span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <a href="#problem" className="hover:text-white transition-colors">
                        Problem
                    </a>
                    <a href="#how-it-works" className="hover:text-white transition-colors">
                        How it works
                    </a>
                    <a href="#features" className="hover:text-white transition-colors">
                        Features
                    </a>
                    <a href="#limitations" className="hover:text-white transition-colors">
                        Limitations
                    </a>
                    <a href="#open-source" className="hover:text-white transition-colors">
                        Open Source
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <a
                        href="https://github.com/avishek0769/DocChat"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="DocChat GitHub Repository"
                        className="text-gray-300 hover:text-white transition-colors hidden sm:inline-flex"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-8 h-8 fill-current">
                            <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.36 6.84 9.71.5.1.66-.22.66-.49 0-.24-.01-1.03-.01-1.86-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.31 9.31 0 0 1 12 6.84c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.65.72 1.03 1.64 1.03 2.76 0 3.93-2.35 4.8-4.58 5.05.36.31.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .27.17.59.67.49A10.26 10.26 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
                        </svg>
                    </a>
                    <RouterLink
                        to="/signin"
                        className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
                    >
                        Sign In
                    </RouterLink>
                    <RouterLink
                        to="/signup"
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-all"
                    >
                        Get Started
                    </RouterLink>
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
                    Paste a documentation link. We index it and turn it into an AI you can query.
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
                    <RouterLink
                        to="/signup"
                        className="w-full sm:w-auto px-8 py-3 rounded-lg bg-linear-to-r from-accent-blue to-accent-purple hover:bg-opacity-90 font-medium text-white flex items-center justify-center gap-2 transition-all"
                    >
                        Get Started
                    </RouterLink>
                </motion.div>
            </section>

            {/* 2. Problem Section */}
            <section id="problem" className="relative z-10 py-20 px-6 max-w-4xl mx-auto">
                <div className="glass rounded-2xl p-8 md:p-12 border border-red-500/10">
                    <div className="flex items-center gap-3 mb-6 text-red-400">
                        <AlertCircle className="w-6 h-6" />
                        <h2 className="text-xl font-semibold">The Problem</h2>
                    </div>
                    <ul className="space-y-4 text-gray-400 mb-8">
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>Documentation is long and hard to navigate</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-gray-600 mt-1">•</span>
                            <span>Searching through multiple pages is slow</span>
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
                        "You waste more time searching docs than actually building."
                    </p>
                </div>
            </section>

            {/* 3. How It Works */}
            <section id="how-it-works" className="relative z-10 py-20 px-6 max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold mb-4">How It Works</h2>
                    <p className="text-lg text-gray-400">
                        From docs URL to source-backed answers in three steps.
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
                            title: "We Build Context",
                            desc: "We crawl internal pages, clean content, chunk it, and generate embeddings.",
                        },
                        {
                            step: "3",
                            icon: <MessageSquare className="w-6 h-6 text-accent-purple" />,
                            title: "Start Chatting",
                            desc: "Ask questions and get precise answers backed by source citations.",
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
                            <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
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
                        First-time ingestion runs in the background. If the same docs URL is already
                        indexed, chat creation is instant.
                    </p>
                </div>
            </section>

            {/* 4. Demo Explanation Section */}
            <section id="demo" className="relative z-10 py-20 px-6 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-14 items-center">
                    <div className="order-2 md:order-1 relative rounded-xl border border-white/10 bg-[#0d0d12] p-3 shadow-2xl w-full max-w-2xl md:justify-self-center">
                        <img
                            src={demoImage}
                            alt="DocChat interface preview"
                            className="w-full h-full object-cover rounded-lg border border-white/10"
                        />
                    </div>
                    <div className="order-1 md:order-2 w-full max-w-xl md:justify-self-center text-left">
                        <h2 className="text-3xl font-bold mb-6">See it in action</h2>
                        <ul className="space-y-4 text-gray-400 mb-8">
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" /> Ask natural language
                                questions
                            </li>
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" /> Get precise answers
                            </li>
                            <li className="flex items-center gap-3">
                                <Check className="w-4 h-4 text-accent-blue" /> See exactly where the
                                answer came from
                            </li>
                        </ul>
                        <p className="inline-block px-4 py-2 glass rounded-lg border-white/10 font-medium text-white">
                            No hallucinations. Every answer is backed by sources.
                        </p>
                    </div>
                </div>
            </section>

            {/* 6. Features Section */}
            <section id="features" className="relative z-10 py-20 px-6 max-w-6xl mx-auto">
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
                            title: "Instant reuse",
                            desc: "Reuses existing knowledge base for the same docs URL",
                        },
                        {
                            icon: <Server className="w-5 h-5" />,
                            title: "Background processing",
                            desc: "Tracks ingestion progress from queued to ready",
                        },
                        {
                            icon: <Key className="w-5 h-5" />,
                            title: "Encrypted API keys",
                            desc: "Bring your own key and store it encrypted",
                        },
                        {
                            icon: <GitBranch className="w-5 h-5" />,
                            title: "Multi-provider LLMs",
                            desc: "OpenAI, Anthropic, Gemini, xAI, and OpenRouter",
                        },
                    ].map((feature, idx) => (
                        <div
                            key={idx}
                            className="glass p-5 rounded-lg border border-white/5 flex gap-4 items-start"
                        >
                            <div className="mt-1 text-gray-400">{feature.icon}</div>
                            <div>
                                <h3 className="font-semibold text-gray-200 mb-1">{feature.title}</h3>
                                <p className="text-sm text-gray-500">{feature.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 7. Developer-Focused Section */}
            <section className="relative z-10 py-20 px-6 max-w-4xl mx-auto text-center border-y border-white/5 mt-10">
                <h2 className="text-3xl font-bold mb-4">Built for developer documentation workflows</h2>
                <div className="text-gray-400 mb-8 max-w-2xl mx-auto">
                    Ingest docs once, ask naturally, and keep references attached to every answer. Bring
                    your own API keys or use the included model access.
                </div>
                <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-gray-300">
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        API docs, SDK docs, guides
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Reuse existing indexed docs instantly
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Source-backed answers
                    </span>
                    <span className="px-4 py-2 rounded-full glass border border-white/10">
                        Usage tracking built in
                    </span>
                </div>
            </section>

            {/* 8. Limitations */}
            <section id="limitations" className="relative z-10 py-20 px-6 max-w-6xl mx-auto mt-10">
                <div className="mb-10 text-center">
                    <p className="text-xs uppercase tracking-[0.22em] text-red-300/70 mb-3">
                        Know Before You Start
                    </p>
                    <h3 className="text-3xl font-bold mb-4">Current Limitations</h3>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        DocChat is fast for most documentation sites, but these are the practical
                        constraints right now.
                    </p>
                </div>

                <div className="relative">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10 md:left-1/2 md:-translate-x-1/2" />
                    <div className="space-y-5">
                        {[
                            "You cannot control the web crawler’s depth or breadth yet",
                            "JavaScript-heavy sites may not be fully supported",
                            "Only up to 300 pages can be ingested reliably each chat",
                            "Large docs may take time to process",
                        ].map((item, idx) => (
                            <div key={idx} className="grid md:grid-cols-2 items-center gap-4 md:gap-10">
                                <div className={`hidden md:block ${idx % 2 === 0 ? "" : "order-2"}`} />
                                <div
                                    className={`relative ml-8 md:ml-0 glass rounded-xl border border-white/10 p-5 text-sm text-gray-300 ${idx % 2 === 0 ? "md:mr-8" : "md:ml-8 md:order-1"}`}
                                >
                                    <span
                                        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-400/80 shadow-[0_0_0_4px_rgba(248,113,113,0.15)] ${idx % 2 === 0 ? "-left-9 md:-right-10 md:left-auto" : "-left-9 md:-left-10"}`}
                                    />
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-4 h-4 text-red-300 mt-0.5 shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. Open Source */}
            <section id="open-source" className="relative z-10 py-20 px-6 max-w-6xl mx-auto">
                <div className="relative overflow-hidden rounded-3xl border border-accent-blue/30 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.2),transparent_40%),radial-gradient(circle_at_90%_80%,rgba(168,85,247,0.2),transparent_45%),linear-gradient(180deg,rgba(16,16,24,0.95),rgba(10,10,16,0.95))] p-8 md:p-12">
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_45%)] pointer-events-none" />
                    <div className="relative grid md:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-accent-blue/80 mb-3">
                                Community Driven
                            </p>
                            <h3 className="text-3xl md:text-4xl font-bold mb-4">
                                Open source and built in public
                            </h3>
                            <p className="text-gray-300 mb-6 max-w-2xl">
                                DocChat is fully open source. If you want to fix bugs, improve crawling
                                quality, or ship new ideas, contributions are welcome.
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <span className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-gray-300">
                                    Issues welcome
                                </span>
                                <span className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-gray-300">
                                    PRs welcome
                                </span>
                                <span className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-gray-300">
                                    MIT Licensed
                                </span>
                            </div>
                        </div>
                        <div className="md:justify-self-end">
                            <a
                                href="https://github.com/avishek0769/DocChat"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex w-full md:w-auto items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                            >
                                <GitBranch className="w-4 h-4" />
                                Explore on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* 10. CTA Section */}
            <section className="relative z-10 py-24 px-6 text-center">
                <h2 className="text-4xl font-bold mb-8">Stop searching docs. Start asking.</h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <RouterLink
                        to="/signup"
                        className="px-8 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Create your first chat
                    </RouterLink>
                    <RouterLink
                        to="/dashboard"
                        className="px-8 py-3 rounded-lg glass border border-white/10 font-medium text-white hover:bg-white/10 transition-colors"
                    >
                        Start with your docs URL
                    </RouterLink>
                </div>
            </section>

            {/* 11. Footer */}
            <footer className="relative z-10 border-t border-white/10 bg-[#0a0a0c] py-8 px-6">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-5 h-5 text-accent-blue" />
                        <span className="font-semibold text-sm">DocChat</span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-500">
                        <a
                            href="https://github.com/avishek0769/DocChat"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-white transition-colors flex items-center gap-1"
                        >
                            <GitBranch className="w-4 h-4" /> GitHub
                        </a>
                        <a
                            href="https://avishek.short.gy/docchat"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-white transition-colors"
                        >
                            Live Website
                        </a>
                        <a href="/signin" className="hover:text-white transition-colors">
                            Sign In
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
