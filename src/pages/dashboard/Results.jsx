import {useState, useEffect, useCallback, useRef} from "react";
import {useParams, Link} from "react-router-dom";
import {motion as Motion} from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  XCircle,
  CheckCircle2,
  Clock,
  Lock,
  Medal,
} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {
  EventApi,
  DebateApi,
  UserApi,
  StatsApi,
} from "../../services/api";
import {cn} from "../../lib/utils";
import {useEventSocket, useLiveRefresh} from "../../hooks/useSocket";
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
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchData = useCallback(
    async ({silent = false} = {}) => {
      try {
        if (!silent) setLoading(true);
        const token = await getTokenRef.current();
        const reqOptions = silent ? {skipCache: true} : {};

        const [
          eventResponse,
          userResponse,
          debatesResponse,
          leaderboardResponse,
        ] = await Promise.all([
          EventApi.get(eventId, token, reqOptions),
          UserApi.getProfile(token, reqOptions).catch(() => ({success: false})),
          DebateApi.getMyDebates(token, reqOptions).catch(() => ({
            success: false,
            debates: [],
          })),
          StatsApi.getLeaderboard(token, eventId, 100, reqOptions).catch(
            () => ({success: false})
          ),
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

        if (
          leaderboardResponse?.success &&
          leaderboardResponse.data?.leaderboard
        ) {
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
    },
    [eventId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const softRefetch = useCallback(() => fetchData({silent: true}), [fetchData]);
  useLiveRefresh(softRefetch, {enabled: Boolean(eventId), intervalMs: 12000});

  // Real-time updates via WebSocket
  useEventSocket(eventId, {
    onDebateResult: softRefetch,
    onResultsPublished: softRefetch,
    onLeaderboardUpdate: softRefetch,
    onRoundStatusChange: softRefetch,
    onRoundUpdated: softRefetch,
  });

  // Filter debates for rounds of this event
  const eventRoundIds = new Set(rounds.map((r) => r.id));
  const myEventDebates = myDebates
    .filter((d) => d.round?.eventId === eventId || eventRoundIds.has(d.roundId))
    .sort((a, b) => (a.round?.roundNumber || 0) - (b.round?.roundNumber || 0));

  const hasPublishedResults = Boolean(
    rounds.some((r) => r.resultsPublished) ||
      myEventDebates.some((d) => d.resultsPublished || d.round?.resultsPublished)
  );
  const myLeaderboardEntry = hasPublishedResults
    ? leaderboard.find((entry) => entry.user?.id === currentUser?.id)
    : null;

  const qualifiedCount = myEventDebates.filter(
    (d) =>
      d.status === "COMPLETED" &&
      Boolean(d.resultsPublished || d.round?.resultsPublished) &&
      d.isPromoted
  ).length;
  const eliminatedCount = myEventDebates.filter(
    (d) =>
      d.status === "COMPLETED" &&
      Boolean(d.resultsPublished || d.round?.resultsPublished) &&
      !d.isPromoted
  ).length;

  if (loading) {
    return <ResultsSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-10">
      {/* Header */}
      <div className="axiom-page-header pb-4 border-b border-border">
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex min-h-11 items-center text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Back to Event
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="axiom-eyebrow">Tournament Standing</div>
            <h1 className="text-xl sm:text-2xl font-heading font-semibold tracking-tight text-foreground">
              Results
            </h1>
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
            <span className="ax-chip ax-chip--info font-mono uppercase">
              Rank #{myLeaderboardEntry.rank}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted/40 border border-border/70 px-3 py-3">
            <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums text-foreground">
              {myEventDebates.length}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
              Debates
            </p>
          </div>
          <div className="ax-signal-win rounded-xl px-3 py-3">
            <p className="ax-signal-ink text-2xl sm:text-3xl font-heading font-bold tabular-nums">
              {qualifiedCount}
            </p>
            <p className="text-[11px] opacity-85 font-mono uppercase tracking-wider mt-1">
              Qualified
            </p>
          </div>
          <div className="ax-signal-loss rounded-xl px-3 py-3">
            <p className="ax-signal-ink text-2xl sm:text-3xl font-heading font-bold tabular-nums">
              {eliminatedCount}
            </p>
            <p className="text-[11px] opacity-85 font-mono uppercase tracking-wider mt-1">
              Eliminated
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Results sections"
        className="flex items-center gap-4 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "my-results"}
          onClick={() => setActiveTab("my-results")}
          className={cn(
            "min-h-11 px-2 pb-2 text-xs font-mono uppercase tracking-wider font-semibold transition-all border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "my-results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Results
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "min-h-11 px-2 pb-2 text-xs font-mono uppercase tracking-wider font-semibold transition-all border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
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
          {myEventDebates.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No results yet"
              description="No debate results yet for this event."
            />
          ) : (
            myEventDebates.map((debate, index) => {
              const round =
                rounds.find((r) => r.id === debate.roundId) || debate.round;
              const isDebater1 = debate.debater1Id === currentUser?.id;
              const side = isDebater1
                ? debate.debater1Position || "GOV"
                : debate.debater2Position || "OPP";
              const opponent = isDebater1 ? debate.debater2 : debate.debater1;
              const published = Boolean(
                debate.resultsPublished || round?.resultsPublished
              );
              const qualified = Boolean(debate.isPromoted);

              return (
                <Motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.04}}
                  className={cn(
                    "rounded-xl p-4 transition-all",
                    debate.status === "COMPLETED" && published && qualified
                      ? "ax-signal-win"
                      : debate.status === "COMPLETED" &&
                        published &&
                        !qualified
                      ? "ax-signal-loss"
                      : debate.status === "COMPLETED" && !published
                      ? "ax-signal-warn"
                      : "bg-card border border-border"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold">
                        {round?.name || `Round ${round?.roundNumber || "?"}`}
                      </span>
                      <span
                        className={cn(
                          "ax-chip font-mono uppercase",
                          side === "GOV" ? "ax-chip--gov" : "ax-chip--opp"
                        )}
                      >
                        {side}
                      </span>
                    </div>
                    {debate.status === "COMPLETED" && published ? (
                      <div
                        className={cn(
                          "ax-chip font-mono uppercase",
                          qualified ? "ax-chip--win" : "ax-chip--loss"
                        )}
                      >
                        {qualified ? (
                          <>
                            <CheckCircle2
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                            QUALIFIED
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" aria-hidden="true" />
                            ELIMINATED
                          </>
                        )}
                      </div>
                    ) : debate.status === "COMPLETED" && !published ? (
                      <div className="ax-chip ax-chip--warn font-mono uppercase">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        AWAITING SELECTION
                      </div>
                    ) : (
                      <span className="ax-chip ax-chip--idle font-mono uppercase">
                        {debate.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 pt-1">
                    <UserAvatar user={opponent} size="sm" className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        vs {opponent?.firstName || "Unknown"}{" "}
                        {opponent?.lastName || "Debater"}
                      </p>
                      <p className="text-xs opacity-75 truncate">
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
              icon={Lock}
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
                  const podiumClass =
                    entry.rank === 1
                      ? "ax-podium--gold"
                      : entry.rank === 2
                      ? "ax-podium--silver"
                      : entry.rank === 3
                      ? "ax-podium--bronze"
                      : "bg-muted text-muted-foreground border border-border";

                  return (
                    <div
                      key={entry.user?.id || entry.rank}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm",
                        isMe && "ax-signal-info"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center gap-1 min-w-10 px-2 py-0.5 rounded-full text-xs font-mono font-bold shrink-0",
                          podiumClass
                        )}
                      >
                        {entry.rank <= 3 && (
                          <Medal className="w-3 h-3 shrink-0" aria-hidden="true" />
                        )}
                        #{entry.rank}
                      </span>
                      <UserAvatar user={entry.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-heading font-semibold text-foreground truncate">
                            {entry.user?.firstName} {entry.user?.lastName}
                          </p>
                          {isMe && (
                            <span className="ax-chip ax-chip--info font-mono uppercase shrink-0">
                              You
                            </span>
                          )}
                        </div>
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
