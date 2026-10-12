import {useEffect, useState} from "react";
import {useUser} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {AdminApi, UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * This component handles post-authentication redirects.
 * Existing admins go to the protected admin workspace; everyone else follows
 * participant profile completion and event enrollment.
 */
export function AuthRedirectHandler() {
    const {user, isLoaded} = useUser();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");
    const [redirectError, setRedirectError] = useState("");

    useEffect(() => {
        const handleRedirect = async () => {
            if (!isLoaded) return;
            if (!user) {
                navigate("/login-select", {replace: true});
                return;
            }
            // Remove values left by the retired public admin-onboarding screen.
            sessionStorage.removeItem("pendingRole");
            sessionStorage.removeItem("adminSecretKey");
            try {
                try {
                    const existing = await AdminApi.getProfile();
                    if (existing.success && existing.admin) {
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
    }, [isLoaded, user, navigate]);

    if (redirectError) return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-md text-center">
                <h2 className="mb-2 text-2xl font-bold">Account setup could not finish</h2>
                <p role="alert" className="mb-5 text-muted-foreground">{redirectError}</p>
                <button className="axiom-button axiom-button--green" onClick={() => window.location.reload()}>Try again</button>
            </div>
        </div>
    );
    return <LoadingIndicator fullScreen label={status || "Verifying your credentials..."} />;
}
