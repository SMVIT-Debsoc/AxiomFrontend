import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate, useLocation} from "react-router-dom";
import {UserApi, AdminApi} from "../services/api";

export function OnboardingGuard({children}) {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const syncAndCheckProfile = async () => {
            if (isLoaded && user) {
                try {
                    const token = await getToken();

                    // Check if admin onboarding is pending
                    const pendingRole = sessionStorage.getItem("pendingRole");
                    const secretKey = sessionStorage.getItem("adminSecretKey");

                    if (pendingRole === "admin" && secretKey) {
                        try {
                            // Try to onboard as admin
                            await AdminApi.onboard(secretKey, token);
                            // Clear session and redirect to admin dashboard
                            sessionStorage.removeItem("pendingRole");
                            sessionStorage.removeItem("adminSecretKey");
                            navigate("/admin", {replace: true});
                            return;
                        } catch (error) {
                            console.error("Admin onboarding failed:", error);
                            // Clear invalid admin session
                            sessionStorage.removeItem("pendingRole");
                            sessionStorage.removeItem("adminSecretKey");
                        }
                    }

                    // Sync user with backend database (creates user if doesn't exist)
                    const response = await UserApi.getProfile(token);

                    // Check if profile is complete based on backend response
                    const isProfileComplete =
                        response.user?.isProfileComplete ||
                        (response.user?.college && response.user?.usn);

                    const isOnProfilePage =
                        location.pathname === "/dashboard/profile";

                    if (!isProfileComplete && !isOnProfilePage) {
                        // If profile is incomplete and not on profile page, redirect to profile
                        navigate("/dashboard/profile", {replace: true});
                    }
                } catch (error) {
                    console.error("Error syncing user profile:", error);
                    // Even if sync fails, allow access but user might need to complete profile
                }
                setChecking(false);
            } else if (isLoaded && !user) {
                setChecking(false);
            }
        };

        syncAndCheckProfile();
    }, [isLoaded, user, location.pathname, navigate, getToken]);

    if (checking || !isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                Loading...
            </div>
        );
    }

    return children;
}
