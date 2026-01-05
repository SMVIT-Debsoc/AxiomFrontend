import {SignIn} from "@clerk/clerk-react";
import {useSearchParams} from "react-router-dom";

export default function SignInPage() {
    const [searchParams] = useSearchParams();
    const role = searchParams.get("role");

    // Determine redirect URL based on role
    // If admin role is pending in session, AdminGuard will handle the redirect
    const redirectUrl = role === "admin" ? "/admin" : "/dashboard";

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <SignIn
                path="/sign-in"
                routing="path"
                signUpUrl="/get-started"
                forceRedirectUrl={redirectUrl}
            />
        </div>
    );
}
