import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import {Loader2, ShieldX} from "lucide-react";
import {AdminApi} from "../services/api";

export function AdminGuard({children}) {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const verifyAdmin = async () => {
            if (!isLoaded) return;

            if (!user) {
                navigate("/login-select");
                return;
            }

            try {
                const token = await getToken();

                // First, check if this is a new admin trying to onboard
                const pendingRole = sessionStorage.getItem("pendingRole");
                const secretKey = sessionStorage.getItem("adminSecretKey");

                if (pendingRole === "admin" && secretKey) {
                    // Try to onboard as admin
                    try {
                        await AdminApi.onboard(secretKey, token);
                        // Clear session storage
                        sessionStorage.removeItem("pendingRole");
                        sessionStorage.removeItem("adminSecretKey");
                        setIsAdmin(true);
                        setChecking(false);
                        return;
                    } catch (onboardError) {
                        // If onboarding fails, check if already an admin
                        console.log(
                            "Onboard failed, checking existing admin status"
                        );
                    }
                }

                // Check if user is already an admin
                const response = await AdminApi.getProfile(token);
                if (response.success && response.admin) {
                    setIsAdmin(true);
                } else {
                    setError("You do not have admin access");
                }
            } catch (err) {
                console.error("Admin verification failed:", err);
                setError(
                    "Admin verification failed. You may not have admin access."
                );
            } finally {
                // Clear any pending admin session data
                sessionStorage.removeItem("pendingRole");
                sessionStorage.removeItem("adminSecretKey");
                setChecking(false);
            }
        };

        verifyAdmin();
    }, [isLoaded, user, getToken, navigate]);

    if (!isLoaded || checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">
                        Verifying admin access...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center max-w-md px-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <ShieldX className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-6">
                        {error ||
                            "You do not have permission to access the admin dashboard."}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium"
                        >
                            Go to User Dashboard
                        </button>
                        <button
                            onClick={() => navigate("/login-select")}
                            className="w-full py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                            Sign in with different account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}
