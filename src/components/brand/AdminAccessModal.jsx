import {useState, useEffect} from "react";
import {Shield, KeyRound, X, Loader2, Eye, EyeOff} from "lucide-react";
import {useSignIn} from "../../auth/client.jsx";

export default function AdminAccessModal({isOpen, onClose}) {
    const [secretKey, setSecretKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const {signIn, isLoaded} = useSignIn();

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAdminSignIn = async (e) => {
        e.preventDefault();
        const trimmedKey = secretKey.trim();
        if (!trimmedKey) {
            setError("Please enter the Admin Secret Key.");
            return;
        }

        if (!isLoaded || !signIn) return;
        setBusy(true);
        setError("");

        try {
            // Flag this as an admin authentication flow
            sessionStorage.setItem("adminAuthFlow", "true");
            sessionStorage.setItem("adminSecretKey", trimmedKey);

            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/sso-callback",
                redirectUrlComplete: "/auth-redirect",
            });
        } catch (failure) {
            console.error("Admin sign-in failed:", failure);
            setError(failure.errors?.[0]?.message || failure.message || "Failed to start Google sign-in.");
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
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
                    className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#BDD9CA] hover:bg-[#272922] hover:text-[#EAFBF5] transition"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                <div className="flex flex-col gap-4">
                    {/* Header Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B9F5D8] text-[#141510]">
                        <Shield size={24} strokeWidth={2.5} />
                    </div>

                    <div>
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">Staff & Organisers</p>
                        <h2 id="admin-modal-title" className="m-0 mt-1 font-heading text-2xl font-bold text-[#EAFBF5]">
                            Admin Portal Access
                        </h2>
                        <p className="m-0 mt-2 text-sm leading-relaxed text-[#BDD9CA]">
                            Restricted to adjudicators and tab directors. Enter your Admin Secret Key to sign in to the tournament console.
                        </p>
                    </div>

                    <form onSubmit={handleAdminSignIn} className="mt-2 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-secret-key" className="text-xs font-bold uppercase tracking-[0.06em] text-[#BDD9CA]">
                                Admin Secret Key
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#BDD9CA]">
                                    <KeyRound size={16} />
                                </div>
                                <input
                                    id="admin-secret-key"
                                    type={showKey ? "text" : "password"}
                                    value={secretKey}
                                    onChange={(e) => {
                                        setSecretKey(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter secret key (e.g. Axiom@26)"
                                    className="h-12 w-full rounded-xl border border-[#4A5646] bg-[#141510] pl-10 pr-10 text-sm font-mono text-[#EAFBF5] placeholder-[#6B8F71] focus:border-[#B9F5D8] focus:outline-none focus:ring-2 focus:ring-[#B9F5D8]/40"
                                    autoFocus
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#BDD9CA] hover:text-[#EAFBF5]"
                                    aria-label={showKey ? "Hide secret key" : "Show secret key"}
                                >
                                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
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
                            disabled={busy || !isLoaded}
                            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B9F5D8] text-sm font-bold text-[#141510] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Connecting to Admin Console…</span>
                                </>
                            ) : (
                                <span>Sign in with Google as Admin</span>
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
