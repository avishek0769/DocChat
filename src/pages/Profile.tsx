import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { User, Mail, LogOut, Save, Key, CheckCircle2, Trash2, Pencil, X } from "lucide-react";
import { logoutUser, forceSignOut } from "../lib/auth";
import { getUserProfile, deleteMyData } from "../lib/api";
const Profile = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [error, setError] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");

    useEffect(() => {
        const loadProfile = async () => {
            setIsProfileLoading(true);
            try {
                const profile = await getUserProfile();
                setName(profile.fullname || profile.username || "");
                setEmail(profile.email || "");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load profile.");
            } finally {
                setIsProfileLoading(false);
            }
        };
        loadProfile();
    }, []);

    const handleEdit = () => {
        setEditName(name);
        setIsEditing(true);
        setSaved(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditName("");
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setName(editName);
            setIsSaving(false);
            setIsEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 800);
    };

    const handleDeleteData = async () => {
        setIsDeleting(true);
        setDeleteError("");
        try {
            await deleteMyData();
            forceSignOut();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Failed to delete data.");
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleLogout = async () => {
        setShowLogoutConfirm(false);
        await logoutUser();
        navigate("/signin");
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex font-sans selection:bg-accent-purple/30">
            <Sidebar />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto w-full">
                <div className="max-w-3xl mx-auto space-y-10">
                    <header>
                        <h1 className="text-3xl font-bold mb-2">Profile</h1>
                        <p className="text-gray-400 text-sm">Manage your account and preferences.</p>
                    </header>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Profile Card */}
                    <section className="bg-white/3 border border-white/10 rounded-2xl p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-white/5">
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold">{name}</h2>
                                <p className="text-sm text-gray-400">
                                    {isProfileLoading ? "Loading profile..." : email || "-"}
                                </p>
                            </div>
                            {!isEditing && (
                                <button
                                    onClick={handleEdit}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                </button>
                            )}
                        </div>

                        {/* Profile Fields */}
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" /> Display Name
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                        />
                                    ) : (
                                        <p className="w-full bg-[#111]/50 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-gray-300">
                                            {name || "-"}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> Email
                                    </label>
                                    <p className="w-full bg-[#111]/50 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-gray-500">
                                        {email || "-"}
                                    </p>
                                </div>
                            </div>

                            {isEditing && (
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={handleCancel}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-5 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-accent-blue/20"
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {!isEditing && saved && (
                                <div className="flex items-center justify-end pt-2">
                                    <span className="text-sm text-green-400 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Changes saved successfully
                                    </span>
                                </div>
                            )}
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
                                        <p className="text-sm font-medium text-gray-200">API Keys</p>
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

                    {/* Danger Zone — Delete Data */}
                    <section className="bg-red-500/3 border border-red-500/10 rounded-2xl p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-200">Delete all my data</p>
                                <p className="text-xs text-gray-500">
                                    Permanently deletes your chats, messages, API keys, and usage history.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete My Data
                            </button>
                        </div>
                        {deleteError && (
                            <p className="mt-3 text-xs text-red-400">{deleteError}</p>
                        )}
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

            {/* Delete Data Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                    />
                    <div className="relative w-full max-w-sm bg-[#0b0b0f] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Delete all data?</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            This will permanently delete all your chats, messages, API keys, and usage history. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteData}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    "Delete Everything"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <h3 className="text-lg font-semibold mb-2">Sign out?</h3>
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
