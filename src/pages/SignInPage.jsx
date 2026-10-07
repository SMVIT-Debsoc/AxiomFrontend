import {SignIn} from "@clerk/clerk-react";
import AuthFrame from "../components/brand/AuthFrame";

export default function SignInPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <AuthFrame>
            <SignIn
                path="/sign-in"
                routing="path"
                signUpUrl="/get-started"
                forceRedirectUrl="/auth-redirect"
            />
        </AuthFrame>
    );
}
