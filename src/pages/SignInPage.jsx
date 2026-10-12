import {SignIn} from "../auth/client.jsx";
import AuthFrame from "../components/brand/AuthFrame";

export default function SignInPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <AuthFrame showModeSwitcher>
            <SignIn
            />
        </AuthFrame>
    );
}
