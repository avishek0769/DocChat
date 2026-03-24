import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import {
    User,
    Mail,
    Shield,
    LogOut,
    Save,
    Key,
    CheckCircle2,
} from "lucide-react";

const Profile = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("Developer");
    const [email] = useState("developer@example.com");
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold">{name}</h2>
                                <p className="text-sm text-gray-400">{email}</p>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" /> Display Name
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
                        <div className="space-y-4">
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

                    {/* Logout */}
                    <section className="bg-red-500/3 border border-red-500/10 rounded-2xl p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-200">
                                    Sign out of your account
                                </p>
                                <p className="text-xs text-gray-500">
                                    You will need to sign in again to access your data.
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
