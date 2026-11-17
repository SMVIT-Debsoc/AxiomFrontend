import {usePageRequests} from "../../hooks/usePageRequests";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, Settings, Activity, Loader2, X, ChevronRight, ExternalLink } from "lucide-react";
import { cn, formatTimeIST } from "../../lib/utils";
import { useAuth } from "../../auth/client.jsx";
import { AdminApi } from "../../services/api";
import { useEventSocket, useLiveRefresh } from "../../hooks/useSocket";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import { useAdminMutation } from "../../hooks/useAdminMutation";
import { advanceTargetLabel } from "../../lib/advanceTarget";
import EventFormModal from "./setup/EventModals";
import { CreateRoundModal, EditRoundModal } from "./setup/RoundModals";

// Setup → Rounds for one event: the round sequence, per-round settings (incl.
// advance target), create / edit / delete. Enrolment lives in People.

const ADMIN_EVENT_FIELDS = ["event", "rounds", "stats"];

const ROUND_STATE = {
  ONGOING: ["Live", "ax-state-live"],
  COMPLETED: ["Done", "ax-state-done"],
  UPCOMING: ["Waiting", "ax-state-waiting"],
};

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export default function AdminEventDetails({ eventId: eventIdProp }) {
  const { id } = useParams();
  const eventId = eventIdProp || id;
  if (!eventId) {
    return <EmptyState compact title="No event selected" description="Pick or create an event in the Events tab first." />;
  }
  return <AdminEventPage key={eventId} eventId={eventId} />;
}

function RoundStateChip({ status }) {
  const [label, cls] = ROUND_STATE[String(status).toUpperCase()] || ROUND_STATE.UPCOMING;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold", cls)}>
      <span className="ax-state-dot" aria-hidden="true" />{label}
    </span>
  );
}

