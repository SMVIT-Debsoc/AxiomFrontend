import {useEffect} from "react";
import {useAuth, useUser} from "@clerk/clerk-react";
import {setApiAuthTokenProvider} from "../services/api";

export default function ApiAuthSync() {
    const {getToken} = useAuth();
    const {isSignedIn} = useUser();

    useEffect(() => {
        if (!isSignedIn) {
            setApiAuthTokenProvider(null);
            return;
        }

        setApiAuthTokenProvider(getToken);

        return () => {
            setApiAuthTokenProvider(null);
        };
    }, [getToken, isSignedIn]);

    return null;
}
