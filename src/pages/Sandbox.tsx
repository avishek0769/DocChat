import { useState, useCallback } from "react";
import { Sidebar } from "../components/Sidebar";
import {
    FlaskConical,
    AlertCircle,
    RotateCcw,
    ScanText,
    ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// chunkText — pure utility, isolated so the ingestion worker can
// import and reuse this same logic later without any UI coupling.
// ─────────────────────────────────────────────────────────────────────────────
export function chunkText(
    text: string,
    chunkSize: number,
    overlap: number
): string[] {
    if (!text.trim() || chunkSize <= 0) return [];
    const safeOverlap = Math.min(overlap, chunkSize - 1);
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        chunks.push(text.slice(start, start + chunkSize));
        start += chunkSize - safeOverlap;
    }

    return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Page
// ─────────────────────────────────────────────────────────────────────────────
const Sandbox = () => {
    const [inputText, setInputText] = useState<string>("");
    const [chunkSize, setChunkSize] = useState<number>(200);
    const [overlap, setOverlap]     = useState<number>(50);
    const [chunks, setChunks]       = useState<string[]>([]);
    const [hasRun, setHasRun]       = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError]         = useState<string>("");

    // Overlap can never be >= chunkSize
    const maxOverlap = Math.max(0, chunkSize - 10);

    // When chunkSize shrinks, clamp overlap so it stays valid
    const handleChunkSizeChange = (val: number) => {
        setChunkSize(val);
        if (overlap >= val) setOverlap(Math.max(0, val - 10));
    };

    const handlePreview = useCallback(async () => {
        if (!inputText.trim()) return;
        setIsLoading(true);
        setError("");

        try {
            // Calls the sandboxed backend endpoint —
            // NO vectors stored, NO production chat data created.
            const res = await fetch("/api/chunk-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText, chunkSize, overlap }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setError(errData.message || "Something went wrong.");
                return;
            }

            const data = await res.json();
            setChunks(data.data.chunks);
            setHasRun(true);
        } catch {
            setError("Network error — could not reach the server.");
        } finally {
            setIsLoading(false);
        }
    }, [inputText, chunkSize, overlap]);

    const handleReset = () => {
        setInputText("");
        setChunkSize(200);
        setOverlap(50);
        setChunks([]);
        setHasRun(false);
        setError("");
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* ── Page Header ── */}
                    <header>
                        <h1 className="text-3xl font-bold mb-2">
                            Chunking Sandbox
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Preview how your text will be split before running the
                            full ingestion pipeline. No vectors are stored and no
                            chat data is created.
                        </p>
                    </header>

                    {/* ── Info Banner — same style as Settings.tsx ── */}
                    <div className="flex items-start gap-3 text-sm text-gray-400 bg-accent-blue/5 p-4 rounded-xl border border-accent-blue/10">
                        <AlertCircle className="w-4 h-4 text-accent-blue shrink-0 mt-1.5" />
                        <div className="space-y-1">
                            <p className="font-medium text-gray-200 text-lg">
                                Sandbox Mode
                            </p>
                            <p className="leading-relaxed">
                                Chunk size and overlap have a large impact on retrieval
                                quality. Use this tool to interactively test different
                                configurations on your text without touching the production
                                pipeline. The{" "}
                                <strong className="text-gray-300">
                                    highlighted region
                                </strong>{" "}
                                in each chunk shows the characters carried over from the
                                previous chunk as overlap.
                            </p>
                        </div>
                    </div>

                    {/* ── Error Banner ── */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* ── Input Section ── */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <ScanText className="w-6 h-6 text-accent-blue" />
                            <h2 className="text-xl font-semibold text-gray-200">
                                Input Text
                            </h2>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Paste any document text here to preview how it will be chunked..."
                                rows={8}
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-3
                                           text-sm text-white font-mono placeholder-gray-600 resize-y
                                           focus:outline-none focus:border-accent-blue/50 leading-relaxed"
                            />
                            <p className="text-xs text-gray-500 text-right">
                                {inputText.length.toLocaleString()} characters
                            </p>
                        </div>
                    </section>

                    {/* ── Parameters Section ── */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <FlaskConical className="w-6 h-6 text-accent-blue" />
                            <h2 className="text-xl font-semibold text-gray-200">
                                Chunking Parameters
                            </h2>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                                {/* Chunk Size */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-gray-400">
                                            Chunk Size
                                        </label>
                                        <span className="text-sm font-bold text-accent-blue font-mono">
                                            {chunkSize} chars
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={50}
                                        max={2000}
                                        step={50}
                                        value={chunkSize}
                                        onChange={(e) =>
                                            handleChunkSizeChange(Number(e.target.value))
                                        }
                                        className="w-full accent-blue-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>50</span>
                                        <span>2000</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Number of characters per chunk.
                                    </p>
                                </div>

                                {/* Overlap */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-gray-400">
                                            Overlap
                                        </label>
                                        <span className="text-sm font-bold text-accent-blue font-mono">
                                            {overlap} chars
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={maxOverlap}
                                        step={10}
                                        value={overlap}
                                        onChange={(e) =>
                                            setOverlap(Number(e.target.value))
                                        }
                                        className="w-full accent-blue-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>0</span>
                                        <span>{maxOverlap}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Characters shared between consecutive chunks for
                                        context continuity.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── Action Buttons ── */}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                        <button
                            onClick={handleReset}
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5
                                       rounded-lg text-sm font-medium transition-colors flex
                                       items-center gap-2 justify-center w-full sm:w-auto"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                        <button
                            onClick={handlePreview}
                            disabled={isLoading || !inputText.trim()}
                            className="bg-accent-blue hover:bg-blue-600 disabled:opacity-50
                                       disabled:bg-gray-700 disabled:cursor-not-allowed text-white
                                       px-6 py-2.5 rounded-lg text-sm font-medium transition-colors
                                       flex items-center gap-2 justify-center w-full sm:w-auto"
                        >
                            {isLoading ? (
                                "Generating..."
                            ) : (
                                <>
                                    <ChevronRight className="w-4 h-4" />
                                    Preview Chunks
                                </>
                            )}
                        </button>
                    </div>

                    {/* ── Results Section ── */}
                    {hasRun && (
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                                <h2 className="text-xl font-semibold text-gray-200">
                                    Results
                                </h2>
                                {/* Stats pills — same font-mono pill style as Settings.tsx */}
                                <div className="flex gap-2 ml-auto flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono text-gray-300">
                                        {chunks.length} chunks
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-accent-blue/10 text-xs font-mono text-accent-blue">
                                        size: {chunkSize}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-accent-blue/10 text-xs font-mono text-accent-blue">
                                        overlap: {overlap}
                                    </span>
                                </div>
                            </div>

                            {chunks.length === 0 ? (
                                <div className="p-8 text-center bg-white/1 border border-white/5
                                                border-dashed rounded-xl text-sm text-gray-400">
                                    No chunks generated. Try adjusting your parameters.
                                </div>
                            ) : (
                                <>
                                    {/* Overlap legend */}
                                    {overlap > 0 && chunks.length > 1 && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="inline-block w-4 h-3 rounded bg-accent-purple/40 border border-accent-purple/30" />
                                            Highlighted = overlap region carried from previous chunk
                                        </div>
                                    )}

                                    {/* Chunk cards */}
                                    <div className="space-y-3">
                                        {chunks.map((chunk, idx) => (
                                            <div
                                                key={idx}
                                                className="flex flex-col sm:flex-row bg-white/2 border
                                                           border-white/5 rounded-xl p-4 gap-4"
                                            >
                                                {/* Left: chunk number badge */}
                                                <div className="shrink-0">
                                                    <span className="inline-flex items-center justify-center
                                                                     w-8 h-8 rounded-lg bg-accent-blue/10
                                                                     border border-accent-blue/20 text-accent-blue
                                                                     text-xs font-bold font-mono">
                                                        {idx + 1}
                                                    </span>
                                                </div>

                                                {/* Right: chunk body + meta */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-300 font-mono
                                                                  whitespace-pre-wrap break-words leading-relaxed">
                                                        {/* Highlight the overlap at the start of every
                                                            chunk except the first */}
                                                        {idx > 0 && overlap > 0 ? (
                                                            <>
                                                                <span className="bg-accent-purple/30 text-purple-200
                                                                                 rounded px-0.5 border-b
                                                                                 border-accent-purple/40">
                                                                    {chunk.slice(0, overlap)}
                                                                </span>
                                                                {chunk.slice(overlap)}
                                                            </>
                                                        ) : (
                                                            chunk
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-600 mt-2 text-right font-mono">
                                                        {chunk.length} chars
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>
                    )}

                </div>
            </main>
        </div>
    );
};

export default Sandbox;