import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    Terminal,
    LayoutDashboard,
    MessageSquare,
    Settings as SettingsIcon,
    User,
    LogOut,
} from "lucide-react";
import clsx from "clsx";

export const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const path = location.pathname;

    const navItems = [
        { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { name: "All Chats", path: "/chats", icon: MessageSquare },
        { name: "Settings", path: "/settings", icon: SettingsIcon },
        { name: "Profile", path: "/profile", icon: User },
    ];

    return (
        <aside className="w-64 border-r border-white/5 bg-[#0b0b0f] flex flex-col h-screen sticky top-0 shrink-0">
            <div className="p-6 flex items-center gap-2">
                <Terminal className="w-6 h-6 text-accent-blue" />
                <span className="font-semibold text-xl tracking-tight text-white">
                    DocTalk
                </span>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = path === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={clsx(
                                "flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors text-sm",
                                isActive
                                    ? "bg-white/5 text-white border border-white/5"
                                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent",
                            )}
                        >
                            <Icon
                                className={clsx(
                                    "w-4 h-4",
                                    isActive ? "text-accent-blue" : "",
                                )}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Profile Bottom */}
            <div className="p-4 border-t border-white/5">
                <button
                    onClick={() => navigate("/profile")}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center text-sm font-bold shadow-lg text-white">
                            D
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-gray-200">
                                Developer
                            </p>
                            <p className="text-xs text-gray-500 group-hover:text-gray-400">
                                Pro Plan
                            </p>
                        </div>
                    </div>
                    <LogOut className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>
        </aside>
    );
};
