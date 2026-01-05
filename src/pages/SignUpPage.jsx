import {SignUp} from "@clerk/clerk-react";

export default function SignUpPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <SignUp
                path="/sign-up"
                routing="path"
                signInUrl="/login-select"
                forceRedirectUrl="/auth-redirect"
            />
        </div>
    );
}
