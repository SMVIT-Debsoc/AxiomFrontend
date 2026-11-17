import {useCallback, useEffect, useRef, useState} from "react";
import {useAuth} from "../../auth/client.jsx";
import {OpsApi} from "../../services/api";
import socketService, {SocketEvents} from "../../services/socket";
import {useLatestRequest} from "../../hooks/useAdminRealtime";
import {mergeFeed, relativeTime} from "../../lib/relativeTime";
import {cn} from "../../lib/utils";
import LoadError from "../ui/LoadError";

// <ActivityFeed eventId={eventId} roundId={roundId} limit={30} compact /> : live audit feed
// (OpsApi.getActivity + SocketEvents.ACTIVITY_NEW, deduped by id, "Load older" via `before`).

const readItems = (response) => {
  const data = response?.data;
  const items = response?.activity || response?.items || (Array.isArray(data) ? data : data?.activity || data?.items) || [];
  return Array.isArray(items) ? items : [];
};
const readCursor = (response, items) =>
  response?.nextBefore ?? response?.data?.nextBefore ?? (items.length ? items[items.length - 1].createdAt : null);

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export default function ActivityFeed({eventId, roundId, limit = 30, compact = false, className}) {
  const {getToken} = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const latest = useLatestRequest();
  const scope = `${eventId || ""}/${roundId || ""}`;
  const [feed, setFeed] = useState({scope: null, items: [], cursor: null, hasMore: false});
  const [loading, setLoading] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState(null);
  const now = useNow();

  const load = useCallback(async () => {
    if (!eventId && !roundId) return;
    const request = latest.begin();
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      const response = await OpsApi.getActivity({eventId, roundId, limit}, token);
      if (!latest.isCurrent(request.id)) return;
      const items = readItems(response);
      setFeed((prev) => ({
        scope,
        items: mergeFeed(prev.scope === scope ? prev.items : [], items),
        cursor: readCursor(response, items),
        hasMore: items.length >= limit,
      }));
      setError(null);
    } catch (failure) {
      if (!latest.isCurrent(request.id)) return;
      setError(failure?.message || "Could not load activity");
    } finally {
      if (latest.isCurrent(request.id)) setLoading(false);
    }
  }, [eventId, roundId, limit, scope, latest]);

  useEffect(() => { void load(); }, [load]);

  // Live: new entries arrive through the event room.
  useEffect(() => {
    if (!eventId) return undefined;
    socketService.joinEvent(eventId);
    return () => socketService.leaveEvent(eventId);
  }, [eventId]);
  useEffect(() => {
    if (!eventId && !roundId) return undefined;
    const offActivity = socketService.on(SocketEvents.ACTIVITY_NEW, (entry) => {
      if (!entry || entry.id == null) return;
      if (eventId && entry.eventId && String(entry.eventId) !== String(eventId)) return;
      if (roundId && String(entry.roundId) !== String(roundId)) return;
      setFeed((prev) => (prev.scope === scope ? {...prev, items: mergeFeed(prev.items, [entry])} : prev));
    });
    // Entries emitted while disconnected are missed; resync after reconnect.
    const offReconnect = socketService.on(SocketEvents.CONNECTION, () => { void load(); });
    return () => { offActivity(); offReconnect(); };
  }, [eventId, roundId, scope, load]);

  const loadOlder = async () => {
    if (!feed.cursor || olderBusy) return;
    setOlderBusy(true);
    try {
      const token = await getTokenRef.current();
      const response = await OpsApi.getActivity({eventId, roundId, limit, before: feed.cursor}, token);
      const items = readItems(response);
      setFeed((prev) => (prev.scope === scope ? {
        ...prev,
        items: mergeFeed(prev.items, items),
        cursor: readCursor(response, items),
        hasMore: items.length >= limit,
      } : prev));
      setError(null);
    } catch (failure) {
      setError(failure?.message || "Could not load older activity");
    } finally {
      setOlderBusy(false);
    }
  };

  const items = feed.scope === scope ? feed.items : [];

  return (
    <div className={cn("min-w-0", className)}>
      {error && <LoadError compact message={items.length ? "Activity may be out of date." : "Could not load activity."} onRetry={load} busy={loading} />}
      {loading && items.length === 0 ? (
        <ul aria-label="Loading activity" className="m-0 flex list-none flex-col gap-2 p-0">
          {[0, 1, 2].map((i) => <li key={i} className="h-5 animate-pulse rounded bg-muted" />)}
        </ul>
      ) : items.length === 0 && !error ? (
        <p className="m-0 py-3 text-sm text-muted-foreground">Nothing yet this round</p>
      ) : (
        <ol aria-label="Round activity" aria-live="polite" className={cn("m-0 flex list-none flex-col p-0", compact ? "text-[13px]" : "text-sm")}>
          {items.map((entry) => (
            <li key={entry.id} className={cn("flex items-baseline gap-2 border-t border-border first:border-t-0", compact ? "py-1.5" : "py-2.5")}>
              <p className="m-0 min-w-0 flex-1 leading-snug">
                <strong className="font-semibold text-foreground">{entry.actorName || "System"}</strong>{" "}
                <span className="text-muted-foreground">{entry.summary || entry.action}</span>
              </p>
              <time dateTime={entry.createdAt} title={entry.createdAt ? new Date(entry.createdAt).toLocaleString() : undefined} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {relativeTime(entry.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {feed.hasMore && items.length > 0 && (
        <button type="button" onClick={loadOlder} disabled={olderBusy} className="ax-ghost-btn mt-2 w-full !min-h-11 !text-sm">
          {olderBusy ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}
