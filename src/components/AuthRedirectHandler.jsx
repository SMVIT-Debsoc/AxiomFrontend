import {useEffect, useState} from "react";
import {useUser} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {AdminApi, UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * Maps known OAuth error codes to clear, non-sensitive user messages.
 */
function getReadableAuthErrorMessage(errorCode, errorDesc) {
    if (!errorCode) return "";
    switch (errorCode.toLowerCase()) {
        case "access_denied":
            return "Google sign-in was cancelled or permission was denied. Please try again to continue.";
        case "state_mismatch":
            return "Security verification failed due to an expired or mismatched session. Please try signing in again.";
        case "provider_not_found":
        case "configuration_error":
            return "Google sign-in is currently undergoing maintenance. Please ask an organiser for assistance.";
        case "server_error":
        case "internal_server_error":
            return "The authentication server encountered an error while communicating with Google. Please try again in a few moments.";
        default:
            return errorDesc ? String(errorDesc) : "We could not complete your sign-in. Please try again.";
    }
}

/**
 * Initializes error state from URL search params without requiring an effect setState.
 */
function getInitialUrlError() {
    if (typeof window === "undefined") return "";
    const search = new URLSearchParams(window.location.search);
    const err = search.get("error");
    const errDesc = search.get("error_description");
    return err ? getReadableAuthErrorMessage(err, errDesc) : "";
}

/**
 * Handles post-authentication redirects and surfaces explicit failure states
 * without creating silent redirect loops.
 */
export function AuthRedirectHandler() {
    const {user, isLoaded} = useUser();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");
    const [redirectError, setRedirectError] = useState(getInitialUrlError);

    useEffect(() => {
        if (redirectError) return;
        if (!isLoaded) return;

        const handleRedirect = async () => {
            if (!user) {
                setRedirectError("We could not establish an authenticated session. Please check if cookies are enabled in your browser and try again.");
                return;
            }

            sessionStorage.removeItem("pendingRole");
            sessionStorage.removeItem("adminSecretKey");

            try {
                try {
                    const existing = await AdminApi.getProfile();
                    if (existing?.success && existing?.admin) {
                        navigate("/admin", {replace: true});
                        return;
                    }
                } catch {
                    // Participant accounts are expected to receive a forbidden/not-found admin response.
                }

                setStatus("Setting up your profile...");
                await UserApi.getProfile();
                navigate("/dashboard", {replace: true});
            } catch (error) {
                console.error("Auth redirect error:", error);
                setRedirectError(error.message || "We could not finish setting up your account.");
            }
        };

        handleRedirect();
    }, [isLoaded, user, navigate, redirectError]);

    if (redirectError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md text-center">
                    <h2 className="mb-2 text-2xl font-bold">Authentication failed</h2>
                    <p role="alert" className="mb-6 text-muted-foreground">{redirectError}</p>
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
