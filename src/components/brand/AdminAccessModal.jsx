import {useState, useEffect} from "react";
import {Shield, KeyRound, X, Loader2, Eye, EyeOff} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {AdminApi, clearApiCache} from "../../services/api";

export default function AdminAccessModal({isOpen, onClose}) {
    const [secretKey, setSecretKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAdminUnlock = async (e) => {
        e.preventDefault();
        const trimmedKey = secretKey.trim();
        if (!trimmedKey) {
            setError("Please enter the Admin Secret Key.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            const envSecretKey = (
                import.meta.env.VITE_ADMIN_SECRET_KEY ||
                import.meta.env.ADMIN_SECRET_KEY ||
                ""
            ).trim();

            if (envSecretKey) {
                if (trimmedKey !== envSecretKey) {
                    setError("Invalid Admin Secret Key. Access denied.");
                    setBusy(false);
                    return;
                }
            } else {
                const res = await AdminApi.validateKey(trimmedKey);
                if (!res?.valid) {
                    setError("Invalid Admin Secret Key. Access denied.");
                    setBusy(false);
                    return;
                }
            }

            sessionStorage.setItem("isAdminSession", "true");
            sessionStorage.setItem("adminSecretKey", trimmedKey);
            sessionStorage.removeItem("adminAuthFlow");
            clearApiCache();
            window.dispatchEvent(new Event("axiom-admin-session-changed"));

            setBusy(false);
            onClose();
            navigate("/admin");
        } catch (failure) {
            console.error("Admin key verification failed:", failure);
            setError(failure.message || "Invalid Admin Secret Key. Access denied.");
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/75 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-modal-title"
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#4A5646] bg-[#1D1E18] p-6 text-[#EAFBF5] shadow-2xl md:p-8"
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-[#BDD9CA] hover:bg-[#272922] hover:text-[#EAFBF5] transition"
                    aria-label="Close"
                >
                    <X size={18} aria-hidden="true" />
                </button>

                <div className="flex flex-col gap-4">
                    {/* Header Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B9F5D8] text-[#141510]">
                        <Shield size={24} strokeWidth={2.5} aria-hidden="true" />
                    </div>

                    <div>
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">Staff & Organisers</p>
                        <h2 id="admin-modal-title" className="m-0 mt-1 font-heading text-2xl font-bold text-[#EAFBF5]">
                            Admin Portal Access
                        </h2>
                        <p className="m-0 mt-2 text-sm leading-relaxed text-[#BDD9CA]">
                            Restricted to tournament organisers. Enter the Admin Secret Key to open the organiser console directly.
                        </p>
                    </div>

                    <form onSubmit={handleAdminUnlock} className="mt-2 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-secret-key" className="text-xs font-bold uppercase tracking-[0.06em] text-[#BDD9CA]">
                                Admin Secret Key
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#BDD9CA]">
                                    <KeyRound size={16} aria-hidden="true" />
                                </div>
                                <input
                                    id="admin-secret-key"
                                    type={showKey ? "text" : "password"}
                                    value={secretKey}
                                    onChange={(e) => {
                                        setSecretKey(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter admin secret key"
                                    autoComplete="off"
                                    className="h-12 w-full rounded-xl border border-[#4A5646] bg-[#141510] pl-10 pr-12 text-xs sm:text-sm font-mono text-[#EAFBF5] placeholder-[#6B8F71] focus:border-[#B9F5D8] focus:outline-none focus:ring-2 focus:ring-[#B9F5D8]/40"
                                    autoFocus
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#BDD9CA] hover:text-[#EAFBF5]"
                                    aria-label={showKey ? "Hide secret key" : "Show secret key"}
                                >
                                    {showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className="m-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={busy}
                            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B9F5D8] text-sm font-bold text-[#141510] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                                    <span>Verifying Secret Key…</span>
                                </>
                            ) : (
                                <span>Enter Admin Console</span>
                            )}
                        </button>
                    </form>

                    <p className="m-0 text-center text-xs text-[#6B8F71]">
                        Are you a participant? Close this dialog and click <strong>Sign in</strong> on the main page.
                    </p>
                </div>
            </div>
        </div>
    );
}
