import {SignUp} from "@clerk/clerk-react";
import AuthFrame from "../components/brand/AuthFrame";

export default function SignUpPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <AuthFrame registration>
            <SignUp
                path="/sign-up"
                routing="path"
                signInUrl="/login-select"
                forceRedirectUrl="/auth-redirect"
            />
        </AuthFrame>
    );
}
