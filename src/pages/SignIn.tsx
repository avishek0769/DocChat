import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Terminal, Eye, EyeOff, ArrowRight, GitBranch } from "lucide-react";
import { resetPassword, sendPasswordResetCode, signIn } from "../lib/auth";

const SignIn = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showResetPanel, setShowResetPanel] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const [isSendingResetCode, setIsSendingResetCode] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier || !password) {
            setError("Please fill in all fields.");
            return;
        }

        setError("");
        setIsLoading(true);

        try {
            await signIn(identifier, password);
            navigate("/dashboard");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to sign in. Please try again.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendResetCode = async () => {
        if (!resetEmail) {
            setError("Enter your email for password reset.");
            return;
        }

        setError("");
        setResetMessage("");
        setIsSendingResetCode(true);

        try {
            await sendPasswordResetCode(resetEmail);
            setResetMessage("Reset code sent to your email.");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not send reset code.",
            );
        } finally {
            setIsSendingResetCode(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetEmail || !resetCode || !newPassword) {
            setError("Email, reset code and new password are required.");
            return;
        }

        setError("");
        setResetMessage("");
        setIsResettingPassword(true);

        try {
            await resetPassword(resetEmail, resetCode, newPassword);
            setResetMessage("Password reset successful. You can sign in now.");
            setResetCode("");
            setNewPassword("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not reset password.",
            );
        } finally {
            setIsResettingPassword(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex items-center justify-center font-sans selection:bg-accent-purple/30 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[35%] h-[35%] bg-accent-blue/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[35%] h-[35%] bg-accent-purple/8 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[64px_64px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-10">
                    <Link to="/" className="flex items-center gap-2 group">
                        <Terminal className="w-7 h-7 text-accent-blue group-hover:text-accent-purple transition-colors" />
                        <span className="font-semibold text-2xl tracking-tight">
                            DocChat
                        </span>
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-white/3 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold mb-2">
                            Welcome back
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Sign in to continue to your dashboard
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="johndoe or you@example.com"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                autoComplete="username"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-300">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowResetPanel((prev) => !prev);
                                        setResetEmail(
                                            identifier.includes("@") ? identifier : "",
                                        );
                                        setResetMessage("");
                                    }}
                                    className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="••••••••"
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 pr-12 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 rounded-lg bg-accent-blue hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/20"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {showResetPanel && (
                        <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                            <p className="text-xs text-gray-400">
                                Reset password using email verification code.
                            </p>
                            <input
                                type="email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                placeholder="Email"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    placeholder="Reset code"
                                    className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendResetCode}
                                    disabled={isSendingResetCode}
                                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium"
                                >
                                    {isSendingResetCode ? "Sending..." : "Send code"}
                                </button>
                            </div>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50"
                            />
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={isResettingPassword}
                                className="w-full py-2 rounded-lg bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                            >
                                {isResettingPassword ? "Resetting..." : "Reset Password"}
                            </button>
                            {resetMessage && (
                                <p className="text-xs text-green-400">{resetMessage}</p>
                            )}
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500 font-medium">
                            OR
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Social Login */}
                    <button className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Continue with GitHub
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Don't have an account?{" "}
                    <Link
                        to="/signup"
                        className="text-accent-blue hover:text-accent-blue/80 font-medium transition-colors"
                    >
                        Create one
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};

export default SignIn;
