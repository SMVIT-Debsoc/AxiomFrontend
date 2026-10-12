import {Navigate} from "react-router-dom";

// The public registration route is participant-only. Admins sign in with
// their existing identity and are routed by the API-backed role check.
export default function RoleSelectPage() {
    return <Navigate to="/sign-up" replace />;
}
