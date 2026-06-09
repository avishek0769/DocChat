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
        if (isAdmin === false || (!sessionAdmin && isAdmin === null)) {
            return <Navigate to="/dashboard" replace />;
        }
        if (isAdmin === null && !sessionAdmin) {
            return <div className="min-h-screen bg-[#0b0b0f]" />;
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
