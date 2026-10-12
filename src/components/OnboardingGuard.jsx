import {useState, useEffect} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * OnboardingGuard - Handles user authentication and syncs user to backend.
 * Does NOT handle profile completion redirects (that's ProfileCompletionGuard's job).
 */
export function OnboardingGuard({children}) {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
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
                navigate("/login-select", {replace: true});
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

    if (error) return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md text-center">
                <h2 className="mb-2 text-xl font-semibold">Account setup is unavailable</h2>
                <p role="alert" className="mb-5 text-muted-foreground">{error}</p>
                <button className="axiom-button axiom-button--green" onClick={() => { setError(""); setChecking(true); UserApi.getProfile().then(() => setChecking(false)).catch((failure) => { setError(failure.message || "Retry failed."); setChecking(false); }); }}>Retry</button>
            </div>
        </div>
    );

    return children;
}
