import {useEffect} from "react";
import {setApiAuthRefreshProvider} from "../services/api";
import {authClient} from "../auth/client";
import {socketService} from "../services/socket";

/** Refresh the cookie-backed Better Auth session once after an API 401. */
export default function ApiAuthSync() {
  const authState = authClient.useSession();
  const sessionId = authState.data?.session?.id;
  useEffect(() => {
    setApiAuthRefreshProvider(async () => {
      const result = await authClient.getSession();
      return Boolean(result.data?.session);
    });
    return () => setApiAuthRefreshProvider(null);
  }, []);
  useEffect(() => {
    if (!authState.isPending && !sessionId) socketService.disconnect();
  }, [authState.isPending, sessionId]);
  return null;
}
