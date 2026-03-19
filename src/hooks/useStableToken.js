import { useRef, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

/**
 * Returns a stable getToken function that never changes its reference,
 * preventing useCallback/useEffect infinite loops caused by Clerk's
 * getToken being a new function on every render.
 */
export function useStableToken() {
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    // This wrapper's reference never changes
    const stableGetToken = useRef((...args) => getTokenRef.current(...args));
    return stableGetToken.current;
}
