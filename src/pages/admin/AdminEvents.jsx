import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Calendar, Plus, Search, Edit, Trash2, MessageCircle, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/client.jsx";
import { AdminApi, EventApi } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { SocketEvents, useLiveRefresh, invalidateRealtimeCache } from "../../hooks/useSocket";
import { useLatestRequest, useSocketRefresh } from "../../hooks/useAdminRealtime";
import { useAdminMutation } from "../../hooks/useAdminMutation";
import { useAdminEvent } from "../../contexts/adminEvent";
import LoadError from "../../components/ui/LoadError";
import EmptyState from "../../components/ui/EmptyState";
import EventFormModal from "./setup/EventModals";

const STATUS_CHIP = {
  ONGOING: "ax-chip--ok",
  UPCOMING: "ax-chip--info",
  COMPLETED: "ax-chip--idle",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

function EventsSkeleton() {
  return (
    <div role="status" aria-label="Loading events" className="space-y-2.5">
      {[0, 1, 2].map((i) => <div key={i} className="ax-card h-[72px] animate-pulse bg-muted/50" />)}
    </div>
  );
}

/** Setup → Events: every tournament, create / edit / delete, pick the current one. */
export default function AdminEvents() {
  const { getToken } = useAuth();
  const toast = useToast();
  const { eventId: currentEventId, setEventId } = useAdminEvent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState(null); // {mode:"create"} | {mode:"edit", event}
  const [loadError, setLoadError] = useState(null);
  const { run, isBusy } = useAdminMutation();
  const latest = useLatestRequest();

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    const request = latest.begin();
    try {
      if (!silent) setLoading(true);
      const token = await getTokenRef.current();
      const response = await EventApi.list(token, null, { skipCache: silent, signal: request.signal });
      // Ignore a slower, older response that lands after a newer one.
      if (!latest.isCurrent(request.id)) return;
      setEvents(response.events || response.data || []);
      setLoadError(null);
    } catch (err) {
      if (!latest.isCurrent(request.id)) return;
      console.error("Failed to fetch events", err);
      setLoadError(err?.message || "Failed to load events");
    } finally {
      if (latest.isCurrent(request.id)) setLoading(false);
    }
  }, [latest]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useLiveRefresh(() => fetchEvents({ silent: true }));

  // Several admins editing at once produce bursts; each burst collapses into one refetch.
  useSocketRefresh(
    [SocketEvents.EVENT_CREATED, SocketEvents.EVENT_UPDATED_GLOBAL, SocketEvents.EVENT_DELETED_GLOBAL],
    () => {
      invalidateRealtimeCache();
      fetchEvents({ silent: true });
    },
  );
  // Other admins' important actions get a toast immediately; only the refetch is debounced.
  useSocketRefresh([SocketEvents.EVENT_DELETED_GLOBAL], () => {
    toast.info("Event deleted", "Another admin deleted an event.");
  }, { delay: 0 });

  const q = searchQuery.trim().toLowerCase();
  const filteredEvents = events.filter((event) => !q || String(event.name || "").toLowerCase().includes(q));

  const handleDeleteEvent = (event) =>
    run(
      `delete:${event.id}`,
      async () => {
        const token = await getToken();
        return AdminApi.deleteEvent(event.id, token);
      },
      {
        confirm: `Delete "${event.name}"? All its rounds, draws and ballots are lost. This cannot be undone.`,
        success: "Event deleted",
        onSuccess: () => {
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
          fetchEvents({ silent: true });
        },
        onConflict: () => fetchEvents({ silent: true }),
      }
    );

  const toolbar = (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative block flex-1">
        <span className="sr-only">Search events</span>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search events"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-9 pr-4 rounded-xl border-[1.5px] border-input bg-card text-base sm:text-[15px]"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fetchEvents()}
          disabled={loading}
          className="ax-ghost-btn !min-h-11 !min-w-11 !px-0"
          title="Refresh"
          aria-label="Refresh events"
        >
          <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setModal({ mode: "create" })} className="ax-primary-btn flex-1 !min-h-11 !text-sm sm:flex-none">
          <Plus className="w-4 h-4" aria-hidden="true" /> New event
        </button>
      </div>
    </div>
  );

  let body;
  if (loading && events.length === 0) {
    body = <EventsSkeleton />;
  } else if (loadError && events.length === 0) {
    body = <LoadError message="Could not load events." detail={loadError} onRetry={() => fetchEvents()} />;
  } else if (filteredEvents.length === 0) {
    body = (
      <EmptyState
        title={q ? "Nothing matched" : "No events yet"}
        description={q ? "No event matches your search." : "Create your first event to get started."}
        action={!q && (
          <button type="button" onClick={() => setModal({ mode: "create" })} className="ax-primary-btn !min-h-11 !text-sm">
            <Plus size={16} aria-hidden="true" /> New event
          </button>
        )}
      />
    );
  } else {
    body = (
      <>
        {loadError && <LoadError compact message="Could not refresh events. Showing the last loaded list." onRetry={() => fetchEvents()} busy={loading} />}

        {/* Desktop table */}
        <div className="ax-card hidden overflow-hidden md:block">
          <table className="w-full text-left text-[15px]" aria-label="Events">
            <thead className="border-b border-border text-xs uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3">Event</th>
                <th scope="col" className="px-5 py-3 whitespace-nowrap">Starts</th>
                <th scope="col" className="px-5 py-3 whitespace-nowrap">Rounds</th>
                <th scope="col" className="px-5 py-3 whitespace-nowrap">Status</th>
                <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEvents.map((event) => {
                const current = event.id === currentEventId;
                return (
                  <tr key={event.id} className={cn("hover:bg-muted/30", current && "bg-muted/40")}>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/setup/${event.id}`} onClick={() => setEventId(event.id)} className="font-heading font-semibold text-foreground hover:underline">
                          {event.name}
                        </Link>
                        {current && <span className="ax-chip ax-chip--idle">Current</span>}
                        {event.whatsappLink && (
                          <span className="ax-chip ax-chip--idle" title={event.whatsappLink}>
                            <MessageCircle className="w-3 h-3" aria-hidden="true" /> WhatsApp
                          </span>
                        )}
                      </div>
                      <p className="m-0 line-clamp-1 text-xs text-muted-foreground">{event.description || "No description"}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap tabular-nums">{formatDate(event.startDate)}</td>
                    <td className="px-5 py-3.5 text-sm whitespace-nowrap tabular-nums">{event.rounds?.length || 0}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><span className={cn("ax-chip uppercase", STATUS_CHIP[event.status] || "ax-chip--idle")}>{event.status}</span></td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setModal({ mode: "edit", event })} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${event.name}`} title="Edit event">
                          <Edit className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => handleDeleteEvent(event)} disabled={isBusy(`delete:${event.id}`)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label={`Delete ${event.name}`} title="Delete event">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <Link to={`/admin/setup/${event.id}`} onClick={() => setEventId(event.id)} className="ax-ghost-btn !min-h-11 !text-sm">
                          Rounds <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phone cards */}
        <div className="md:hidden space-y-2.5">
          {filteredEvents.map((event) => {
            const current = event.id === currentEventId;
            return (
              <div key={event.id} className={cn("ax-card flex flex-col gap-2 p-3.5", current && "border-2")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="m-0 truncate font-heading font-semibold">{event.name}</p>
                      <p className="m-0 text-xs text-muted-foreground tabular-nums">{formatDate(event.startDate)} · {event.rounds?.length || 0} rounds</p>
                    </div>
                  </div>
                  <span className={cn("ax-chip shrink-0 uppercase", STATUS_CHIP[event.status] || "ax-chip--idle")}>{event.status}</span>
                </div>
                <div className="flex items-center gap-1 border-t border-border pt-2">
                  <Link to={`/admin/setup/${event.id}`} onClick={() => setEventId(event.id)} className="ax-ghost-btn mr-auto !min-h-11 !text-sm">
                    {current ? "Current · Rounds" : "Rounds"} <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <button type="button" onClick={() => setModal({ mode: "edit", event })} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={`Edit ${event.name}`}>
                    <Edit className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => handleDeleteEvent(event)} disabled={isBusy(`delete:${event.id}`)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label={`Delete ${event.name}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {body}
      {modal && (
        <EventFormModal
          event={modal.mode === "edit" ? modal.event : null}
          onClose={() => setModal(null)}
          onSaved={(response) => {
            const createdId = modal.mode === "create" ? response?.event?.id || response?.data?.id : null;
            setModal(null);
            fetchEvents({ silent: true });
            if (createdId) setEventId(createdId);
          }}
        />
      )}
    </div>
  );
}
