import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
    Terminal,
    LayoutDashboard,
    MessageSquare,
    Settings as SettingsIcon,
    User,
    LogOut,
    Activity,
} from "lucide-react";
import clsx from "clsx";
import { getApiKeyCount, getUserProfile } from "../lib/api";

interface SidebarProps {
    isCollapsed?: boolean;
}

export const Sidebar = ({ isCollapsed = false }: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const path = location.pathname;
    const [profileName, setProfileName] = useState("User");
    const [profileSubline, setProfileSubline] = useState("-");

    useEffect(() => {
        let mounted = true;

        const loadSidebarProfile = async () => {
            try {
                const [profile, keyCount] = await Promise.all([getUserProfile(), getApiKeyCount()]);

                if (!mounted) return;

                const displayName =
                    profile.fullname?.trim() ||
                    profile.username?.trim() ||
                    profile.email?.trim() ||
                    "User";

                setProfileName(displayName);
                setProfileSubline(`${keyCount.count || 0} API keys`);
            } catch {
                if (!mounted) return;
                setProfileName("User");
                setProfileSubline("-");
            }
        };

        loadSidebarProfile();

        return () => {
            mounted = false;
        };
    }, []);

    const profileInitial = useMemo(() => {
        return (profileName?.trim()?.charAt(0) || "U").toUpperCase();
    }, [profileName]);

    const navItems = [
        { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { name: "All Chats", path: "/chats", icon: MessageSquare },
        { name: "Usage", path: "/usage", icon: Activity },
        { name: "Settings", path: "/settings", icon: SettingsIcon },
        { name: "Profile", path: "/profile", icon: User },
    ];

    return (
        <aside
            className={clsx(
                "border-r border-white/5 bg-[#0b0b0f] flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300",
                isCollapsed ? "w-20" : "w-64",
            )}
        >
            <div className={clsx("p-6 flex items-center gap-2", isCollapsed && "justify-center px-0")}>
                <Terminal className="w-6 h-6 text-accent-blue shrink-0" />
                {!isCollapsed && (
                    <span className="font-semibold text-xl tracking-tight text-white">DocChat</span>
                )}
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = path === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            title={isCollapsed ? item.name : undefined}
                            className={clsx(
                                "flex items-center rounded-lg font-medium transition-colors text-sm",
                                isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                                isActive
                                    ? "bg-white/5 text-white border border-white/5"
                                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent",
                            )}
                        >
                            <Icon
                                className={clsx("w-5 h-5 shrink-0", isActive ? "text-accent-blue" : "")}
                            />
                            {!isCollapsed && item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Profile Bottom */}
            <div className="p-4 border-t border-white/5">
                <button
                    onClick={() => navigate("/profile")}
                    title={isCollapsed ? "Profile" : undefined}
                    className={clsx(
                        "w-full flex items-center rounded-lg hover:bg-white/5 transition-colors group",
                        isCollapsed ? "justify-center p-2" : "justify-between p-2",
                    )}
                >
                    <div
                        className={clsx(
                            "flex items-center gap-3",
                            isCollapsed && "justify-center w-full",
                        )}
                    >
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center text-sm font-bold shadow-lg text-white shrink-0">
                            {profileInitial}
                        </div>
                        {!isCollapsed && (
                            <div className="text-left whitespace-nowrap overflow-hidden">
                                <p className="text-sm font-medium text-gray-200">{profileName}</p>
                                <p className="text-xs text-gray-500 group-hover:text-gray-400">
                                    {profileSubline}
                                </p>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <LogOut className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                </button>
            </div>
        </aside>
    );
};
