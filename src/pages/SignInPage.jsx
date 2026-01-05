import {SignIn} from "@clerk/clerk-react";

export default function SignInPage() {
    // Always redirect to auth-redirect which handles admin/user routing
    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <SignIn
                path="/sign-in"
                routing="path"
                signUpUrl="/get-started"
                forceRedirectUrl="/auth-redirect"
            />
        </div>
    );
}
