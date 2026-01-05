import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import { AdminApi, UserApi } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * This component handles post-authentication redirects.
 * It checks if the user is trying to sign in as admin or user
 * and redirects accordingly after verifying credentials.
 */
export function AuthRedirectHandler() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Verifying your credentials...");
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const handleRedirect = async () => {
            if (!isLoaded) return;

            if (!user) {
                navigate("/login-select", { replace: true });
                return;
            }

            try {
                const token = await getToken();

                // Check if admin login is pending
                const pendingRole = localStorage.getItem("pendingRole");
                const secretKey = localStorage.getItem("adminSecretKey");

                if (pendingRole === "admin" && secretKey) {
                    setStatus("Verifying admin credentials...");

                    // First, check if user is already an admin (silently)
                    try {
                        const adminCheckResponse = await fetch(`${API_BASE_URL}/admin/me`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (adminCheckResponse.ok) {
                            const adminCheck = await adminCheckResponse.json();
                            if (adminCheck.success && adminCheck.admin) {
                                // Already an admin, go to admin dashboard
                                localStorage.removeItem("pendingRole");
                                localStorage.removeItem("adminSecretKey");
                                setStatus("Welcome back, Admin!");
                                navigate("/admin", { replace: true });
                                return;
                            }
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
                            navigate("/admin", { replace: true });
                            return;
                        }
                    } catch (onboardError) {
                        console.log("Onboard error:", onboardError.message);

                        // Check if error is "already admin"
                        if (onboardError.message?.includes("already")) {
                            localStorage.removeItem("pendingRole");
                            localStorage.removeItem("adminSecretKey");
                            navigate("/admin", { replace: true });
                            return;
                        }

                        // Invalid secret key - show access denied
                        localStorage.removeItem("pendingRole");
                        localStorage.removeItem("adminSecretKey");
                        setAccessDenied(true);
                        return;
                    }
                }

                // No pending admin role - check if returning admin (silently)
                try {
                    const adminCheckResponse = await fetch(`${API_BASE_URL}/admin/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (adminCheckResponse.ok) {
                        const adminResponse = await adminCheckResponse.json();
                        if (adminResponse.success && adminResponse.admin) {
                            // User is an admin, redirect to admin dashboard
                            localStorage.removeItem("pendingRole");
                            localStorage.removeItem("adminSecretKey");
                            navigate("/admin", { replace: true });
                            return;
                        }
                    }
                } catch (e) {
                    // Not an admin, continue to user dashboard
                }

                // Clear any pending data and go to user dashboard
                localStorage.removeItem("pendingRole");
                localStorage.removeItem("adminSecretKey");
                setStatus("Setting up your profile...");
                await UserApi.getProfile(token);
                navigate("/dashboard", { replace: true });
            } catch (error) {
                console.error("Auth redirect error:", error);
                localStorage.removeItem("pendingRole");
                localStorage.removeItem("adminSecretKey");
                navigate("/dashboard", { replace: true });
            }
        };

        handleRedirect();
    }, [isLoaded, user, getToken, navigate]);

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
                                navigate("/dashboard", { replace: true })
                            }
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                        >
                            Continue as Debater
                        </button>
                        <button
                            onClick={() =>
                                navigate("/login-select", { replace: true })
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
