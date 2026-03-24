import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import {
    User,
    Mail,
    Shield,
    LogOut,
    Camera,
    Save,
    Key,
    Bell,
    Moon,
    CheckCircle2,
} from "lucide-react";

const Profile = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("Developer");
    const [email] = useState("developer@example.com");
    const [bio, setBio] = useState(
        "Full-stack developer passionate about building AI-powered tools."
    );
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Preferences
    const [notifications, setNotifications] = useState(true);
    const [darkMode] = useState(true);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 800);
    };

    const handleLogout = () => {
        setShowLogoutConfirm(false);
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-3xl mx-auto space-y-10">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">Profile</h1>
                        <p className="text-gray-400 text-sm">
                            Manage your account and preferences.
                        </p>
                    </header>

                    {/* Profile Card */}
                    <section className="bg-white/3 border border-white/10 rounded-2xl p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-white/5">
                            {/* Avatar */}
                            <div className="relative group">
                                <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-accent-blue to-accent-purple flex items-center justify-center text-2xl font-bold shadow-lg shadow-accent-blue/20">
                                    {name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()
                                        .slice(0, 2) || "D"}
                                </div>
                                <button className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera className="w-5 h-5 text-white" />
                                </button>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold">{name}</h2>
                                <p className="text-sm text-gray-400">{email}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-medium">
                                        Pro Plan
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                                        Active
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" /> Display
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        disabled
                                        className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-400">
                                    Bio
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={3}
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-accent-blue/20"
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : saved ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-green-300" />
                                            Saved!
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Preferences */}
                    <section className="bg-white/3 border border-white/10 rounded-2xl p-6 md:p-8">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-accent-blue" />
                            Preferences
                        </h3>

                        <div className="space-y-4">
                            {/* Notification Toggle */}
                            <div className="flex items-center justify-between py-3 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-4 h-4 text-gray-400" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-200">
                                            Email Notifications
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Receive updates when processing
                                            completes
                                        </p>
                                    </div>
                                </div>
                                <label className="relative flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={notifications}
                                        onChange={(e) =>
                                            setNotifications(e.target.checked)
                                        }
                                    />
                                    <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-accent-blue/30 transition-colors" />
                                    <div className="absolute left-1 w-3.5 h-3.5 bg-gray-400 rounded-full peer-checked:translate-x-5 peer-checked:bg-accent-blue transition-transform" />
                                </label>
                            </div>

                            {/* Dark Mode Toggle */}
                            <div className="flex items-center justify-between py-3 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <Moon className="w-4 h-4 text-gray-400" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-200">
                                            Dark Mode
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Always on for the best experience
                                        </p>
                                    </div>
                                </div>
                                <label className="relative flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={darkMode}
                                        disabled
                                    />
                                    <div className="w-10 h-5 bg-accent-blue/30 rounded-full opacity-50 cursor-not-allowed" />
                                    <div className="absolute left-1 w-3.5 h-3.5 bg-accent-blue rounded-full translate-x-5 opacity-50" />
                                </label>
                            </div>

                            {/* API Keys Quick Link */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <Key className="w-4 h-4 text-gray-400" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-200">
                                            API Keys
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Manage your provider API keys
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate("/settings")}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 transition-colors"
                                >
                                    Manage
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="bg-red-500/3 border border-red-500/10 rounded-2xl p-6 md:p-8">
                        <h3 className="text-lg font-semibold mb-4 text-red-400">
                            Danger Zone
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-200">
                                    Sign out of your account
                                </p>
                                <p className="text-xs text-gray-500">
                                    You will need to sign in again to access your
                                    data.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                className="px-5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </section>
                </div>
            </main>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowLogoutConfirm(false)}
                    />
                    <div className="relative w-full max-w-sm bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <LogOut className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            Sign out?
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Are you sure you want to sign out of your account?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
