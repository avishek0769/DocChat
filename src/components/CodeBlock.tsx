import { useState, useRef, useEffect, useMemo } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { Code, Check } from "lucide-react";

const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type CopyStatus = "idle" | "copied" | "failed";

const CodeBlock = ({ language, code }: { language?: string; code: string }) => {
    const [status, setStatus] = useState<CopyStatus>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const resetStatus = () => setStatus("idle");

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const scheduleReset = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(resetStatus, 2000);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setStatus("copied");
            scheduleReset();
        } catch {
            console.error("Failed to copy code to clipboard");
            setStatus("failed");
            scheduleReset();
        }
    };

    const highlighted = useMemo(() => {
        try {
            if (language && hljs.getLanguage(language)) {
                return hljs.highlight(code, { language }).value;
            }
            return hljs.highlightAuto(code).value;
        } catch {
            return escapeHtml(code);
        }
    }, [language, code]);

    const isCopied = status === "copied";
    const isFailed = status === "failed";
    const btnLabel = isCopied ? "Copied" : isFailed ? "Copy failed" : "Copy code to clipboard";

    return (
        <div className="my-4 rounded-xl overflow-hidden bg-[#0a0a0e] border border-white/10 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                    <Code className="w-3.5 h-3.5" />
                    {language || "code"}
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={btnLabel}
                    className="flex items-center gap-1.5 text-sm uppercase font-bold tracking-wider transition-colors cursor-pointer"
                >
                    {isCopied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : isFailed ? (
                        <span className="text-red-400">Failed!</span>
                    ) : (
                        <span className="text-gray-500 hover:text-white">Copy</span>
                    )}
                </button>
            </div>
            <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-gray-300 custom-scrollbar w-full max-w-full">
                <pre>
                    <code
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                </pre>
            </div>
        </div>
    );
};

export default CodeBlock;
