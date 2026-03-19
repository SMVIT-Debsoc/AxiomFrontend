import {useState, useEffect, useCallback} from "react";
import {motion} from "framer-motion";
import {
  Trophy,
  Search,
  Loader2,
} from "lucide-react";
import {cn} from "../../lib/utils";
import {useAuth} from "@clerk/clerk-react";
import {StatsApi, EventApi} from "../../services/api";
import {useSocket, SocketEvents} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {LeaderboardSkeleton} from "../../components/ui/Skeleton";

export default function AdminLeaderboard() {
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
          setFilter("current-event");
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
    if (isEventLoading) return;

    try {
      setLoading(true);
      const token = await getToken();
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
  }, [getToken, filter, activeEvent, isEventLoading]);

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

  const filteredLeaderboard = leaderboard.filter((entry) => {
    const userData = entry.user || entry;
    const name = `${userData.firstName || ""} ${userData.lastName || ""}`.toLowerCase();
    const college = (userData.college || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || college.includes(query);
  });

  const getDisplayName = (entry) => {
    const userData = entry.user || entry;
    return `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Anonymous";
  };

  const getStats = (entry) => {
    return entry.stats || {totalScore: 0, winRate: 0, wins: 0, losses: 0};
  };

  const getCollege = (entry) => {
    const userData = entry.user || entry;
    return userData.college || "N/A";
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-500" /> Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Top performing debaters across tournaments.
            </p>
          </div>
        </div>
        <LeaderboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
              disabled={period === "Current Event" && !activeEvent}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                filter === period.toLowerCase().replace(" ", "-")
                  ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

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
                <th className="px-6 py-4 text-left w-20">Rank</th>
                <th className="px-6 py-4 text-left">Debater</th>
                <th className="px-6 py-4 text-left">College</th>
                <th className="px-6 py-4 text-right">Qualify Rate</th>
                <th className="px-6 py-4 text-right">Points</th>
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
                  <td className="px-6 py-4">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                      index < 3 ? "bg-purple-500/10 text-purple-600" : "text-muted-foreground"
                    )}>
                      #{index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={entry.user || entry} size="sm" />
                      <span className="font-semibold">{getDisplayName(entry)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {getCollege(entry)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                    {getStats(entry).winRate?.toFixed(0) || 0}%
                  </td>
                  <td className="px-6 py-4 text-right">
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
    </div>
  );
}
