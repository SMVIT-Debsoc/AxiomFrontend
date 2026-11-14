import {useEffect, useState} from "react";
import {useAuth, useUser} from "../auth/client.jsx";
import {setApiAuthTokenProvider} from "../services/api";
import {socketService} from "../services/socket";

function hasSecretAdminSession() {
    if (typeof window === "undefined") return false;
    return (
        sessionStorage.getItem("isAdminSession") === "true" &&
        Boolean(sessionStorage.getItem("adminSecretKey")?.trim())
    );
}

export default function ApiAuthSync() {
    const {getToken} = useAuth();
    const {isSignedIn} = useUser();
    const [adminSessionActive, setAdminSessionActive] = useState(hasSecretAdminSession);

    useEffect(() => {
        const handleSync = () => setAdminSessionActive(hasSecretAdminSession());
        window.addEventListener("axiom-admin-session-changed", handleSync);
        return () => window.removeEventListener("axiom-admin-session-changed", handleSync);
    }, []);

    useEffect(() => {
        if (!isSignedIn && !adminSessionActive) {
            setApiAuthTokenProvider(null);
            socketService.setAuthProvider(null);
            socketService.disconnect();
            return;
        }

        const tokenProvider = async (options) => {
            if (isSignedIn) {
                try {
                    const clerkToken = await getToken(options);
                    if (clerkToken) return clerkToken;
                } catch {
                    // Fallback to secret key session if present
                }
            }
            if (hasSecretAdminSession()) {
                return `admin-secret:${sessionStorage.getItem("adminSecretKey").trim()}`;
            }
            return null;
        };

        setApiAuthTokenProvider(tokenProvider);
        socketService.setAuthProvider(tokenProvider);
        // A socket opened before sign-in / admin unlock has stale (anonymous) auth.
        socketService.refreshAuth();

        return () => {
            setApiAuthTokenProvider(null);
            socketService.setAuthProvider(null);
        };
    }, [getToken, isSignedIn, adminSessionActive]);

    return null;
}
