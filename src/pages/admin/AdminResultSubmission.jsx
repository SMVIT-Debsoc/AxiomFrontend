import {useCallback, useEffect, useState} from "react";
import {Navigate, useParams} from "react-router-dom";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi} from "../../services/api";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import LoadError from "../../components/ui/LoadError";

// Ballot entry now lives in the Live Results station. This route looks up the
// debate's round and lands there with the ballot sheet open.
export default function AdminResultSubmission() {
    const {id: debateId} = useParams();
    return <ResultRedirect key={debateId} debateId={debateId} />;
}

function ResultRedirect({debateId}) {
    const {getToken} = useAuth();
    const [roundId, setRoundId] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const token = await getToken();
                const res = await AdminApi.apiRequest(`/debates/${debateId}`, "GET", null, token, {skipCache: true});
                if (!active) return;
                const id = res?.debate?.roundId || res?.debate?.round?.id;
                if (id) setRoundId(id);
                else setError("This debate has no round.");
            } catch (err) {
                if (active) setError(err?.message || "Could not load this debate.");
            }
        })();
        return () => { active = false; };
    }, [debateId, getToken, attempt]);

    const retry = useCallback(() => {
        setError(null);
        setAttempt((n) => n + 1);
    }, []);

    if (roundId) {
        return <Navigate to={`/admin?round=${encodeURIComponent(roundId)}&station=results&debate=${encodeURIComponent(debateId)}`} replace />;
    }
    if (error) {
        return (
            <div className="mx-auto mt-10 max-w-lg px-4">
                <LoadError message="Could not open this ballot." detail={error} onRetry={retry} />
            </div>
        );
    }
    return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Opening ballot" /></div>;
}
