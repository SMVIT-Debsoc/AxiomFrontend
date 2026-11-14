import {useState, useEffect} from "react";
import {useUser} from "../auth/client.jsx";
import {useNavigate} from "react-router-dom";
import {ShieldX} from "lucide-react";
import {AdminApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

export function AdminGuard({children}) {
    const {user, isLoaded} = useUser();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState(null);

    const hasSecretAdminSession =
        typeof window !== "undefined" &&
        sessionStorage.getItem("isAdminSession") === "true" &&
        Boolean(sessionStorage.getItem("adminSecretKey")?.trim());

    useEffect(() => {
        const verifyAdmin = async () => {
            if (!hasSecretAdminSession && !isLoaded) return;

            if (!hasSecretAdminSession && !user) {
                navigate("/");
                return;
            }

            const envSecretKey = (
                import.meta.env.VITE_ADMIN_SECRET_KEY ||
                import.meta.env.ADMIN_SECRET_KEY ||
                ""
            ).trim();
            const storedKey =
                typeof window !== "undefined"
                    ? (sessionStorage.getItem("adminSecretKey") || "").trim()
                    : "";

            if (hasSecretAdminSession && envSecretKey && storedKey !== envSecretKey) {
                sessionStorage.removeItem("isAdminSession");
                sessionStorage.removeItem("adminSecretKey");
                window.dispatchEvent(new Event("axiom-admin-session-changed"));
                setError("Invalid Admin Secret Key");
                setChecking(false);
                return;
            }

            try {
                const response = await AdminApi.getProfile();
                if (response.success && response.admin) {
                    setIsAdmin(true);
                } else {
                    setError("You do not have admin access");
                }
            } catch (err) {
                console.error("Admin verification failed:", err);
                if (hasSecretAdminSession) {
                    sessionStorage.removeItem("isAdminSession");
                    sessionStorage.removeItem("adminSecretKey");
                    window.dispatchEvent(new Event("axiom-admin-session-changed"));
                }
                setError(err.status === 401 || err.status === 403 || /forbidden|unauthorized|invalid/i.test(err.message || "")
                    ? "You do not have admin access"
                    : "Admin verification failed. Please try again.");
            } finally {
                setChecking(false);
            }
        };

        verifyAdmin();
    }, [isLoaded, user, navigate, hasSecretAdminSession]);

    if ((!hasSecretAdminSession && !isLoaded) || checking) {
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
                            onClick={() => navigate("/")}
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
