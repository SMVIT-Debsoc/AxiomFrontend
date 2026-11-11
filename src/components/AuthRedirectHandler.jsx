import {useEffect, useState} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {AdminApi, UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

function getInitialUrlError() {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    if (error === "access_denied") {
        return "Sign-in was cancelled. Please try again.";
    }
    if (error === "state_mismatch") {
        return "Authentication state verification failed. Please try signing in again.";
    }
    if (error) {
        return errorDescription || `Authentication error: ${error}`;
    }
    return "";
}

/**
 * Handles post-authentication redirects for Clerk.
 * Directs admins to /admin and participants to /dashboard.
 */
export function AuthRedirectHandler() {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");
    const [redirectError, setRedirectError] = useState(getInitialUrlError);

    const unauthenticatedError = isLoaded && !user ? "Authentication failed or was cancelled. Please return to sign in." : "";
    const effectiveError = redirectError || unauthenticatedError;

    useEffect(() => {
        if (!isLoaded || effectiveError || !user) return;

        const handleRedirect = async () => {
            sessionStorage.removeItem("pendingRole");
            sessionStorage.removeItem("adminSecretKey");

            try {
                const token = await getToken();

                try {
                    const existing = await AdminApi.getProfile(token);
                    if (existing?.success && existing?.admin) {
                        navigate("/admin", {replace: true});
                        return;
                    }
                } catch {
                    // Participant accounts are expected to receive a forbidden/not-found admin response.
                }

                setStatus("Setting up your profile...");
                await UserApi.getProfile(token);
                navigate("/dashboard", {replace: true});
            } catch (error) {
                console.error("Auth redirect error:", error);
                setRedirectError(error.message || "We could not finish setting up your account.");
            }
        };

        handleRedirect();
    }, [isLoaded, user, effectiveError, getToken, navigate]);

    if (effectiveError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md text-center">
                    <h2 className="mb-2 text-2xl font-bold">Authentication failed</h2>
                    <p role="alert" className="mb-6 text-muted-foreground">{effectiveError}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            type="button"
                            className="axiom-button axiom-button--green"
                            onClick={() => navigate("/", {replace: true})}
                        >
                            Return to Sign in
                        </button>
                        <button
                            type="button"
                            className="axiom-button axiom-button--subtle"
                            onClick={() => window.location.reload()}
                        >
                            Retry verification
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <LoadingIndicator fullScreen label={status || "Verifying your credentials..."} />;
}
