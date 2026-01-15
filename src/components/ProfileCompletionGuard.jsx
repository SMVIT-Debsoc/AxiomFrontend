import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {Navigate, useLocation} from "react-router-dom";
import {UserApi} from "../services/api";
import {ProfileHeaderSkeleton, CardSkeleton} from "./ui/Skeleton";

/**
 * ProfileCompletionGuard - Ensures user has completed mandatory profile fields
 * (college and mobile) before accessing dashboard features.
 * Redirects to /complete-profile if profile is incomplete.
 */
export function ProfileCompletionGuard({children}) {
  const {user, isLoaded} = useUser();
  const {getToken} = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      if (isLoaded && user) {
        try {
          const token = await getToken();
          const response = await UserApi.getProfile(token);

          // Check if mandatory fields are complete
          const profileComplete = !!(
            response.user?.college && response.user?.mobile
          );
          setIsProfileComplete(profileComplete);
        } catch (error) {
          console.error("Error checking profile:", error);
          // On error, allow access but they may hit issues later
          setIsProfileComplete(true);
        }
        setChecking(false);
      } else if (isLoaded && !user) {
        setChecking(false);
      }
    };

    checkProfile();
  }, [isLoaded, user, getToken]);

  if (checking || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-2xl w-full space-y-6">
          <ProfileHeaderSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // If profile incomplete, redirect to complete-profile page
  if (!isProfileComplete) {
    return (
      <Navigate
        to="/complete-profile"
        replace
        state={{from: location.pathname}}
      />
    );
  }

  return children;
}
