import { useState, useRef, useEffect } from "react";
import { useTheme, type Theme } from "./ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleOpen = () => setIsOpen((prev) => !prev);

    // Close dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSelect = (selected: Theme) => {
        setTheme(selected);
        setIsOpen(false);
    };

    const getIcon = (t: Theme) => {
        switch (t) {
            case "light":
                return <Sun className="w-[18px] h-[18px] text-amber-500" />;
            case "dark":
                return <Moon className="w-[18px] h-[18px] text-indigo-400" />;
            case "system":
            default:
                return <Monitor className="w-[18px] h-[18px] text-teal-400" />;
        }
    };

    const options: { value: Theme; label: string }[] = [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" },
    ];

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={toggleOpen}
                aria-label="Toggle theme"
                className="w-9 h-9 flex items-center justify-center rounded-lg
                    bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15]
                    dark:bg-white/[0.04] dark:border-white/[0.08] dark:hover:bg-white/[0.08]
                    light:bg-slate-100 light:border-slate-200 light:hover:bg-slate-200
                    html:not(.dark):bg-slate-100 html:not(.dark):border-slate-200 html:not(.dark):hover:bg-slate-200/80 html:not(.dark):hover:border-slate-300
                    transition-all duration-200 text-text-primary"
            >
                {getIcon(theme)}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute right-0 mt-2 w-32 rounded-xl border z-50
                            bg-[#1a1a24] border-white/10 shadow-2xl
                            html:not(.dark):bg-white html:not(.dark):border-slate-200 html:not(.dark):shadow-lg"
                    >
                        <div className="p-1.5 space-y-1">
                            {options.map((opt) => {
                                const isActive = theme === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors
                                            ${
                                                isActive
                                                    ? "bg-accent-blue/10 text-accent-blue"
                                                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary html:not(.dark):hover:bg-slate-50"
                                            }`}
                                    >
                                        <span className="shrink-0">{getIcon(opt.value)}</span>
                                        <span>{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
