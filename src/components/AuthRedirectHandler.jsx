import {useEffect, useState} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import {Loader2} from "lucide-react";
import {AdminApi, UserApi} from "../services/api";

/**
 * This component handles post-authentication redirects.
 * It checks if the user is trying to sign in as admin or user
 * and redirects accordingly after verifying credentials.
 */
export function AuthRedirectHandler() {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");

    useEffect(() => {
        const handleRedirect = async () => {
            if (!isLoaded) return;

            if (!user) {
                navigate("/login-select", {replace: true});
                return;
            }

            try {
                const token = await getToken();

                // Check if admin login is pending
                const pendingRole = localStorage.getItem("pendingRole");
                const secretKey = localStorage.getItem("adminSecretKey");

                if (pendingRole === "admin" && secretKey) {
                    setStatus("Verifying admin credentials...");

                    // First, check if user is already an admin
                    try {
                        const adminCheck = await AdminApi.getProfile(token);
                        if (adminCheck.success && adminCheck.admin) {
                            // Already an admin, go to admin dashboard
                            localStorage.removeItem("pendingRole");
                            localStorage.removeItem("adminSecretKey");
                            setStatus("Welcome back, Admin!");
                            navigate("/admin", {replace: true});
                            return;
                        }
                    } catch (e) {
                        // Not an existing admin, try to onboard
                    }

                    // Try to onboard as new admin
                    try {
                        const response = await AdminApi.onboard(
                            secretKey,
                            token
                        );
                        localStorage.removeItem("pendingRole");
                        localStorage.removeItem("adminSecretKey");

                        if (response.success) {
                            setStatus("Admin access granted! Redirecting...");
                            navigate("/admin", {replace: true});
                            return;
                        }
                    } catch (onboardError) {
                        console.log("Onboard error:", onboardError.message);

                        // Check if error is "already admin"
                        if (onboardError.message?.includes("already")) {
                            localStorage.removeItem("pendingRole");
                            localStorage.removeItem("adminSecretKey");
                            navigate("/admin", {replace: true});
                            return;
                        }

                        // Invalid secret key
                        localStorage.removeItem("pendingRole");
                        localStorage.removeItem("adminSecretKey");
                        setStatus("Invalid admin credentials. Redirecting...");
                        setTimeout(
                            () => navigate("/dashboard", {replace: true}),
                            1500
                        );
                        return;
                    }
                }

                // No pending admin role - check if returning admin
                try {
                    const adminResponse = await AdminApi.getProfile(token);
                    if (adminResponse.success && adminResponse.admin) {
                        // User is an admin, redirect to admin dashboard
                        localStorage.removeItem("pendingRole");
                        localStorage.removeItem("adminSecretKey");
                        navigate("/admin", {replace: true});
                        return;
                    }
                } catch (e) {
                    // Not an admin, continue to user dashboard
                }

                // Clear any pending data and go to user dashboard
                localStorage.removeItem("pendingRole");
                localStorage.removeItem("adminSecretKey");
                setStatus("Setting up your profile...");
                await UserApi.getProfile(token);
                navigate("/dashboard", {replace: true});
            } catch (error) {
                console.error("Auth redirect error:", error);
                localStorage.removeItem("pendingRole");
                localStorage.removeItem("adminSecretKey");
                navigate("/dashboard", {replace: true});
            }
        };

        handleRedirect();
    }, [isLoaded, user, getToken, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Please wait...</p>
                <p className="text-muted-foreground">{status}</p>
            </div>
        </div>
    );
}