function AdminEventPage({eventId}) {
  const { getToken } = useAuth();
  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [deletingRoundId, setDeletingRoundId] = useState(null);
  const [loadErrors, setLoadErrors] = useState({});
  // Bumped whenever a live round event names the round currently open in the editor.
  const [editingRoundChanges, setEditingRoundChanges] = useState(0);
  const { run } = useAdminMutation();

  const refresh = usePageRequests(ADMIN_EVENT_FIELDS, async (field, token, options, isCurrent) => {
    if (field === "event" && !options.skipCache) setLoading(true);
    try {
      const url = {
        event: `/events/${eventId}?view=metadata`,
        rounds: `/rounds/event/${eventId}?view=summary`,
        stats: `/stats/event/${eventId}`,
      }[field];
      const response = await AdminApi.apiRequest(url, "GET", null, token, options);
      if (!isCurrent() || !response.success) return;
      if (field === "event") setEvent(response.event);
      if (field === "rounds") setRounds(response.rounds || []);
      if (field === "stats") setStats(response.data);
      setLoadErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Failed to fetch event data:", error);
      setLoadErrors((prev) => ({
        ...prev,
        [field]: { message: error?.message || "Request failed", status: error?.status },
      }));
    } finally {
      if (isCurrent() && field === "event") setLoading(false);
      if (isCurrent() && field === "rounds") setRoundsLoading(false);
    }
  }, undefined, eventId);

  const fetchData = () => refresh(...ADMIN_EVENT_FIELDS);
  useLiveRefresh(fetchData, {enabled: Boolean(eventId), eventId, jitterMs: 3000, invalidateCache: false});
  const editingRoundId = editingRound?.id || null;
  const onRoundChanged = (data) => {
    refresh("rounds", "stats");
    if (editingRoundId && (!data?.roundId || data.roundId === editingRoundId)) {
      setEditingRoundChanges((n) => n + 1);
    }
  };
  useEventSocket(eventId, {
    onEventUpdated: () => refresh("event"),
    onRoundCreated: () => refresh("rounds", "stats"),
    onRoundUpdated: onRoundChanged,
    onRoundDeleted: onRoundChanged,
    onEventEnrollment: () => refresh("stats"),
    onRoundStatusChange: onRoundChanged,
    onPairingsPublished: onRoundChanged,
    onRoundCheckInWindow: onRoundChanged,
    onDebateResult: () => refresh("stats"),
    onDebateCreated: () => refresh("stats"),
    onDebateDeleted: () => refresh("stats"),
  });

  const handleDeleteRound = (round) =>
    run(
      `delete-round:${round.id}`,
      async () => {
        setDeletingRoundId(round.id);
        try {
          const token = await getToken();
          return await AdminApi.deleteRound(round.id, token);
        } finally {
          setDeletingRoundId(null);
        }
      },
      {
        confirm: `Delete ${round.name}? Its draw and ballots are lost. This cannot be undone.`,
        success: "Round deleted",
        onSuccess: () => refresh("rounds", "stats"),
        onConflict: () => refresh("rounds", "stats"),
      }
    );

  if (loading && !event) {
    return (
      <div role="status" aria-label="Loading rounds" className="space-y-3">
        <div className="ax-card h-24 animate-pulse bg-muted/50" />
        <div className="grid grid-cols-3 gap-2.5">{[0, 1, 2].map((i) => <div key={i} className="ax-card h-20 animate-pulse bg-muted/50" />)}</div>
        <div className="ax-card h-48 animate-pulse bg-muted/50" />
      </div>
    );
  }

  if (!event) {
    const failure = loadErrors.event;
    if (failure && failure.status !== 404) {
      return (
        <LoadError
          message="Could not load this event."
          detail={failure.message}
          onRetry={() => {
            setLoading(true);
            refresh(...ADMIN_EVENT_FIELDS);
          }}
        />
      );
    }
    return (
      <EmptyState
        title="Event not found"
        description="This event may have been deleted by another admin."
        action={<Link to="/admin/setup" className="ax-primary-btn !min-h-11 !text-sm">Back to events</Link>}
      />
    );
  }

  const statTiles = [
    ["Checked in", stats?.checkIns?.present ?? 0, stats?.checkIns?.total],
    ["Rounds", rounds.length, null],
    ["Ballots in", stats?.debates?.completed ?? 0, stats?.debates?.total],
  ];
  const nextNumber = rounds.length + 1;

  return (
    <div className="space-y-4">
      {/* Event strip */}
      <section aria-label="Event" className="ax-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-foreground break-words">{event.name}</h2>
            <RoundStateChip status={event.status} />
          </div>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground line-clamp-2">{event.description || "No description"}</p>
          <p className="m-0 mt-1 text-xs text-muted-foreground tabular-nums">
            {formatDateTime(event.startDate)} → {formatDateTime(event.endDate)}
            {" · "}
            <Link to={`/dashboard/events/${eventId}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              Public page <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </p>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <button type="button" onClick={() => setShowEditEvent(true)} className="ax-ghost-btn !min-h-11" aria-label="Edit event">
            <Settings className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Edit event</span>
          </button>
          <button type="button" onClick={() => setShowCreateRound(true)} disabled={roundsLoading} className="ax-primary-btn flex-1 !min-h-11 !text-sm md:flex-none">
            <Plus className="w-4 h-4" aria-hidden="true" /> Create Round {nextNumber}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        {statTiles.map(([label, value, total]) => (
          <div key={label} className="ax-card p-3 md:p-4">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground md:text-xs">{label}</p>
            <p className="m-0 mt-1 font-display text-3xl leading-none text-primary tabular-nums md:text-4xl">
              {value}{total ? <span className="font-sans text-sm text-muted-foreground"> / {total}</span> : null}
            </p>
          </div>
        ))}
      </div>

      <section aria-labelledby="round-sequence" className="space-y-2.5">
        <h2 id="round-sequence" className="font-heading text-lg font-bold">Round sequence</h2>
        {loadErrors.rounds && !roundsLoading && (
          <LoadError compact message="Could not refresh rounds." onRetry={() => refresh("rounds", "stats")} />
        )}
        {roundsLoading ? (
          <div role="status" aria-label="Loading rounds" className="ax-card h-32 animate-pulse bg-muted/50" />
        ) : rounds.length === 0 && loadErrors.rounds ? null : rounds.length === 0 ? (
          <EmptyState
            compact
            icon={Activity}
            title="No rounds yet"
            description="Create Round 1 with its motion and check-in window."
            action={<button type="button" onClick={() => setShowCreateRound(true)} className="ax-primary-btn !min-h-11 !text-sm">Create Round 1</button>}
          />
        ) : (
          <>
            {/* Desktop: dense table (Director on a laptop) */}
            <div className="ax-card hidden overflow-hidden md:block">
              <table className="w-full text-left text-[15px]" aria-label="Rounds">
                <thead className="border-b border-border text-xs uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 w-12">#</th>
                    <th scope="col" className="px-4 py-3">Round</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Check-in window</th>
                    <th scope="col" className="px-4 py-3">State</th>
                    <th scope="col" className="px-4 py-3">Draw</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Advance target</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rounds.map((round) => (
                    <tr key={round.id} className="hover:bg-muted/30 align-top">
                      <td className="px-4 py-3 font-display text-2xl leading-none tabular-nums">{round.roundNumber}</td>
                      <td className="px-4 py-3">
                        <p className="m-0 font-semibold">{round.name}</p>
                        {round.motion && <p className="m-0 mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">{round.motion}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                        {round.checkInStartTime ? `${formatTimeIST(round.checkInStartTime)}–${formatTimeIST(round.checkInEndTime)} IST` : "—"}
                      </td>
                      <td className="px-4 py-3"><RoundStateChip status={round.status} /></td>
                      <td className="px-4 py-3 text-sm">{round.pairingsPublished ? "Published" : "Not published"}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{advanceTargetLabel(round.advanceTarget)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditingRound(round)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${round.name}`} title="Edit round">
                            <Settings className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => handleDeleteRound(round)} disabled={deletingRoundId === round.id} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label={`Delete ${round.name}`} title="Delete round">
                            {deletingRoundId === round.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
                          </button>
                          <Link to={`/admin/rounds/${round.id}`} className="ax-ghost-btn !min-h-11 !text-sm">Open <ChevronRight className="w-4 h-4" aria-hidden="true" /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: cards */}
            <div className="md:hidden space-y-2.5">
              {rounds.map((round) => (
                <div key={round.id} className="ax-card flex flex-col gap-2 p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="font-display text-3xl leading-none tabular-nums text-primary">{round.roundNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold leading-tight">{round.name}</p>
                      <p className="m-0 mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {round.checkInStartTime ? `Check-in ${formatTimeIST(round.checkInStartTime)}–${formatTimeIST(round.checkInEndTime)} IST` : "No check-in window"}
                      </p>
                    </div>
                    <RoundStateChip status={round.status} />
                  </div>
                  {round.motion && <p className="m-0 line-clamp-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">{round.motion}</p>}
                  <p className="m-0 text-xs text-muted-foreground">Draw {round.pairingsPublished ? "published" : "not published"} · Advance {advanceTargetLabel(round.advanceTarget)}</p>
                  <div className="flex items-center gap-1 border-t border-border pt-2">
                    <Link to={`/admin/rounds/${round.id}`} className="ax-ghost-btn mr-auto !min-h-11 !text-sm">Open <ChevronRight className="w-4 h-4" aria-hidden="true" /></Link>
                    <button type="button" onClick={() => setEditingRound(round)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={`Edit ${round.name}`}>
                      <Settings className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleDeleteRound(round)} disabled={deletingRoundId === round.id} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label={`Delete ${round.name}`}>
                      {deletingRoundId === round.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="m-0 text-xs text-muted-foreground">
          Generating a draw closes check-in and eliminates debaters who did not check in. Enrolment and walk-ins are in{" "}
          <Link to="/admin/people" className="font-semibold underline underline-offset-2">People</Link>.
        </p>
      </section>

      {showCreateRound && (
        <CreateRoundModal
          eventId={eventId}
          roundNumber={nextNumber}
          onClose={() => setShowCreateRound(false)}
          onCreated={() => {
            setShowCreateRound(false);
            fetchData();
          }}
        />
      )}

      {showEditEvent && (
        <EventFormModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onSaved={() => {
            setShowEditEvent(false);
            fetchData();
          }}
        />
      )}

      {editingRound && (
        <EditRoundModal
          round={editingRound}
          latestRound={rounds.find((r) => r.id === editingRound.id) || null}
          remoteChanges={editingRoundChanges}
          onClose={() => {
            setEditingRound(null);
            setEditingRoundChanges(0);
          }}
          onUpdated={() => {
            setEditingRound(null);
            setEditingRoundChanges(0);
            refresh("rounds", "stats");
          }}
        />
      )}
    </div>
  );
}
