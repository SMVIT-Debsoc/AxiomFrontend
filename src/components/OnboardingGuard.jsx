import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import {UserApi} from "../services/api";
import LoadingIndicator from "./ui/LoadingIndicator";

/**
 * OnboardingGuard - Handles user authentication and syncs user to backend.
 * Does NOT handle profile completion redirects (that's ProfileCompletionGuard's job).
 */
export function OnboardingGuard({children}) {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const syncUser = async () => {
            if (isLoaded && user) {
                try {
                    const token = await getToken();
                    // Sync user with backend database (creates user if doesn't exist)
                    await UserApi.getProfile(token);
                } catch (error) {
                    console.error("Error syncing user profile:", error);
                }
                setChecking(false);
            } else if (isLoaded && !user) {
                // Not authenticated, redirect to login
                navigate("/login-select", {replace: true});
                setChecking(false);
            }
        };

        syncUser();
    }, [isLoaded, user, navigate, getToken]);

    if (checking || !isLoaded) {
        return <LoadingIndicator fullScreen label="Synchronizing your account" />;
    }

    if (!user) {
        return null;
    }

    return children;
}
