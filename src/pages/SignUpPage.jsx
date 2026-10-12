import {SignUp} from "../auth/client.jsx";
import AuthFrame from "../components/brand/AuthFrame";

export default function SignUpPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <AuthFrame registration showModeSwitcher>
            <SignUp
                path="/sign-up"
            />
        </AuthFrame>
    );
}
