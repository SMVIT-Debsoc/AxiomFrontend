import {useState, useEffect} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {ShieldX} from "lucide-react";
import {AdminApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

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

                // First, check if this is a new admin trying to onboard (from localStorage)
                const pendingRole = sessionStorage.getItem("pendingRole");
                const secretKey = sessionStorage.getItem("adminSecretKey");

                if (pendingRole === "admin" && secretKey) {
                    // Try to onboard as admin
                    try {
                        const response = await AdminApi.onboard(
                            secretKey,
                            token
                        );
                        // Clear localStorage
                        sessionStorage.removeItem("pendingRole");
                        sessionStorage.removeItem("adminSecretKey");

                        if (response.success) {
                            setIsAdmin(true);
                            setChecking(false);
                            return;
                        }
                    } catch (onboardError) {
                        // If onboarding fails, check if already an admin
                        console.log(
                            "Onboard failed, checking existing admin status:",
                            onboardError.message
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
                setError(err.status === 403 || /forbidden/i.test(err.message || "")
                    ? "You do not have admin access"
                    : "Admin verification failed. Please try again.");
            } finally {
                // Clear any pending admin data
                sessionStorage.removeItem("pendingRole");
                sessionStorage.removeItem("adminSecretKey");
                setChecking(false);
            }
        };

        verifyAdmin();
    }, [isLoaded, user, getToken, navigate]);

    if (!isLoaded || checking) {
        return <LoadingIndicator fullScreen label="Verifying admin access" />;
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
