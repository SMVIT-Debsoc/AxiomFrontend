import {useState, useEffect} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
import {Link, useNavigate} from "react-router-dom";
import {UserApi, clearApiCache} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * OnboardingGuard - Handles user authentication and syncs user to backend.
 * Does NOT handle profile completion redirects (that's ProfileCompletionGuard's job).
 */
export function OnboardingGuard({children}) {
    const {user, isLoaded} = useUser();
    const {getToken, signOut} = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const syncUser = async () => {
            if (isLoaded && user) {
                try {
                    const token = await getToken();
                    // Sync user with backend database (creates user if doesn't exist)
                    await UserApi.getProfile(token);
                } catch (failure) {
                    console.error("Error syncing user profile:", failure);
                    setError(failure.message || "Your account could not be synchronized.");
                }
                setChecking(false);
            } else if (isLoaded && !user) {
                // Not authenticated, redirect to login
                navigate("/", {replace: true});
                setChecking(false);
            }
        };

        syncUser();
    }, [isLoaded, user, navigate, getToken]);

    if (checking || !isLoaded) {
        return <LoadingIndicator fullScreen label="Synchronizing your account" />;
    }

    if (!user) {
        return null;
    }

    const handleRetry = async () => {
        setError("");
        setRetrying(true);
        setChecking(true);
        try {
            clearApiCache("/users");
            const token = await getToken({skipCache: true});
            await UserApi.getProfile(token);
        } catch (failure) {
            setError(failure.message || "Retry failed.");
        } finally {
            setRetrying(false);
            setChecking(false);
        }
    };

    const handleSwitchAccount = () => {
        clearApiCache();
        signOut().catch(() => navigate("/", {replace: true}));
    };

    if (error) return (
        <div className="min-h-svh flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
                <h2 className="mb-2 text-2xl font-semibold text-foreground">Account setup is unavailable</h2>
                <p role="alert" className="mb-5 text-sm text-muted-foreground">{error}</p>
                <div className="flex flex-col gap-2.5">
                    <button
                        type="button"
                        className="axiom-button axiom-button--green justify-center"
                        onClick={handleRetry}
                        disabled={retrying}
                        aria-busy={retrying}
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        onClick={handleSwitchAccount}
                        className="min-h-11 rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                        Use a different account
                    </button>
                    <Link
                        to="/"
                        className="inline-flex min-h-11 items-center justify-center text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Back to home
                    </Link>
                </div>
            </div>
        </div>
    );

    return children;
}
