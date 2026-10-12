import {useRef, useEffect, useCallback} from "react";
import {useAuth} from "../auth/client.jsx";

/**
 * Returns a stable compatibility function for session-cookie authentication.
 */
export function useStableToken() {
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    return useCallback((...args) => getTokenRef.current(...args), []);
}
