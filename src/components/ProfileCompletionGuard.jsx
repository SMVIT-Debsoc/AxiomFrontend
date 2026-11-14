import {useState, useEffect} from "react";
import {useUser, useAuth} from "../auth/client.jsx";
import {Link, Navigate, useLocation, useNavigate} from "react-router-dom";
import {UserApi, clearApiCache} from "../services/api";
import {ProfileHeaderSkeleton, CardSkeleton} from "./ui/Skeleton";

/**
 * ProfileCompletionGuard - Ensures user has completed mandatory profile fields
 * (college, mobile and USN) before accessing dashboard features.
 * Redirects to /complete-profile if profile is incomplete.
 */
export function ProfileCompletionGuard({children}) {
  const {user, isLoaded} = useUser();
  const {getToken, signOut} = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [retrying, setRetrying] = useState(false);
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
            response.user?.college && response.user?.mobile && response.user?.usn
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

  const handleRetry = async () => {
    setError("");
    setRetrying(true);
    setChecking(true);
    try {
      clearApiCache("/users");
      const token = await getToken({skipCache: true});
      const response = await UserApi.getProfile(token);
      setIsProfileComplete(Boolean(response.user?.college && response.user?.mobile && response.user?.usn));
    } catch (failure) {
      setError(failure.message || "Retry failed.");
    } finally {
      setRetrying(false);
      setChecking(false);
    }
  };

  const handleSwitchAccount = () => {
    clearApiCache();
    signOut().catch(() => navigate("/", {replace: true}));
  };

  if (error) return (
    <div className="min-h-svh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="mb-2 text-2xl font-semibold text-foreground">We could not verify your profile</h2>
        <p role="alert" className="mb-5 text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="axiom-button axiom-button--green justify-center"
            onClick={handleRetry}
            disabled={retrying}
            aria-busy={retrying}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="min-h-11 rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Use a different account
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
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
