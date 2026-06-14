import type { ReactNode } from "react";

type EmptyStateProps = {
    icon: ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
};

export default function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-white/10 bg-white/5">
            <div className="mb-4 text-accent-blue">
                {icon}
            </div>

            <h3 className="text-xl font-semibold text-white mb-2">
                {title}
            </h3>

            <p className="text-gray-400 max-w-md mb-6">
                {description}
            </p>

            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-5 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-medium transition-colors"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
