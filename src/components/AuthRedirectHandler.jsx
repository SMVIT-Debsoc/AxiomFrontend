import {useEffect, useState} from "react";
import {useUser} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {ShieldX} from "lucide-react";
import {AdminApi, UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * This component handles post-authentication redirects.
 * It checks if the user is trying to sign in as admin or user
 * and redirects accordingly after verifying credentials.
 */
export function AuthRedirectHandler() {
    const {user, isLoaded} = useUser();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");
    const [accessDenied, setAccessDenied] = useState(false);
    const [redirectError, setRedirectError] = useState("");

    useEffect(() => {
        const handleRedirect = async () => {
            if (!isLoaded) return;
            if (!user) {
                navigate("/login-select", {replace: true});
                return;
            }
            const pendingRole = sessionStorage.getItem("pendingRole");
            const secretKey = sessionStorage.getItem("adminSecretKey");
            try {
                if (pendingRole === "admin" && secretKey) {
                    setStatus("Verifying admin credentials...");
                    try {
                        const existing = await AdminApi.getProfile();
                        if (existing.success && existing.admin) {
                            sessionStorage.removeItem("pendingRole");
                            sessionStorage.removeItem("adminSecretKey");
                            navigate("/admin", {replace: true});
                            return;
                        }
                    } catch {
                        // A new verified account has no admin row yet; onboarding below decides access.
                    }
                    try {
                        const response = await AdminApi.onboard(secretKey);
                        if (response.success) {
                            sessionStorage.removeItem("pendingRole");
                            sessionStorage.removeItem("adminSecretKey");
                            navigate("/admin", {replace: true});
                            return;
                        }
                    } catch (error) {
                        sessionStorage.removeItem("pendingRole");
                        sessionStorage.removeItem("adminSecretKey");
                        if (/invalid admin secret key/i.test(error.message || "")) setAccessDenied(true);
                        else setRedirectError(error.message || "Admin setup could not be completed.");
                        return;
                    }
                }
                try {
                    const existing = await AdminApi.getProfile();
                    if (existing.success && existing.admin) {
                        sessionStorage.removeItem("pendingRole");
                        sessionStorage.removeItem("adminSecretKey");
                        navigate("/admin", {replace: true});
                        return;
                    }
                } catch {
                    // Participant accounts are expected to receive a forbidden/not-found admin response.
                }
                setStatus("Setting up your profile...");
                await UserApi.getProfile();
                sessionStorage.removeItem("pendingRole");
                sessionStorage.removeItem("adminSecretKey");
                navigate("/dashboard", {replace: true});
            } catch (error) {
                console.error("Auth redirect error:", error);
                setRedirectError(error.message || "We could not finish setting up your account.");
            }
        };
        handleRedirect();
    }, [isLoaded, user, navigate]);

    // Show access denied screen for invalid admin secret key
    if (accessDenied) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center max-w-md px-4">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <ShieldX className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-6">
                        The admin secret key you entered is incorrect. You are
                        not authorized to access the admin dashboard.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() =>
                                navigate("/dashboard", {replace: true})
                            }
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                        >
                            Continue as Debater
                        </button>
                        <button
                            onClick={() =>
                                navigate("/login-select", {replace: true})
                            }
                            className="w-full py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
