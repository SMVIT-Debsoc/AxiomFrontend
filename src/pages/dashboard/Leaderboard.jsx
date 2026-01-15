import {useState, useEffect, useCallback} from "react";
import {motion} from "framer-motion";
import {
  Trophy,
  Medal,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {cn} from "../../lib/utils";
import {useAuth} from "@clerk/clerk-react";
import {StatsApi, EventApi} from "../../services/api";
import {useSocket, SocketEvents} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {LeaderboardSkeleton} from "../../components/ui/Skeleton";

export default function Leaderboard() {
  const {getToken} = useAuth();
  const [filter, setFilter] = useState("all-time");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState(null);
  const [isEventLoading, setIsEventLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const {subscribe} = useSocket({eventId: activeEvent?.id});

  // 1. Fetch Active Event to determine default view
  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const token = await getToken();
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
          setActiveEvent(events[0]);
          setFilter("current-event"); // Default to specific event as requested
        }
      } catch (err) {
        console.error("Failed to fetch active event:", err);
      } finally {
        setIsEventLoading(false);
      }
    };
    fetchActiveEvent();
  }, [getToken]);

  const fetchLeaderboard = useCallback(async () => {
    if (isEventLoading) return; // Wait until we know if there's an event

    try {
      setLoading(true);
      const token = await getToken();

      const eventId = filter === "current-event" ? activeEvent?.id : null;

      // If "This Event" is selected but no event found, show empty or all-time?
      // For now, if no event, we'll just query with null (All Time) or separate handling
      // But logically if filter is this-event and activeEvent is null, it means no event exists.

      const response = await StatsApi.getLeaderboard(token, eventId, 50);

      // Handle the API response structure - backend returns data.leaderboard
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
  }, [getToken, filter, activeEvent, isEventLoading]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to leaderboard updates
  useEffect(() => {
    const unsubscribe = subscribe(SocketEvents.LEADERBOARD_UPDATE, () => {
      console.log("[Socket] Leaderboard update received");
      fetchLeaderboard();
    });

    return () => unsubscribe?.();
  }, [subscribe, fetchLeaderboard]);

  // Filter leaderboard based on search query
  const filteredLeaderboard = leaderboard.filter((entry) => {
    const userData = entry.user || entry;
    const name = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.toLowerCase();
    const college = (userData.college || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || college.includes(query);
  });

  // Get top 3 for podium
  const top3 = filteredLeaderboard.slice(0, 3);
  const hasTop3 = top3.length >= 3;

  // Get display name (handles nested user object)
  const getDisplayName = (entry) => {
    const userData = entry.user || entry;
    return (
      `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
      "Anonymous"
    );
  };

  // Get stats (handles nested stats object)
  const getStats = (entry) => {
    return entry.stats || {totalScore: 0, winRate: 0, wins: 0, losses: 0};
  };

  // Get college (handles nested user object)
  const getCollege = (entry) => {
    const userData = entry.user || entry;
    return userData.college || "N/A";
  };

  if (loading) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">
              {filter === "current-event" && activeEvent
                ? `Top performing debaters in ${activeEvent.name}`
                : "Top performing debaters across all tournaments."}
            </p>
          </div>
        </div>
        <LeaderboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {filter === "current-event" && activeEvent
              ? `Top performing debaters in ${activeEvent.name}`
              : "Top performing debaters across all tournaments."}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
          {["All Time", "Current Event"].map((period) => (
            <button
              key={period}
              onClick={() => setFilter(period.toLowerCase().replace(" ", "-"))}
              disabled={
                period === "Current Event" && !activeEvent && !isEventLoading
              }
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                filter === period.toLowerCase().replace(" ", "-")
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                period === "Current Event" &&
                  !activeEvent &&
                  !isEventLoading &&
                  "opacity-50 cursor-not-allowed"
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
          <p className="font-medium">Failed to load leaderboard</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {filteredLeaderboard.length === 0 && !error ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">No Rankings Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            The leaderboard will be populated once debates are completed.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {hasTop3 && (
            <div className="grid grid-cols-3 gap-4 md:gap-8 items-end mb-12 px-4">
              <div className="order-2 md:order-1 flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-300 overflow-hidden bg-slate-200">
                    <UserAvatar
                      user={top3[1].user || top3[1]}
                      size="full"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-800">
                    2
                  </div>
                </div>
                <div className="text-center mt-3">
                  <p className="font-bold truncate max-w-[100px]">
                    {getDisplayName(top3[1])}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getStats(top3[1]).totalScore?.toFixed(0) || 0} pts
                  </p>
                </div>
              </div>

              <div className="order-1 md:order-2 flex flex-col items-center -mt-8">
                <div className="relative">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-yellow-400 overflow-hidden bg-yellow-100 shadow-[0_0_30px_-10px_rgba(250,204,21,0.5)]">
                    <UserAvatar
                      user={top3[0].user || top3[0]}
                      size="full"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                    <Trophy className="w-10 h-10 text-yellow-500 fill-yellow-500 drop-shadow-lg" />
                  </div>
                </div>
                <div className="text-center mt-6">
                  <p className="font-bold text-lg">{getDisplayName(top3[0])}</p>
                  <p className="text-primary font-bold">
                    {getStats(top3[0]).totalScore?.toFixed(0) || 0} pts
                  </p>
                </div>
              </div>

              <div className="order-3 flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-amber-600 overflow-hidden bg-amber-100">
                    <UserAvatar
                      user={top3[2].user || top3[2]}
                      size="full"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center font-bold text-white">
                    3
                  </div>
                </div>
                <div className="text-center mt-3">
                  <p className="font-bold truncate max-w-[100px]">
                    {getDisplayName(top3[2])}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getStats(top3[2]).totalScore?.toFixed(0) || 0} pts
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search debater..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-transparent rounded-lg focus:bg-background focus:border-border outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 md:px-6 py-4 text-left w-20">Rank</th>
                    <th className="px-3 md:px-6 py-4 text-left">Debater</th>
                    <th className="px-3 md:px-6 py-4 text-left hidden md:table-cell">
                      College
                    </th>
                    <th className="px-3 md:px-6 py-4 text-right">Win Rate</th>
                    <th className="px-3 md:px-6 py-4 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeaderboard.map((entry, index) => (
                    <motion.tr
                      key={entry.user?.id || entry.id || index}
                      initial={{opacity: 0}}
                      animate={{opacity: 1}}
                      className="group hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-3 md:px-6 py-4">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                            index < 3
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          #{entry.rank || index + 1}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                            <UserAvatar user={entry.user || entry} size="md" />
                          </div>
                          <span className="font-semibold">
                            {getDisplayName(entry)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 hidden md:table-cell text-muted-foreground">
                        {getCollege(entry)}
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right font-medium text-muted-foreground">
                        {getStats(entry).winRate?.toFixed(0) || 0}%
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right">
                        <span className="font-bold text-foreground">
                          {getStats(entry).totalScore?.toFixed(0) || 0}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
