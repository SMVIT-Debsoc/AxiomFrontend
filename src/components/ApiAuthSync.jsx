import {useEffect, useRef, useState} from "react";
import {useAuth, useUser} from "../auth/client.jsx";
import {setApiAuthTokenProvider} from "../services/api";

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
    const socket = useRef(null);

    useEffect(() => {
        const handleSync = () => setAdminSessionActive(hasSecretAdminSession());
        window.addEventListener("axiom-admin-session-changed", handleSync);
        return () => window.removeEventListener("axiom-admin-session-changed", handleSync);
    }, []);

    useEffect(() => {
        if (!isSignedIn && !adminSessionActive) {
            setApiAuthTokenProvider(null);
            socket.current?.setAuthProvider(null);
            socket.current?.disconnect();
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
        let disposed = false;
        import("../services/socket").then(({socketService}) => {
            if (disposed) return;
            socket.current = socketService;
            socketService.setAuthProvider(tokenProvider);
            // A socket opened before sign-in or admin unlock has stale credentials.
            socketService.refreshAuth();
        }).catch(error => {
            if (!disposed) console.error("Unable to initialize live updates:", error);
        });

        return () => {
            disposed = true;
            setApiAuthTokenProvider(null);
            socket.current?.setAuthProvider(null);
        };
    }, [getToken, isSignedIn, adminSessionActive]);

    return null;
}
