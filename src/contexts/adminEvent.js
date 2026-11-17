import {createContext, useContext} from "react";

/**
 * Selected event for the organiser workspace:
 * {events, event, eventId, setEventId, loading, error, refreshEvents}.
 * The list stays live via EVENT_CREATED / EVENT_UPDATED_GLOBAL / EVENT_DELETED_GLOBAL.
 */
export const AdminEventContext = createContext({
    events: [],
    event: null,
    eventId: null,
    setEventId: () => {},
    loading: true,
    error: null,
    refreshEvents: async () => {},
});

export function useAdminEvent() {
    return useContext(AdminEventContext);
}
