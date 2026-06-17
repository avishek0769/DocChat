import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isImpersonating, getImpersonationInfo, stopImpersonation } from "../lib/auth";
import { adminStopImpersonation } from "../lib/api";

const ImpersonationBanner = () => {
    const navigate = useNavigate();
    const [stopping, setStopping] = useState(false);

    if (!isImpersonating()) return null;

    const info = getImpersonationInfo();
    const targetName = info?.targetUser?.fullname || info?.targetUser?.username || "User";

    const handleStop = async () => {
        setStopping(true);
        const restored = stopImpersonation();
        if (restored) {
            try {
                await adminStopImpersonation();
            } catch {
                // stop-impersonation is best-effort audit
            }
        }
        navigate("/admin/users");
    };

    return (
        <div className="sticky top-0 z-50 w-full bg-amber-600/90 backdrop-blur-sm border-b border-amber-500/30">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                <p className="text-amber-50 text-sm font-medium">
                    You are impersonating <span className="font-bold">{targetName}</span>
                </p>
                <button
                    onClick={handleStop}
                    disabled={stopping}
                    className="px-3 py-1 rounded-md bg-amber-800/60 text-amber-50 text-xs font-medium hover:bg-amber-700/60 disabled:opacity-50"
                >
                    {stopping ? "Stopping..." : "Stop Impersonation"}
                </button>
            </div>
        </div>
    );
};

export default ImpersonationBanner;
