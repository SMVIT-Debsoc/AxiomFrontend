import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trophy,
  Search,
  RotateCcw,
} from "lucide-react";
import { cn, getPodiumMedal } from "../../lib/utils";
import StandingRank from "../../components/ui/StandingRank";
import { useAuth } from "../../auth/client.jsx";
import { StatsApi, EventApi } from "../../services/api";
import { useSocket, SocketEvents, useLiveRefresh } from "../../hooks/useSocket";
import { useDebouncedCallback, useLatestRequest, useSocketRefresh } from "../../hooks/useAdminRealtime";
import LoadError from "../../components/ui/LoadError";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { LeaderboardSkeleton } from "../../components/ui/Skeleton";
import { useAdminEvent } from "../../contexts/adminEvent";

const pickActiveEvent = (events) => {
  const byStatus = (status) => events.filter((e) => String(e.status).toUpperCase() === status);
  // Priority: ACTIVE/ONGOING > UPCOMING > Any (matches upstream pick)
  return byStatus("ACTIVE")[0] || byStatus("ONGOING")[0] || byStatus("UPCOMING")[0] || events[0] || null;
};

export default function AdminLeaderboard({ embedded = false } = {}) {
  const { getToken } = useAuth();
  const adminEventContext = useAdminEvent();
  const contextEvent = adminEventContext?.event || null;
  const [activeEvent, setActiveEvent] = useState(() => contextEvent);
  const [filter, setFilter] = useState(() => (contextEvent ? "current-event" : "all-time"));
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEventLoading, setIsEventLoading] = useState(() => !contextEvent && Boolean(adminEventContext?.loading));
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const latest = useLatestRequest();
  useSocket({ eventId: activeEvent?.id });

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Keep in sync with the event switcher in AdminEventProvider.
  useEffect(() => {
    if (adminEventContext?.event && adminEventContext.event.id !== activeEvent?.id) {
      setActiveEvent(adminEventContext.event);
      setFilter("current-event");
      setIsEventLoading(false);
    }
  }, [adminEventContext?.event, activeEvent?.id]);

  // 1. Standalone fallback: one event list read if outside AdminEventProvider.
  useEffect(() => {
    if (contextEvent || adminEventContext?.events?.length) {
      setIsEventLoading(false);
      return;
    }
    let cancelled = false;
    const fetchActiveEvent = async () => {
      try {
        const token = await getTokenRef.current();
        const eventsResponse = await EventApi.list(token);
        if (cancelled) return;
        const event = pickActiveEvent(eventsResponse.events || []);
        if (event) {
          setActiveEvent(event);
          setFilter("current-event");
        }
      } catch (err) {
        console.error("Failed to fetch active event:", err);
      } finally {
        if (!cancelled) setIsEventLoading(false);
      }
    };
    fetchActiveEvent();
    return () => { cancelled = true; };
  }, [contextEvent, adminEventContext?.events?.length]); // runs once when outside provider

  const fetchLeaderboard = useCallback(async ({silent = false} = {}) => {
    const request = latest.begin();
    try {
      if (!silent) setLoading(true);
      const token = await getTokenRef.current();
      const eventId = filter === "current-event" ? activeEvent?.id : null;
      const response = await StatsApi.getLeaderboard(token, eventId, 50, {skipCache: silent, signal: request.signal});
      // Switching filters quickly must not let the older standings win.
      if (!latest.isCurrent(request.id)) return;

      let data = [];
      if (response.success && response.data?.leaderboard) {
        data = response.data.leaderboard;
      } else if (Array.isArray(response.leaderboard)) {
        data = response.leaderboard;
      } else if (Array.isArray(response.data)) {
        data = response.data;
      }
      setLeaderboard(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      if (!latest.isCurrent(request.id)) return;
      console.error("Failed to fetch leaderboard:", err);
      setError(err?.message || "Failed to load leaderboard");
      // Keep the last good standings on a failed background refresh.
      if (!silent) setLeaderboard([]);
    } finally {
      if (latest.isCurrent(request.id)) setLoading(false);
    }
  }, [filter, activeEvent, latest]); // stable - getToken via ref

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const refreshLeaderboard = useDebouncedCallback(() => fetchLeaderboard({silent: true}), 500);

  // Subscribe to leaderboard updates (debounced; a results burst = one read).
  useSocketRefresh([SocketEvents.LEADERBOARD_UPDATE, SocketEvents.ROUND_RESULTS_PUBLISHED], refreshLeaderboard, {
    delay: 0,
    filter: (data) => !(filter === "current-event" && data?.eventId && data.eventId !== activeEvent?.id),
  });
  useLiveRefresh(refreshLeaderboard, {
    enabled: !isEventLoading, eventId: activeEvent?.id, jitterMs: 3000, invalidateCache: false,
  });

  const query = searchQuery.toLowerCase();
  const filteredLeaderboard = leaderboard.reduce((matches, entry, index) => {
    const userData = entry.user || entry;
    const name = `${userData.firstName || ""} ${userData.lastName || ""}`.toLowerCase();
    const college = (userData.college || "").toLowerCase();
    if (name.includes(query) || college.includes(query)) {
      matches.push({ entry, rank: index + 1 });
    }
    return matches;
  }, []);

  const getDisplayName = (entry) => {
    const userData = entry.user || entry;
    return `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Anonymous";
  };

  const getStats = (entry) => {
    return entry.stats || { totalScore: 0, winRate: 0, wins: 0, losses: 0 };
  };

  const getCollege = (entry) => {
    const userData = entry.user || entry;
    return userData.college || "N/A";
  };

  if (loading && !leaderboard.length) {
    return (
      <div className="space-y-6">
        {!embedded && (
          <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
            <div>
              <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Standings & Metrics</span>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground flex items-center gap-3">
                <Trophy className="w-8 h-8 text-orange-500" aria-hidden="true" /> Leaderboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Top performing speakers across all events
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fetchLeaderboard()}
                disabled={loading}
                className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Refresh Data"
                aria-label="Refresh Data"
              >
                <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        )}
        <LeaderboardSkeleton />
      </div>
    );
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => fetchLeaderboard()}
        disabled={loading}
        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Refresh Data"
        aria-label="Refresh Data"
      >
        <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
      </button>

      <div className="flex items-center gap-1 bg-muted/60 border border-border p-1 rounded-xl">
        {["All Time", "Current Event"].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setFilter(period.toLowerCase().replace(" ", "-"))}
            disabled={period === "Current Event" && !activeEvent}
            className={cn(
              "min-h-11 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45",
              filter === period.toLowerCase().replace(" ", "-")
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-card"
            )}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filter === "current-event" && activeEvent
              ? `Top performing debaters in ${activeEvent.name}`
              : "Top performing debaters across all tournaments."}
          </p>
          {controls}
        </div>
      ) : (
        <div className="axiom-page-header flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Standings & Metrics</span>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-orange-500" aria-hidden="true" /> Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "current-event" && activeEvent
                ? `Top performing debaters in ${activeEvent.name}`
                : "Top performing debaters across all tournaments."}
            </p>
          </div>
          {controls}
        </div>
      )}

      {error && (
        <LoadError
          compact
          message={leaderboard.length ? "Could not refresh standings. Showing the last loaded list." : "Could not load standings."}
          onRetry={() => fetchLeaderboard()}
          busy={loading}
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-none">
        <div className="p-4 border-b border-border bg-card flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search debater by name or college..."
              aria-label="Search debater by name or college"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-lg focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-foreground"
            />
          </div>
        </div>

        {/* Mobile Standings Cards */}
        <div className="md:hidden divide-y divide-border" role="region" aria-label="Mobile tournament standings">
          {filteredLeaderboard.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              {searchQuery ? `No debaters found matching "${searchQuery}"` : "No debaters recorded on the leaderboard yet."}
            </div>
          ) : (
            filteredLeaderboard.map(({ entry, rank }) => (
              <div key={entry.user?.id || entry.id || rank} className="flex items-center gap-3 p-3.5">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0",
                  rank <= 3 ? "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35" : "border-border bg-muted/40 text-muted-foreground font-mono"
                )}>
                  #{rank}
                </div>
                <UserAvatar user={entry.user || entry} size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm truncate">{getDisplayName(entry)}</p>
                  <p className="text-xs text-muted-foreground truncate">{getCollege(entry)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold font-mono text-foreground text-sm tabular-nums">
                    {getStats(entry).totalScore?.toFixed(0) || 0} pts
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {getStats(entry).winRate?.toFixed(0) || 0}% win
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Standings Table */}
        <div className="hidden md:block overflow-x-auto" tabIndex={0} role="region" aria-label="Tournament standings">
          <table role="table" className="w-full" aria-label="Tournament leaderboard">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 text-left w-20">Rank</th>
                <th scope="col" className="px-6 py-4 text-left">Debater</th>
                <th scope="col" className="px-6 py-4 text-left">College</th>
                <th scope="col" className="px-6 py-4 text-right">Qualify Rate</th>
                <th scope="col" className="px-6 py-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    {error && !leaderboard.length
                      ? "Standings are unavailable right now."
                      : searchQuery ? `No debaters found matching "${searchQuery}"` : "No debaters recorded on the leaderboard yet."}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map(({ entry, rank }) => (
                  <tr
                    key={entry.user?.id || entry.id || rank}
                    data-podium={getPodiumMedal(rank)}
                    className="standing-row group hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <StandingRank rank={rank} medal={getPodiumMedal(rank)} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={entry.user || entry} size="sm" />
                        <span className="font-semibold text-foreground text-sm">{getDisplayName(entry)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {getCollege(entry)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-muted-foreground text-sm">
                      {getStats(entry).winRate?.toFixed(0) || 0}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold font-mono text-foreground text-base">
                        {getStats(entry).totalScore?.toFixed(0) || 0}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
