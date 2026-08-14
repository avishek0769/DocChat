import { useEffect, useState, type JSX } from "react";
import { Navigate } from "react-router-dom";
import { getAuthUser, isAuthenticated } from "../lib/auth";
import { getUserProfile } from "../lib/api";

type Props = {
    children: JSX.Element;
    adminOnly?: boolean;
};

export const ProtectedRoute = ({ children, adminOnly = false }: Props) => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        let mounted = true;
        if (!adminOnly) return;

        const loadRole = async () => {
            try {
                const profile = await getUserProfile();
                if (!mounted) return;
                setIsAdmin(Boolean(profile.isAdmin || getAuthUser()?.isAdmin));
            } catch {
                if (!mounted) return;
                setIsAdmin(Boolean(getAuthUser()?.isAdmin));
            }
        };

        loadRole();
        return () => {
            mounted = false;
        };
    }, [adminOnly]);

    if (!isAuthenticated()) {
        return <Navigate to="/signin" replace />;
    }

    if (adminOnly) {
        const sessionAdmin = Boolean(getAuthUser()?.isAdmin);
        if (isAdmin === false) {
            return (
                <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex items-center justify-center px-4">
                    <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <p className="text-xs uppercase tracking-[0.24em] text-gray-500 mb-3">
                            Admin Access Required
                        </p>
                        <h1 className="text-2xl font-semibold mb-2">
                            You do not have access to this page.
                        </h1>
                        <p className="text-sm text-gray-400 mb-6">
                            This section is reserved for admin accounts. If you believe this is a
                            mistake, sign out and sign back in with an admin account.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <a
                                href="/dashboard"
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
                            >
                                Go to Dashboard
                            </a>
                            <a
                                href="/signin"
                                className="px-4 py-2 rounded-lg bg-accent-blue text-white hover:bg-blue-600 text-sm font-medium transition-colors"
                            >
                                Sign In Again
                            </a>
                        </div>
                    </div>
                </div>
            );
        }
        if (isAdmin === null && !sessionAdmin) {
            return <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center" />;
        }
    }

    return children;
};

export const PublicOnlyRoute = ({ children }: Props) => {
    if (isAuthenticated()) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};
