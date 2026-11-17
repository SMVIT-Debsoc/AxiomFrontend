import {useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useAuth} from "../../auth/client.jsx";
import {decodeReturnTo, RETURN_TO_KEY} from "../../lib/opsLinks";

/**
 * Sign-in always finishes on /dashboard (AuthRedirectHandler), or on
 * /complete-profile first. When a venue check-in link started the sign-in,
 * send the debater back to it once they reach the dashboard.
 */
export default function ResumePendingReturn() {
  const {isLoaded, isSignedIn} = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || location.pathname !== "/dashboard") return;
    let path = null;
    try {
      path = decodeReturnTo(window.localStorage.getItem(RETURN_TO_KEY));
      window.localStorage.removeItem(RETURN_TO_KEY);
    } catch {
      path = null;
    }
    if (path) navigate(path, {replace: true});
  }, [isLoaded, isSignedIn, location.pathname, navigate]);

  return null;
}
