import {useState, useEffect} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
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
  const [error, setError] = useState("");

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
        } catch (failure) {
          console.error("Error checking profile:", failure);
          setError(failure.message || "Your profile could not be checked.");
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

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="mb-2 text-xl font-semibold">We could not verify your profile</h2>
        <p role="alert" className="mb-5 text-muted-foreground">{error}</p>
        <button className="axiom-button axiom-button--green" onClick={() => { setError(""); setChecking(true); UserApi.getProfile().then((response) => { setIsProfileComplete(Boolean(response.user?.college && response.user?.mobile)); setChecking(false); }).catch((failure) => { setError(failure.message || "Retry failed."); setChecking(false); }); }}>Retry</button>
      </div>
    </div>
  );

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
