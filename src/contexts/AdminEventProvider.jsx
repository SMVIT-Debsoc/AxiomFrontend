import {useCallback, useEffect, useMemo, useState} from "react";
import {useAuth} from "../auth/client.jsx";
import {EventApi} from "../services/api";
import {AdminEventContext} from "./adminEvent";

const STORAGE_KEY = "axiom.admin.eventId";

function readStored() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export default function AdminEventProvider({children}) {
    const {getToken} = useAuth();
    const [events, setEvents] = useState([]);
    const [selected, setSelected] = useState(readStored);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const token = await getToken();
                const response = await EventApi.list(token);
                if (!cancelled && response.success) setEvents(response.events || []);
            } catch (failure) {
                console.error("Failed to load events", failure);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [getToken]);

    const event = useMemo(() => {
        if (!events.length) return null;
        return events.find((e) => e.id === selected)
            || events.find((e) => ["ACTIVE", "ONGOING"].includes(String(e.status).toUpperCase()))
            || events[0];
    }, [events, selected]);

    const setEventId = useCallback((id) => {
        setSelected(id);
        try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
    }, []);

    const value = useMemo(() => ({events, event, eventId: event?.id || null, setEventId, loading}), [events, event, setEventId, loading]);
    return <AdminEventContext.Provider value={value}>{children}</AdminEventContext.Provider>;
}
