import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../../auth/client.jsx";
import { AdminApi } from "../../../services/api";
import { SocketEvents, useLiveRefresh, invalidateRealtimeCache } from "../../../hooks/useSocket";
import { useLatestRequest, useSocketRefresh } from "../../../hooks/useAdminRealtime";
import LoadError from "../../../components/ui/LoadError";

/**
 * Setup landing summary (replaces the old /admin/overview dashboard):
 * four live counters across every event. Read-only; quiet when it fails.
 */
export default function SetupSummary() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const latest = useLatestRequest();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchSummary = useCallback(async ({ skipCache = false } = {}) => {
    const request = latest.begin();
    try {
      const token = await getTokenRef.current();
      const response = await AdminApi.apiRequest("/admin/dashboard", "GET", null, token, { skipCache, signal: request.signal });
      // A slow response from an earlier refresh must not overwrite newer numbers.
      if (!latest.isCurrent(request.id)) return;
      if (response.success && response.data) setStats(response.data.overview || null);
      setLoadError(null);
    } catch (error) {
      if (!latest.isCurrent(request.id)) return;
      setLoadError(error?.message || "Failed to load summary");
    } finally {
      if (latest.isCurrent(request.id)) setLoading(false);
    }
  }, [latest]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useLiveRefresh(() => fetchSummary({ skipCache: true }));
  // DASHBOARD_CHANGED is the backend's admin-wide signal; the rest cover older servers.
  useSocketRefresh(
    [
      SocketEvents.DASHBOARD_CHANGED,
      SocketEvents.EVENT_CREATED,
      SocketEvents.EVENT_UPDATED_GLOBAL,
      SocketEvents.EVENT_DELETED_GLOBAL,
      SocketEvents.USER_UPDATED,
      SocketEvents.USER_DELETED,
      SocketEvents.DEBATE_RESULT,
      SocketEvents.ROOMS_UPDATED,
    ],
    () => {
      invalidateRealtimeCache();
      fetchSummary({ skipCache: true });
    },
  );

  if (loadError && !stats) {
    return <LoadError compact message="Could not load the summary." onRetry={() => fetchSummary({ skipCache: true })} busy={loading} />;
  }

  const tiles = [
    ["Events", stats?.totalEvents, stats ? `${stats.activeEvents || 0} running` : null],
    ["Debaters", stats?.totalUsers, "Registered accounts"],
    ["Ballots in", stats?.completedDebates, stats ? `${stats.completionRate || 0}% of debates` : null],
    ["Rooms", stats?.totalRooms, "In the inventory"],
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4" aria-busy={loading}>
      {tiles.map(([label, value, note]) => (
        <div key={label} className="ax-card p-3.5 md:p-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
          <p className="m-0 mt-1 font-display text-4xl leading-none text-primary tabular-nums">
            {loading && value == null ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted align-middle" aria-hidden="true" /> : value ?? 0}
          </p>
          {note && <p className="m-0 mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
      ))}
    </div>
  );
}
