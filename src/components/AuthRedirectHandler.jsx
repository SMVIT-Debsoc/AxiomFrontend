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
            const isAdminFlow = sessionStorage.getItem("adminAuthFlow") === "true";
            const secretKey = sessionStorage.getItem("adminSecretKey");

            sessionStorage.removeItem("adminAuthFlow");
            sessionStorage.removeItem("adminSecretKey");
            sessionStorage.removeItem("pendingRole");

            try {
                const token = await getToken();

                // 1. ADMIN LOGIN FLOW - ONLY invoked when explicitly logging in as Admin
                if (isAdminFlow) {
                    setStatus("Verifying administrator access...");

                    if (secretKey) {
                        try {
                            await AdminApi.onboard({secretKey}, token);
                        } catch (onboardErr) {
                            console.warn("Admin onboarding check:", onboardErr);
                        }
                    }

                    try {
                        const adminRes = await AdminApi.getProfile(token);
                        if (adminRes?.success && adminRes?.admin) {
                            sessionStorage.setItem("isAdminSession", "true");
                            navigate("/admin", {replace: true});
                            return;
                        }
                    } catch (adminErr) {
                        console.error("Admin verification failed:", adminErr);
                        setRedirectError("Access denied: This Google account is not registered as an Admin, or the Admin Secret Key was incorrect.");
                        return;
                    }

                    setRedirectError("Access denied: This Google account is not an authorized Admin.");
                    return;
                }

                // 2. PARTICIPANT REGISTRATION & LOGIN FLOW
                // Completely separated: NEVER calls any admin endpoint!
                setStatus("Opening your debate workspace...");

                try {
                    const userRes = await UserApi.getProfile(token);
                    const u = userRes?.user;
                    if (!u?.college || !u?.mobile || !u?.usn) {
                        navigate("/complete-profile", {replace: true});
                    } else {
                        navigate("/dashboard", {replace: true});
                    }
                    return;
                } catch {
                    // Backend spin-up retry
                    setStatus("Connecting to debate arena...");
                    await new Promise((res) => setTimeout(res, 1000));

                    try {
                        const freshToken = await getToken();
                        const retryUser = await UserApi.getProfile(freshToken);
                        const u = retryUser?.user;
                        if (!u?.college || !u?.mobile || !u?.usn) {
                            navigate("/complete-profile", {replace: true});
                        } else {
                            navigate("/dashboard", {replace: true});
                        }
                    } catch {
                        // Graceful fallback: authenticated with Google/Clerk, navigate to complete-profile
                        navigate("/complete-profile", {replace: true});
                    }
                }
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
