import {useState, useEffect, useCallback, useRef} from "react";
import {useParams, Link} from "react-router-dom";
import {motion as Motion} from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  User,
  XCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {
  EventApi,
  DebateApi,
  UserApi,
  StatsApi,
} from "../../services/api";
import {cn} from "../../lib/utils";
import {useEventSocket} from "../../hooks/useSocket";
import {CardSkeleton, LeaderboardSkeleton} from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

export default function Results() {
  const {eventId} = useParams();
  const {getToken} = useAuth();

  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [myDebates, setMyDebates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-results");

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();

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
      } catch {
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
      } catch {
        // Leaderboard might not be available
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Failed to fetch results", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]); // stable - getToken via ref

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

  const myEventDebates = getMyEventDebates();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4">
        <div className="space-y-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
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
      <div className="axiom-page-header pb-4 border-b border-border">
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Event
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="axiom-eyebrow">Tournament Standing</div>
            <h1 className="text-xl sm:text-2xl font-heading font-semibold tracking-tight text-foreground">Results</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {event?.name || "Event"}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold mb-4">
          Your Performance
        </div>
        <div className="grid grid-cols-3 gap-3 divide-x divide-border text-center">
          <div className="px-2">
            <p className="text-2xl sm:text-3xl font-heading font-bold text-foreground">{myEventDebates.length}</p>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-1">Debates</p>
          </div>
          <div className="px-2">
            <p className="text-2xl sm:text-3xl font-heading font-bold text-primary">
              {myEventDebates.filter((d) => d.resultsPublished && d.isPromoted).length}
            </p>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-1">Qualified</p>
          </div>
          <div className="px-2">
            <p className="text-2xl sm:text-3xl font-heading font-bold text-destructive">
              {myEventDebates.filter((d) => d.resultsPublished && !d.isPromoted).length}
            </p>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-1">Eliminated</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("my-results")}
          className={cn(
            "pb-2.5 text-xs font-mono uppercase tracking-wider font-semibold transition-all border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "my-results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Results
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "my-results" && (
        <Motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          className="space-y-3"
        >
          {getMyEventDebates().length === 0 ? (
            <EmptyState compact icon={Trophy} title="No results yet" description="No debate results yet for this event." />
          ) : (
            getMyEventDebates().map((debate, index) => {
              const round = rounds.find((r) => r.id === debate.roundId);
              const isDebater1 = debate.debater1Id === currentUser?.id;
              const opponent = isDebater1 ? debate.debater2 : debate.debater1;

              return (
                <Motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.05}}
                  className={cn(
                    "bg-card border rounded-xl p-4 transition-all",
                    debate.status === "COMPLETED" && round?.resultsPublished && debate.isPromoted
                      ? "border-primary/40 bg-primary/[0.02]"
                      : debate.status === "COMPLETED" && round?.resultsPublished && !debate.isPromoted
                      ? "border-destructive/30 bg-destructive/[0.02]"
                      : debate.status === "COMPLETED" && !round?.resultsPublished
                      ? "border-amber-500/30 bg-amber-500/[0.02]"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-foreground">
                        {round?.name || `Round ${round?.roundNumber || "?"}`}
                      </span>
                    </div>
                    {debate.status === "COMPLETED" && round?.resultsPublished ? (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold border",
                          debate.isPromoted
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {debate.isPromoted ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            QUALIFIED
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            ELIMINATED
                          </>
                        )}
                      </div>
                    ) : debate.status === "COMPLETED" && !round?.resultsPublished ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        AWAITING SELECTION
                      </div>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border uppercase font-mono font-medium tracking-wider">
                        {debate.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center border border-border">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        vs {opponent?.firstName || "Unknown"} {opponent?.lastName || "Debater"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {opponent?.college || "Affiliation unlisted"}
                      </p>
                    </div>
                  </div>
                </Motion.div>
              );
            })
          )}
        </Motion.div>
      )}
    </div>
  );
}
