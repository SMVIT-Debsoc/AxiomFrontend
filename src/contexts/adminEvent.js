import {createContext, useContext} from "react";

/** Selected event for the organiser workspace: {events, event, eventId, setEventId, loading}. */
export const AdminEventContext = createContext({events: [], event: null, eventId: null, setEventId: () => {}, loading: true});

export function useAdminEvent() {
    return useContext(AdminEventContext);
}
