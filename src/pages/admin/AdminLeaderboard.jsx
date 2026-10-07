import { useState, useEffect, useCallback, useRef } from "react";
import { motion as Motion } from "framer-motion";
import {
  Trophy,
  Search,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "@clerk/clerk-react";
import { StatsApi, EventApi } from "../../services/api";
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { LeaderboardSkeleton } from "../../components/ui/Skeleton";

export default function AdminLeaderboard() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState("all-time");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState(null);
  const [isEventLoading, setIsEventLoading] = useState(true);
  const [, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { subscribe } = useSocket({ eventId: activeEvent?.id });

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // 1. Fetch Active Event to determine default view
  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const token = await getTokenRef.current();
        // Priority: ONGOING > UPCOMING > Any
        let eventsResponse = await EventApi.list(token, "ONGOING");
        let events = eventsResponse.events || [];

        if (events.length === 0) {
          eventsResponse = await EventApi.list(token, "UPCOMING");
          events = eventsResponse.events || [];
        }

        if (events.length === 0) {
          eventsResponse = await EventApi.list(token);
          events = eventsResponse.events || [];
        }

        if (events.length > 0) {
          setActiveEvent(events[0]);
          setFilter("current-event");
        }
      } catch (err) {
        console.error("Failed to fetch active event:", err);
      } finally {
        setIsEventLoading(false);
      }
    };
    fetchActiveEvent();
  }, []); // runs once

  const fetchLeaderboard = useCallback(async () => {
    if (isEventLoading) return;

    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const eventId = filter === "current-event" ? activeEvent?.id : null;
      const response = await StatsApi.getLeaderboard(token, eventId, 50);

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
      console.error("Failed to fetch leaderboard:", err);
      setError(err.message);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, [filter, activeEvent, isEventLoading]); // stable - getToken via ref

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to leaderboard updates
  useEffect(() => {
    const unsubscribe = subscribe(SocketEvents.LEADERBOARD_UPDATE, () => {
      fetchLeaderboard();
    });

    return () => unsubscribe?.();
  }, [subscribe, fetchLeaderboard]);

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
      <div className="space-y-8">
        <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Standings & Metrics</span>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" /> Leaderboard
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
              className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
        <LeaderboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="axiom-page-header flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400">Standings & Metrics</span>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "current-event" && activeEvent
              ? `Top performing debaters in ${activeEvent.name}`
              : "Top performing debaters across all tournaments."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchLeaderboard()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-none">
        <div className="p-4 border-b border-border bg-card flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search debater by name or college..."
              aria-label="Search debater by name or college"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-lg focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-foreground"
            />
          </div>
        </div>

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tournament standings">
          <table className="w-full" aria-label="Tournament leaderboard">
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
                    {searchQuery ? `No debaters found matching "${searchQuery}"` : "No debaters recorded on the leaderboard yet."}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map(({ entry, rank }) => (
                  <Motion.tr
                    key={entry.user?.id || entry.id || rank}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                        rank <= 3 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" : "text-muted-foreground font-mono"
                      )}>
                        #{rank}
                      </div>
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
                  </Motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
