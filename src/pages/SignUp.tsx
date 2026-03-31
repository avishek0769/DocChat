import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Terminal,
    Eye,
    EyeOff,
    ArrowRight,
    GitBranch,
    Check,
} from "lucide-react";
import {
    registerUser,
    sendVerificationCode,
    verifyEmailCode,
} from "../lib/auth";

const SignUp = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);

    const passwordChecks = [
        { label: "At least 8 characters", met: password.length >= 8 },
        { label: "Contains a number", met: /\d/.test(password) },
        { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    ];

    const allChecksMet = passwordChecks.every((c) => c.met);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !username || !email || !password) {
            setError("Please fill in all fields.");
            return;
        }
        if (!isEmailVerified) {
            setError("Verify your email before creating an account.");
            return;
        }
        if (!allChecksMet) {
            setError("Password does not meet all requirements.");
            return;
        }

        setError("");
        setMessage("");
        setIsLoading(true);

        try {
            await registerUser({
                fullname: name,
                username,
                email,
                password,
            });

            navigate("/signin");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to register. Please try again.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendCode = async () => {
        if (!email) {
            setError("Please enter your email first.");
            return;
        }

        setError("");
        setMessage("");
        setIsSendingCode(true);

        try {
            await sendVerificationCode(email);
            setIsCodeSent(true);
            setMessage("Verification code sent to your email.");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not send verification code.",
            );
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!email || !verificationCode) {
            setError("Enter email and verification code.");
            return;
        }

        setError("");
        setMessage("");
        setIsVerifyingCode(true);

        try {
            await verifyEmailCode(email, verificationCode);
            setIsEmailVerified(true);
            setMessage("Email verified successfully.");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Verification failed.",
            );
        } finally {
            setIsVerifyingCode(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-gray-50 flex items-center justify-center font-sans selection:bg-accent-purple/30 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-5%] w-[30%] h-[30%] bg-accent-purple/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-15%] left-[-5%] w-[30%] h-[30%] bg-accent-blue/8 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[64px_64px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md mx-4 my-8"
            >
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-10">
                    <Link to="/" className="flex items-center gap-2 group">
                        <Terminal className="w-7 h-7 text-accent-blue group-hover:text-accent-purple transition-colors" />
                        <span className="font-semibold text-3xl tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white to-gray-400">
                            DocChat
                        </span>
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-white/3 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold mb-2">
                            Create your account
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Start chatting with any documentation in minutes
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

                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center"
                        >
                            {message}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                autoComplete="name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="johndoe"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                autoComplete="username"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                autoComplete="email"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) =>
                                        setVerificationCode(e.target.value)
                                    }
                                    placeholder="Verification code"
                                    className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={isSendingCode}
                                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium"
                                >
                                    {isSendingCode
                                        ? "Sending..."
                                        : isCodeSent
                                          ? "Resend Code"
                                          : "Send Code"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleVerifyCode}
                                    disabled={isVerifyingCode || isEmailVerified}
                                    className="px-3 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-xs font-medium"
                                >
                                    {isVerifyingCode
                                        ? "Verifying..."
                                        : isEmailVerified
                                          ? "Verified"
                                          : "Verify"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="••••••••"
                                    className="w-full bg-[#111] border border-white/10 rounded-lg px-4 pr-12 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/50 transition-all"
                                    autoComplete="new-password"
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

                            {/* Password strength indicators */}
                            {password.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="mt-3 space-y-1.5"
                                >
                                    {passwordChecks.map((check, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2"
                                        >
                                            <div
                                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                                                    check.met
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-white/5 text-gray-600"
                                                }`}
                                            >
                                                <Check className="w-2.5 h-2.5" />
                                            </div>
                                            <span
                                                className={`text-xs transition-colors ${
                                                    check.met
                                                        ? "text-gray-300"
                                                        : "text-gray-500"
                                                }`}
                                            >
                                                {check.label}
                                            </span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 rounded-lg bg-linear-to-r from-accent-blue to-accent-purple hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/20"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500 font-medium">
                            OR
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Social Signup */}
                    <button className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Sign up with GitHub
                    </button>

                    {/* Terms */}
                    <p className="text-[11px] text-gray-600 text-center mt-5 leading-relaxed">
                        By creating an account, you agree to our{" "}
                        <span className="text-gray-400 hover:text-white cursor-pointer transition-colors">
                            Terms of Service
                        </span>{" "}
                        and{" "}
                        <span className="text-gray-400 hover:text-white cursor-pointer transition-colors">
                            Privacy Policy
                        </span>
                        .
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{" "}
                    <Link
                        to="/signin"
                        className="text-accent-blue hover:text-accent-blue/80 font-medium transition-colors"
                    >
                        Sign in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};

export default SignUp;
