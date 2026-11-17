import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../auth/client.jsx";
import {EventApi} from "../services/api";
import {SocketEvents} from "../services/socket";
import {useLatestRequest, useSocketRefresh} from "../hooks/useAdminRealtime";
import {AdminEventContext} from "./adminEvent";

const STORAGE_KEY = "axiom.admin.eventId";
// ?event=<id> makes a page link shareable between admins; localStorage is the fallback.
export const EVENT_PARAM = "event";

function readStored() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStored(id) {
    try {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage unavailable */ }
}

export default function AdminEventProvider({children}) {
    const {getToken} = useAuth();
    const [events, setEvents] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const urlEventId = searchParams.get(EVENT_PARAM);
    const [selected, setSelected] = useState(() => urlEventId || readStored());
    // Adopt an event named in the URL (a pasted link, back/forward) during render.
    const [adoptedUrlId, setAdoptedUrlId] = useState(urlEventId);
    if (urlEventId && urlEventId !== adoptedUrlId) {
        setAdoptedUrlId(urlEventId);
        setSelected(urlEventId);
    }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const latest = useLatestRequest();
    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

    const refreshEvents = useCallback(async ({skipCache = true} = {}) => {
        const request = latest.begin();
        try {
            const token = await getTokenRef.current();
            const response = await EventApi.list(token, null, {skipCache, signal: request.signal});
            if (!latest.isCurrent(request.id)) return;
            if (response.success) setEvents(response.events || []);
            setError(null);
        } catch (failure) {
            if (!latest.isCurrent(request.id)) return;
            console.error("Failed to load events", failure);
            setError(failure?.message || "Failed to load events");
        } finally {
            if (latest.isCurrent(request.id)) setLoading(false);
        }
    }, [latest]);

    useEffect(() => {
        void refreshEvents({skipCache: false});
    }, [getToken, refreshEvents]);

    // Keep the event switcher in sync with other admins creating, renaming or deleting events.
    useSocketRefresh(
        [SocketEvents.EVENT_CREATED, SocketEvents.EVENT_UPDATED_GLOBAL, SocketEvents.EVENT_DELETED_GLOBAL],
        () => { void refreshEvents(); },
    );

    // Drop a deleted selection immediately so pages stop requesting a missing event.
    useSocketRefresh([SocketEvents.EVENT_DELETED_GLOBAL], (data) => {
        const deletedId = data?.eventId || data?.id || data?.event?.id;
        if (!deletedId) return;
        setEvents((prev) => prev.filter((e) => e.id !== deletedId));
        setSelected((current) => {
            if (current !== deletedId) return current;
            writeStored(null);
            return null;
        });
    }, {delay: 0});

    // Falls back to the ongoing event, then the first one, when the stored
    // selection no longer exists (e.g. another admin deleted it).
    const event = useMemo(() => {
        if (!events.length) return null;
        return events.find((e) => e.id === selected)
            || events.find((e) => ["ACTIVE", "ONGOING"].includes(String(e.status).toUpperCase()))
            || events[0];
    }, [events, selected]);

    const setEventId = useCallback((id) => {
        setSelected(id);
        writeStored(id);
    }, []);

    const resolvedId = event?.id || null;
    useEffect(() => {
        if (resolvedId) writeStored(resolvedId);
    }, [resolvedId]);

    // Mirror the resolved event into ?event= (replace, so history is not spammed).
    useEffect(() => {
        if (!resolvedId || urlEventId === resolvedId) return;
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(EVENT_PARAM, resolvedId);
            return next;
        }, {replace: true});
    }, [resolvedId, urlEventId, setSearchParams]);

    const value = useMemo(
        () => ({events, event, eventId: event?.id || null, setEventId, loading, error, refreshEvents}),
        [events, event, setEventId, loading, error, refreshEvents],
    );
    return <AdminEventContext.Provider value={value}>{children}</AdminEventContext.Provider>;
}
