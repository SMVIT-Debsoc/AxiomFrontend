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
import {useAuth} from "../../auth/client.jsx";
import {
  EventApi,
  DebateApi,
  UserApi,
  StatsApi,
} from "../../services/api";
import {cn} from "../../lib/utils";
import {useEventSocket} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {ResultsSkeleton} from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

export default function Results() {
  const {eventId} = useParams();
  const {getToken} = useAuth();

  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [myDebates, setMyDebates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-results");

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();

      const [eventResponse, userResponse, debatesResponse, leaderboardResponse] = await Promise.all([
        EventApi.get(eventId, token),
        UserApi.getProfile(token).catch(() => ({success: false})),
        DebateApi.getMyDebates(token).catch(() => ({success: false, debates: []})),
        StatsApi.getLeaderboard(token, eventId, 100).catch(() => ({success: false})),
      ]);

      if (eventResponse?.success && eventResponse.event) {
        setEvent(eventResponse.event);
        setRounds(eventResponse.event.rounds || []);
      }

      if (userResponse?.success) {
        setCurrentUser(userResponse.user);
      }

      if (debatesResponse?.success) {
        setMyDebates(debatesResponse.debates || []);
      }

      if (leaderboardResponse?.success && leaderboardResponse.data?.leaderboard) {
        setLeaderboard(leaderboardResponse.data.leaderboard);
      } else if (Array.isArray(leaderboardResponse?.leaderboard)) {
        setLeaderboard(leaderboardResponse.leaderboard);
      } else {
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
    onDebateResult: () => {
      fetchData();
    },
    onResultsPublished: () => {
      fetchData();
    },
    onLeaderboardUpdate: () => {
      fetchData();
    },
    onRoundStatusChange: () => {
      fetchData();
    },
  });

  // Filter debates for rounds of this event
  const getMyEventDebates = () => {
    const eventRoundIds = rounds.map((r) => r.id);
    return myDebates.filter((d) => eventRoundIds.includes(d.roundId));
  };

  const myEventDebates = getMyEventDebates();
  const hasPublishedResults = rounds.some((r) => r.resultsPublished);
  const myLeaderboardEntry = hasPublishedResults
    ? leaderboard.find((entry) => entry.user?.id === currentUser?.id)
    : null;

  if (loading) {
    return <ResultsSkeleton />;
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
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            Your Performance
          </span>
          {myLeaderboardEntry && (
            <span className="text-xs font-mono font-semibold text-primary">
              Rank #{myLeaderboardEntry.rank}
            </span>
          )}
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
      <div className="flex items-center gap-6 border-b border-border">
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
        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "pb-2.5 text-xs font-mono uppercase tracking-wider font-semibold transition-all border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "leaderboard"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Standings
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
              const published = Boolean(debate.resultsPublished || round?.resultsPublished);

              return (
                <Motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.05}}
                  className={cn(
                    "bg-card border rounded-xl p-4 transition-all",
                    debate.status === "COMPLETED" && published && debate.isPromoted
                      ? "border-primary/40 bg-primary/[0.02]"
                      : debate.status === "COMPLETED" && published && !debate.isPromoted
                      ? "border-destructive/30 bg-destructive/[0.02]"
                      : debate.status === "COMPLETED" && !published
                      ? "border-amber-500/30 bg-amber-500/[0.02]"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-foreground">
                        {round?.name || `Round ${round?.roundNumber || "?"}`}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {isDebater1 ? "GOV" : "OPP"}
                      </span>
                    </div>
                    {debate.status === "COMPLETED" && published ? (
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
                    ) : debate.status === "COMPLETED" && !published ? (
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
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
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

      {activeTab === "leaderboard" && (
        <Motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          className="space-y-3"
        >
          {!hasPublishedResults ? (
            <EmptyState
              compact
              icon={Trophy}
              title="Standings not published yet"
              description="Official tournament standings unlock once round results are published by the adjudication desk."
            />
          ) : leaderboard.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No standings yet"
              description="Standings will appear as completed ballots are recorded."
            />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border/60">
                {leaderboard.map((entry) => {
                  const isMe = entry.user?.id === currentUser?.id;
                  return (
                    <div
                      key={entry.user?.id || entry.rank}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm",
                        isMe && "bg-primary/[0.06]"
                      )}
                    >
                      <span className="w-8 font-mono font-bold text-primary text-xs shrink-0">
                        #{entry.rank}
                      </span>
                      <UserAvatar user={entry.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-semibold text-foreground truncate">
                          {entry.user?.firstName} {entry.user?.lastName}
                          {isMe && (
                            <span className="ml-1.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.user?.college || "Affiliation unlisted"}
                        </p>
                      </div>
                      <div className="text-right shrink-0 font-mono text-xs tabular-nums">
                        <p className="font-bold text-foreground">
                          {entry.stats?.wins || 0}W
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Motion.div>
      )}
    </div>
  );
}
