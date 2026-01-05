import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function OnboardingGuard({ children }) {
    const { user, isLoaded } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (isLoaded && user) {
            const hasPhone = user.publicMetadata?.mobile || user.primaryPhoneNumber;
            const hasCollege = user.publicMetadata?.college;
            const hasUSN = user.publicMetadata?.usn;

            const isProfileComplete = hasPhone && hasCollege && hasUSN;
            const isOnProfilePage = location.pathname === '/dashboard/profile';

            if (!isProfileComplete && !isOnProfilePage) {
                // If profile is incomplete and not on profile page, redirect to profile
                navigate('/dashboard/profile', { replace: true });
            }
            setChecking(false);
        } else if (isLoaded && !user) {
            setChecking(false);
        }
    }, [isLoaded, user, location.pathname, navigate]);

    if (checking || !isLoaded) {
        return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
    }

    return children;
}
