import {useState, useEffect, useCallback} from "react";
import {useParams, Link} from "react-router-dom";
import {motion} from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Medal,
  User,
  Crown,
  TrendingUp,
  XCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {useAuth, useUser} from "@clerk/clerk-react";
import {
  EventApi,
  RoundApi,
  DebateApi,
  UserApi,
  StatsApi,
} from "../../services/api";
import {cn} from "../../lib/utils";
import {useEventSocket} from "../../hooks/useSocket";
import {CardSkeleton, LeaderboardSkeleton} from "../../components/ui/Skeleton";

export default function Results() {
  const {eventId} = useParams();
  const {getToken} = useAuth();
  const {user: clerkUser} = useUser();

  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [myDebates, setMyDebates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-results");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Fetch event details with rounds
      const eventResponse = await EventApi.get(eventId, token);
      if (eventResponse.success && eventResponse.event) {
        setEvent(eventResponse.event);
        setRounds(eventResponse.event.rounds || []);
      }

      // Fetch current user
      const userResponse = await UserApi.getProfile(token);
      if (userResponse.success) {
        setCurrentUser(userResponse.user);
      }

      // Fetch my debates
      try {
        const debatesResponse = await DebateApi.getMyDebates(token);
        if (debatesResponse.success) {
          setMyDebates(debatesResponse.debates || []);
        }
      } catch (e) {
        // No debates yet
      }

      // Fetch leaderboard
      try {
        const leaderboardResponse = await StatsApi.getLeaderboard(
          token,
          eventId,
          100
        );
        if (
          leaderboardResponse.success &&
          leaderboardResponse.data?.leaderboard
        ) {
          setLeaderboard(leaderboardResponse.data.leaderboard);
        } else if (Array.isArray(leaderboardResponse.leaderboard)) {
          setLeaderboard(leaderboardResponse.leaderboard);
        }
      } catch (e) {
        // Leaderboard might not be available
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Failed to fetch results", err);
    } finally {
      setLoading(false);
    }
  }, [eventId, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates via WebSocket
  useEventSocket(eventId, {
    onDebateResult: (data) => {
      console.log("[Socket] Debate result received:", data);
      // Refresh results when a debate is completed
      fetchData();
    },
    onLeaderboardUpdate: () => {
      console.log("[Socket] Leaderboard updated");
      fetchData();
    },
    onRoundStatusChange: (data) => {
      console.log("[Socket] Round status changed:", data);
      fetchData();
    },
  });

  // Filter debates for completed rounds of this event
  const getMyEventDebates = () => {
    const eventRoundIds = rounds.map((r) => r.id);
    return myDebates.filter((d) => eventRoundIds.includes(d.roundId));
  };

  // Calculate my stats for this event
  const getMyStats = () => {
    const eventDebates = getMyEventDebates();
    const completedDebates = eventDebates.filter(
      (d) => d.status === "COMPLETED"
    );
    const wins = completedDebates.filter(
      (d) => d.winnerId === currentUser?.id
    ).length;
    const losses = completedDebates.length - wins;

    return {total: completedDebates.length, wins, losses};
  };

  const myStats = getMyStats();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4">
        <div className="space-y-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        <CardSkeleton />
        <div className="space-y-3">
          <LeaderboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4">
      {/* Header */}
      <div>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Event
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Results</h1>
            <p className="text-sm text-muted-foreground">
              {event?.name || "Event"}
            </p>
          </div>
        </div>
      </div>

      {/* My Stats Summary */}
      <div className="bg-gradient-to-br from-primary to-purple-600 rounded-2xl p-6 text-white">
        <h3 className="text-sm font-medium opacity-80 mb-4">
          Your Performance
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold">{myStats.total}</p>
            <p className="text-sm opacity-80">Debates</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-300">{myStats.wins}</p>
            <p className="text-sm opacity-80">Wins</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-300">{myStats.losses}</p>
            <p className="text-sm opacity-80">Losses</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab("my-results")}
          className={cn(
            "pb-3 text-sm font-medium transition-all border-b-2",
            activeTab === "my-results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Results
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "pb-3 text-sm font-medium transition-all border-b-2",
            activeTab === "leaderboard"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Leaderboard
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "my-results" && (
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          className="space-y-4"
        >
          {getMyEventDebates().length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No debate results yet for this event.
              </p>
            </div>
          ) : (
            getMyEventDebates().map((debate, index) => {
              const round = rounds.find((r) => r.id === debate.roundId);
              const isWinner = debate.winnerId === currentUser?.id;
              const isDebater1 = debate.debater1Id === currentUser?.id;
              const opponent = isDebater1 ? debate.debater2 : debate.debater1;
              const myScore = isDebater1
                ? debate.debater1Score
                : debate.debater2Score;
              const opponentScore = isDebater1
                ? debate.debater2Score
                : debate.debater1Score;

              return (
                <motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.05}}
                  className={cn(
                    "bg-card border rounded-xl p-4",
                    debate.status === "COMPLETED" && isWinner
                      ? "border-green-500/30"
                      : debate.status === "COMPLETED"
                      ? "border-red-500/30"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {round?.name || `Round ${round?.roundNumber || "?"}`}
                      </span>
                    </div>
                    {debate.status === "COMPLETED" && (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                          isWinner
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {isWinner ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            WIN
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            LOSS
                          </>
                        )}
                      </div>
                    )}
                    {debate.status !== "COMPLETED" && (
                      <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                        {debate.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        vs {opponent?.firstName} {opponent?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {opponent?.college}
                      </p>
                    </div>
                    {debate.status === "COMPLETED" && myScore !== null && (
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {myScore} - {opponentScore}
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {activeTab === "leaderboard" && (
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          className="space-y-3"
        >
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Leaderboard will be available once results are submitted.
              </p>
            </div>
          ) : (
            leaderboard.map((entry, index) => {
              const isCurrentUser = entry.userId === currentUser?.id;

              return (
                <motion.div
                  key={entry.userId}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.03}}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl",
                    isCurrentUser
                      ? "bg-primary/10 border-2 border-primary/30"
                      : "bg-card border border-border"
                  )}
                >
                  {/* Rank */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                      index === 0
                        ? "bg-amber-500 text-white"
                        : index === 1
                        ? "bg-gray-400 text-white"
                        : index === 2
                        ? "bg-amber-700 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index === 0 ? <Crown className="w-5 h-5" /> : index + 1}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-semibold truncate",
                        isCurrentUser && "text-primary"
                      )}
                    >
                      {entry.firstName} {entry.lastName}
                      {isCurrentUser && " (You)"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {entry.college}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <p className="font-bold text-lg">{entry.wins}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.wins === 1 ? "Win" : "Wins"}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}
    </div>
  );
}
