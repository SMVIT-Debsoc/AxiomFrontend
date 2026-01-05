import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export default function SignUpPage() {
    const [searchParams] = useSearchParams();
    const role = searchParams.get('role');
    
    // Determine redirect URL based on role
    const redirectUrl = role === 'admin' ? '/admin' : '/dashboard';
    
    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <SignUp 
                path="/sign-up" 
                routing="path" 
                signInUrl="/login-select" 
                forceRedirectUrl={redirectUrl}
            />
        </div>
    );
}
