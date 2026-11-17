import {lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo} from "react";
import {
  Trophy,
  Calendar,
  CheckCircle2,
  Loader2,
  XCircle,
  Swords,
  Lock,
  ArrowRight,
  Award,
  Clock,
  ExternalLink,
  Medal,
} from "lucide-react";
import {useAuth, useUser} from "../../auth/client.jsx";
import {
  UserApi,
  EventApi,
  DebateApi,
  CheckInApi,
  StatsApi,
} from "../../services/api";
import {Link} from "react-router-dom";
import {useToast} from "../../hooks/useToast";
import {DashboardHomeSkeleton} from "../../components/ui/Skeleton";
import {
  useEventSocket,
  useSocket,
  SocketEvents,
  useLiveRefresh,
} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import EmptyState from "../../components/ui/EmptyState";
import CountUp from "../../components/ui/CountUp";
import NeoButton from "../../components/neo/NeoButton";
import GameOverCard from "../../components/dashboard/GameOverCard";
import {cn, formatTimeIST} from "../../lib/utils";

const WhatsAppGroupBanner = lazy(() =>
  import("../../components/dashboard/WhatsAppGroupPrompt").then((m) => ({
    default: m.WhatsAppGroupBanner,
  }))
);
const WhatsAppFirstLoginModal = lazy(() =>
  import("../../components/dashboard/WhatsAppGroupPrompt").then((m) => ({
    default: m.WhatsAppFirstLoginModal,
  }))
);
const FirstLoginGuideStrip = lazy(() =>
  import("../../components/dashboard/QuickStartGuide").then((m) => ({
    default: m.FirstLoginGuideStrip,
  }))
);

function getCheckInWindowMeta(round, nowMs) {
  if (!round?.checkInStartTime || !round?.checkInEndTime) {
    return {
      state: "NOT_CONFIGURED",
      pillLabel: "NOT CONFIGURED",
      pillClass: "ax-chip ax-chip--idle",
      windowText: "Check-in hours not scheduled yet",
    };
  }

  const startMs = Date.parse(round.checkInStartTime);
  const endMs = Date.parse(round.checkInEndTime);
  const startLabel = formatTimeIST(round.checkInStartTime);
  const endLabel = formatTimeIST(round.checkInEndTime);
  const windowText = `Opens ${startLabel} IST · Closes ${endLabel} IST`;

  if (Number.isFinite(startMs) && nowMs < startMs) {
    return {
      state: "UPCOMING",
      pillLabel: `OPENS AT ${startLabel} IST`,
      pillClass: "ax-chip ax-chip--warn",
      windowText,
    };
  }

  if (Number.isFinite(endMs) && nowMs <= endMs) {
    return {
      state: "OPEN",
      pillLabel: "OPEN NOW",
      pillClass: "ax-chip ax-chip--win",
      windowText,
    };
  }

  return {
    state: "CLOSED",
    pillLabel: "CLOSED",
    pillClass: "ax-chip ax-chip--loss",
    windowText,
  };
}

function getRoundStatusChipClass(status) {
  if (status === "ONGOING") return "ax-chip ax-chip--win";
  if (status === "UPCOMING") return "ax-chip ax-chip--info";
  return "ax-chip ax-chip--idle";
}

function ResultsHubSection({
  activeEvent,
  eventDebates,
  rounds,
  leaderboard,
  leaderboardLoading,
  currentUserId,
}) {
  const hasPublishedResults = Boolean(
    rounds.some((r) => r.resultsPublished) ||
      eventDebates.some((d) => d.resultsPublished || d.round?.resultsPublished)
  );

  const publishedQualifiedCount = eventDebates.filter(
    (d) =>
      d.status === "COMPLETED" &&
      Boolean(d.resultsPublished || d.round?.resultsPublished) &&
      d.isPromoted
  ).length;

  const publishedEliminatedCount = eventDebates.filter(
    (d) =>
      d.status === "COMPLETED" &&
      Boolean(d.resultsPublished || d.round?.resultsPublished) &&
      !d.isPromoted
  ).length;

  const myLeaderboardEntry = hasPublishedResults
    ? leaderboard.find((entry) => entry.user?.id === currentUserId)
    : null;

  const orderedDebates = [...eventDebates].sort(
    (a, b) => (a.round?.roundNumber || 0) - (b.round?.roundNumber || 0)
  );

  return (
    <section aria-labelledby="inline-results-heading" className="space-y-4">
      {/* Your Performance Bar */}
      <div className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <h2
              id="inline-results-heading"
              className="text-base sm:text-lg font-heading font-bold text-foreground"
            >
              All Results &amp; Event Standings
            </h2>
          </div>

          {hasPublishedResults && myLeaderboardEntry ? (
            <span className="ax-chip ax-chip--info font-mono">
              Rank #{myLeaderboardEntry.rank}
            </span>
          ) : (
            <span className="ax-chip ax-chip--idle font-mono">
              {activeEvent?.name || "Tournament"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-muted/50 border border-border/70 px-3 py-2.5 text-center">
            <p className="text-xl sm:text-2xl font-heading font-bold tabular-nums text-foreground">
              {eventDebates.length}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
              Debates
            </p>
          </div>

          <div className="ax-signal-win rounded-xl px-3 py-2.5 text-center">
            <p className="ax-signal-ink text-xl sm:text-2xl font-heading font-bold tabular-nums">
              {publishedQualifiedCount}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wider opacity-85 mt-0.5">
              Qualified
            </p>
          </div>

          <div className="ax-signal-loss rounded-xl px-3 py-2.5 text-center">
            <p className="ax-signal-ink text-xl sm:text-2xl font-heading font-bold tabular-nums">
              {publishedEliminatedCount}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wider opacity-85 mt-0.5">
              Eliminated
            </p>
          </div>
        </div>
      </div>

      {/* Results & Standings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* All Rounds Results List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Your Round Outcomes ({orderedDebates.length})
            </h3>
          </div>

          {orderedDebates.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No round debates yet"
              description="Your round matchups and official outcomes will appear here once pairings are published."
            />
          ) : (
            <div className="space-y-3">
              {orderedDebates.map((debate) => {
                const round =
                  rounds.find((r) => r.id === debate.roundId) || debate.round;
                const isDebater1 = debate.debater1Id === currentUserId;
                const side = isDebater1
                  ? debate.debater1Position || "GOV"
                  : debate.debater2Position || "OPP";
                const opponent = isDebater1 ? debate.debater2 : debate.debater1;
                const published = Boolean(
                  debate.resultsPublished || round?.resultsPublished
                );
                const qualified = Boolean(debate.isPromoted);

                const cardSignalClass =
                  debate.status === "COMPLETED" && published && qualified
                    ? "ax-signal-win"
                    : debate.status === "COMPLETED" && published && !qualified
                    ? "ax-signal-loss"
                    : debate.status === "COMPLETED" && !published
                    ? "ax-signal-warn"
                    : "bg-card border border-border";

                return (
                  <div
                    key={debate.id}
                    className={cn("rounded-xl p-4 space-y-3 transition-colors", cardSignalClass)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-sm font-heading font-bold truncate">
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
                        <span
                          className={cn(
                            "ax-chip font-mono uppercase",
                            qualified ? "ax-chip--win" : "ax-chip--loss"
                          )}
                        >
                          {qualified ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                              QUALIFIED
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                              ELIMINATED
                            </>
                          )}
                        </span>
                      ) : debate.status === "COMPLETED" && !published ? (
                        <span className="ax-chip ax-chip--warn font-mono uppercase">
                          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                          AWAITING SELECTION
                        </span>
                      ) : (
                        <span className="ax-chip ax-chip--idle font-mono uppercase">
                          {debate.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={opponent} size="sm" className="shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-heading font-semibold truncate">
                            vs {opponent?.firstName || "TBA"} {opponent?.lastName || ""}
                          </p>
                          <p className="text-xs opacity-75 truncate">
                            {opponent?.college || "Affiliation unlisted"}
                            {debate.room?.name ? ` · ${debate.room.name}` : ""}
                          </p>
                        </div>
                      </div>

                      {activeEvent?.id && debate.roundId && (
                        <Link
                          to={`/dashboard/events/${activeEvent.id}/rounds/${debate.roundId}`}
                          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>Round</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inline Event Standings */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Event Standings
            </h3>
            {hasPublishedResults && leaderboard.length > 0 && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Top {leaderboard.length}
              </span>
            )}
          </div>

          {!hasPublishedResults ? (
            <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2.5">
              <div className="w-10 h-10 mx-auto rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <Lock className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="font-heading font-bold text-sm text-foreground">
                Standings Locked Until Publication
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Official tournament standings unlock once round results are published by the adjudication desk.
              </p>
            </div>
          ) : leaderboardLoading ? (
            <p role="status" className="p-5 text-center text-xs text-muted-foreground">
              Loading standings…
            </p>
          ) : leaderboard.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No standings yet"
              description="Standings will appear as completed ballots are recorded."
            />
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
              <div className="divide-y divide-border/60">
                {leaderboard.map((entry) => {
                  const isMe = entry.user?.id === currentUserId;
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
                          "inline-flex items-center justify-center gap-1 min-w-10 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0",
                          podiumClass
                        )}
                      >
                        {entry.rank <= 3 && (
                          <Medal className="w-3 h-3 shrink-0" aria-hidden="true" />
                        )}
                        #{entry.rank}
                      </span>

                      <UserAvatar user={entry.user} size="sm" className="shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-heading font-semibold text-foreground truncate">
                            {entry.user?.firstName} {entry.user?.lastName}
                          </p>
                          {isMe && (
                            <span className="ax-chip ax-chip--info font-mono uppercase shrink-0">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.user?.college || "Affiliation unlisted"}
                        </p>
                      </div>

                      <div className="text-right shrink-0 font-mono text-xs tabular-nums">
                        <span className="font-bold text-foreground">
                          {entry.stats?.wins || 0}W
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const LIVE_FIELDS = ["event", "debates", "checkIn", "leaderboard"];

export default function DashboardHome() {
  const {sessionId, userId} = useAuth();
  return <DashboardContent key={sessionId || userId} />;
}

function DashboardContent() {
  const {getToken, sessionId, userId} = useAuth();
  const sessionScope = sessionId && userId ? sessionId + "/" + userId : null;
  const {user: authUser, isLoaded: authLoaded} = useUser();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [myDebates, setMyDebates] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [debatesLoading, setDebatesLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [mobileTab, setMobileTab] = useState("now"); // "now" | "rounds" | "results"

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);


  const refreshQueue = useRef(null);
  const roundIdRef = useRef(null);
  const checkInVersion = useRef(0);
  const refresh = useCallback((...fields) => refreshQueue.current?.(fields), []);

  useEffect(() => {
    if (!authLoaded) return;
    let stopped = false;
    let running = false;
    let timer;
    let event = null;
    let round = null;
    let loadedBoard = null;
    let pending = new Set(["profile", ...LIVE_FIELDS]);

    async function fetchData(fields, initial) {
      const token = await getTokenRef.current();
      if (stopped) return;
      // Bound each batch so a stalled request can't block later live updates.
      const options = {skipCache: !initial, signal: AbortSignal.timeout(15000), sessionScope};
      const profile = fields.has("profile")
        ? UserApi.getProfile(token, options).then((response) => {
            if (!stopped && response.user) setUserData(response.user);
          }).catch((failure) => {
            if (!stopped && initial) setError(failure.message);
          })
        : Promise.resolve();

      const oldEvent = event?.id;
      const oldRound = round?.id;
      let eventError;
      let showingPreview = false;
      if (fields.has("event")) {
        try {
          const response = await EventApi.list(token, null, {
            ...options,
            dashboard: true,
            onNavigationPreview: () => {
              showingPreview = true;
              LIVE_FIELDS.forEach((field) => pending.add(field));
            },
          });
          const events = response.events || [];
          event = events.find((item) => item.status === "ONGOING")
            || events.find((item) => item.status === "UPCOMING")
            || events[0] || null;
          const rounds = event?.rounds || [];
          round = rounds.find((item) => item.status === "ONGOING")
            || rounds.find((item) => item.status === "UPCOMING")
            || rounds.at(-1) || null;
        } catch (failure) {
          eventError = failure;
        }
      }
      if (stopped) return;

      const eventChanged = oldEvent !== event?.id;
      const roundChanged = oldRound !== round?.id;
      const tasks = [];
      setActiveEvent(event);
      setCurrentRound(round);

      if (eventChanged) {
        setMyDebates([]);
        setDebatesLoading(true);
        setLeaderboard([]);
        loadedBoard = null;
      }
      if (roundChanged) {
        roundIdRef.current = round?.id ?? null;
        setCheckInStatus(null);
        setCheckInLoading(Boolean(round));
      }

      if (showingPreview) {
        setLoading(false);
        return;
      }

      if (fields.has("debates") || eventChanged) {
        tasks.push(DebateApi.getMyDebates(token, options, event?.id)
          .then((response) => {
            if (!stopped && response?.success) setMyDebates(response.debates || []);
          })
          .catch(() => {})
          .finally(() => { if (!stopped) setDebatesLoading(false); }));
      }

      if (round && (fields.has("checkIn") || roundChanged)) {
        const version = checkInVersion.current;
        tasks.push(CheckInApi.getMyStatus(round.id, token, options)
          .then((response) => {
            if (stopped || checkInVersion.current !== version || !response?.success) return;
            const status = response.checkIn?.status || (response.isCheckedIn ? "PRESENT" : null);
            setCheckInStatus({
              ...response.checkIn,
              status,
              isCheckedIn: Boolean(response.isCheckedIn || status === "PRESENT"),
              isEliminated: Boolean(response.isEliminated || response.checkIn?.isEliminated),
            });
          })
          .catch(() => {})
          .finally(() => { if (!stopped) setCheckInLoading(false); }));
      }

      if (event?.rounds?.some((item) => item.resultsPublished)
          && (fields.has("leaderboard") || loadedBoard !== event.id)) {
        setLeaderboardLoading(loadedBoard !== event.id);
        tasks.push(StatsApi.getLeaderboard(token, event.id, 100, options)
          .then((response) => {
            if (stopped || !response?.success) return;
            loadedBoard = event.id;
            setLeaderboard(response.data?.leaderboard || response.leaderboard || []);
          })
          .catch(() => {})
          .finally(() => { if (!stopped) setLeaderboardLoading(false); }));
      }

      if (fields.has("event")) setError(eventError?.message || null);
      if (initial && !stopped) setLoading(false);
      await Promise.all([profile, ...tasks]);
    }

    async function flush(initial = false) {
      if (stopped || running || pending.size === 0) return;
      const fields = pending;
      pending = new Set();
      running = true;
      try {
        await fetchData(fields, initial);
      } catch (failure) {
        if (!stopped) {
          setError(failure.message);
          setLoading(false);
        }
      } finally {
        running = false;
        schedule();
      }
    }

    function schedule() {
      if (stopped || running || timer !== undefined || pending.size === 0) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        void flush();
      }, 150);
    }

    refreshQueue.current = (fields) => {
      fields.forEach((field) => pending.add(field));
      schedule();
    };
    void flush(true);

    return () => {
      stopped = true;
      refreshQueue.current = null;
      window.clearTimeout(timer);
    };
  }, [authLoaded, sessionScope]);

  useLiveRefresh(() => refresh("profile", ...LIVE_FIELDS), {
    intervalMs: 12000,
    jitterMs: 3000,
    invalidateCache: false,
  });

  useEventSocket(activeEvent?.id, {
    onRoundCreated: () => refresh("event", "checkIn"),
    onRoundDeleted: () => refresh(...LIVE_FIELDS),
    onRoundStatusChange: (data) => {
      toast.info("Update", "Round status updated to " + data.status);
      refresh("event", "checkIn");
    },
    onRoundCheckInWindow: () => {
      toast.info("Check-in Window Updated", "Round check-in times were updated.");
      refresh("event", "checkIn");
    },
    onPairingsPublished: (data) => {
      if (data.published) toast.success("Draw Released!", "Pairings have been published.");
      refresh("event", "debates", "checkIn");
    },
    onRoundUpdated: () => refresh(...LIVE_FIELDS),
    onDebateCreated: () => refresh("debates"),
    onDebateResult: ({debateId}) => {
      if (myDebates.some((debate) => debate.id === debateId)) {
        refresh("profile", "debates", "checkIn");
      }
    },
    onLeaderboardUpdate: () => refresh("leaderboard"),
    onResultsPublished: (data) => {
      if (data?.published) toast.success("Results Published!", "Round results are now available.");
      refresh("profile", ...LIVE_FIELDS);
    },
  });

  const {subscribe} = useSocket();
  useEffect(() => {
    const refreshEvent = () => refresh("event");
    const subscriptions = [
      subscribe(SocketEvents.EVENT_CREATED, refreshEvent),
      subscribe(SocketEvents.EVENT_UPDATED_GLOBAL, refreshEvent),
      subscribe(SocketEvents.EVENT_DELETED_GLOBAL, refreshEvent),
      subscribe(SocketEvents.CHECKIN_UPDATE, (data) => {
        if (data.roundId === roundIdRef.current) refresh("checkIn");
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe?.());
  }, [subscribe, refresh]);

  // Live boundary timer for check-in window transitions
  const checkInStartTime = currentRound?.checkInStartTime;
  const checkInEndTime = currentRound?.checkInEndTime;
  useEffect(() => {
    if (!checkInStartTime || !checkInEndTime) return undefined;
    let timer;
    const updateAtBoundary = () => {
      const now = Date.now();
      setClockNow(now);
      const nextBoundary = [
        Date.parse(checkInStartTime),
        Date.parse(checkInEndTime),
      ]
        .filter((time) => Number.isFinite(time) && time > now)
        .sort((a, b) => a - b)[0];
      if (nextBoundary) {
        const delay = Math.min(nextBoundary - now + 10, 2147483647);
        timer = window.setTimeout(updateAtBoundary, delay);
      }
    };
    updateAtBoundary();
    return () => window.clearTimeout(timer);
  }, [checkInStartTime, checkInEndTime]);

  const eventDebates = useMemo(() => {
    if (!activeEvent) return myDebates;
    const roundIds = new Set((activeEvent.rounds || []).map((r) => r.id));
    return myDebates.filter(
      (d) => d.round?.eventId === activeEvent.id || roundIds.has(d.roundId)
    );
  }, [activeEvent, myDebates]);

  const nextDebate = eventDebates.find((debate) => debate.status === "SCHEDULED");
  const latestCompletedDebate = eventDebates.reduce((latest, debate) => {
    if (debate.status !== "COMPLETED") return latest;
    return !latest || (debate.round?.roundNumber || 0) > (latest.round?.roundNumber || 0)
      ? debate
      : latest;
  }, null);

  const {isEliminatedInEvent, latestPublishedDebate, eventRoundsDebated, eventWins} =
    useMemo(() => {
      const completedPublished = [...eventDebates]
        .filter(
          (d) =>
            d.status === "COMPLETED" &&
            Boolean(d.resultsPublished || d.round?.resultsPublished)
        )
        .sort(
          (a, b) => (b.round?.roundNumber || 0) - (a.round?.roundNumber || 0)
        );

      const latestPub = completedPublished[0] || null;
      const latestPubRoundNum = latestPub?.round?.roundNumber || 0;
      const hasLaterOverride = Boolean(
        latestPub &&
          eventDebates.some(
            (d) =>
              (d.round?.roundNumber || 0) > latestPubRoundNum &&
              (d.status === "SCHEDULED" || Boolean(d.isPromoted))
          )
      );

      const eliminatedByDebate = Boolean(
        latestPub && !latestPub.isPromoted && !hasLaterOverride
      );

      const completedCount = eventDebates.filter(
        (d) => d.status === "COMPLETED"
      ).length;

      const winsCount = completedPublished.filter((d) =>
        Boolean(d.didWin ?? (userData?.id && d.winnerId === userData.id))
      ).length;

      return {
        isEliminatedInEvent: Boolean(
          checkInStatus?.isEliminated || eliminatedByDebate
        ),
        latestPublishedDebate: latestPub,
        eventRoundsDebated: completedCount || eventDebates.length,
        eventWins: winsCount,
      };
    }, [eventDebates, checkInStatus?.isEliminated, userData?.id]);

  if (loading) {
    return <DashboardHomeSkeleton />;
  }

  const displayName = userData
    ? [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
      userData.email
    : authUser?.firstName ||
      authUser?.emailAddresses?.[0]?.emailAddress ||
      "Debater";
  const college = userData?.college || "College not set";

  const totalDebates = userData?.stats?.totalDebates || 0;
  const qualifiedCount = userData?.stats?.qualified || 0;
  const winRate =
    totalDebates > 0 ? Math.round(userData?.stats?.winRate || 0) : 0;

  const isCheckedIn = Boolean(
    checkInStatus?.isCheckedIn || checkInStatus?.status === "PRESENT"
  );
  const checkInMeta = getCheckInWindowMeta(currentRound, clockNow);

  const handleCheckIn = async () => {
    if (!currentRound) return;
    try {
      setCheckingIn(true);
      const token = await getToken();
      const response = await CheckInApi.checkIn(currentRound.id, token);
      if (response.success) {
        if (roundIdRef.current !== currentRound.id) return;
        checkInVersion.current += 1;
        setCheckInStatus({
          ...(response.checkIn || {}),
          status: "PRESENT",
          isCheckedIn: true,
          isEliminated: false,
        });
        toast.success("Successfully checked in!");
        refresh("checkIn");
      }
    } catch (err) {
      toast.error(err.message || "Failed to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const jumpToInlineResults = () => {
    const inlineSection = document.getElementById("inline-results-desktop");
    if (inlineSection && inlineSection.offsetParent !== null) {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inlineSection.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    } else {
      setMobileTab("results");
    }
  };

  const roundsList = activeEvent?.rounds || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans">
      {/* WhatsApp First Login Modal, Persistent Alert & First-Time Visual Guide */}
      <Suspense fallback={null}>
        <WhatsAppFirstLoginModal event={activeEvent} />
        <WhatsAppGroupBanner
          whatsappLink={activeEvent?.whatsappLink}
          eventName={activeEvent?.name}
        />
        <FirstLoginGuideStrip
          onOpenFullGuide={() =>
            window.dispatchEvent(new CustomEvent("axiom:open-visual-guide"))
          }
        />
      </Suspense>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="ax-signal-loss px-4 py-3 rounded-xl font-sans flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="ax-signal-ink font-bold">
              Error loading telemetry:
            </span>
            <span className="opacity-90">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              refresh("profile", ...LIVE_FIELDS);
            }}
            className="min-h-11 px-3.5 rounded-lg bg-[#EF4444]/15 text-xs font-bold ax-signal-ink hover:bg-[#EF4444]/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* Compact Debater Command Strip */}
      <section className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <UserAvatar
            user={authUser}
            name={displayName}
            size="lg"
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate">
                {displayName}
              </h1>
              <span className="ax-chip ax-chip--gov font-heading uppercase shrink-0">
                Debater
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{college}</p>
          </div>
        </div>

        {/* Compact Stat Badges */}
        <div className="grid grid-cols-3 gap-2 bg-muted/40 border border-border/70 rounded-xl p-2 sm:px-4 text-center shrink-0">
          <div className="px-1 border-r border-border/50">
            <div className="text-base sm:text-lg font-heading font-bold text-foreground tabular-nums">
              <CountUp value={totalDebates} />
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Debates
            </div>
          </div>
          <div className="px-1 border-r border-border/50">
            <div className="text-base sm:text-lg font-heading font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              <CountUp value={qualifiedCount} />
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Qualified
            </div>
          </div>
          <div className="px-1">
            <div className="text-base sm:text-lg font-heading font-bold text-primary tabular-nums">
              {winRate}%
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Rate
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Control Bar (Mobile & Desktop View Switcher) */}
      <div
        role="tablist"
        aria-label="Dashboard views"
        className="grid grid-cols-3 p-1 rounded-xl bg-muted/60 border border-border text-xs font-semibold gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "now"}
          onClick={() => setMobileTab("now")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5 px-2",
            mobileTab === "now"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Swords size={14} aria-hidden="true" />
          <span className="truncate">Live Matchup</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "rounds"}
          onClick={() => setMobileTab("rounds")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5 px-2",
            mobileTab === "rounds"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar size={14} aria-hidden="true" />
          <span className="truncate">
            Rounds {roundsList.length ? `(${roundsList.length})` : ""}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "results"}
          onClick={() => setMobileTab("results")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5 px-2",
            mobileTab === "results"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Trophy size={14} aria-hidden="true" />
          <span className="truncate">Results</span>
        </button>
      </div>

      {/* Tab: NOW (Live Command View + Desktop Inline Results) */}
      {mobileTab === "now" && (
        <div className="space-y-4">
          {/* Active Tournament Headline */}
          {activeEvent ? (
            <div className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {activeEvent.status === "ONGOING"
                    ? "Active Tournament"
                    : activeEvent.status}
                </span>
                <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate">
                  {activeEvent.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/dashboard/events/${activeEvent.id}`}
                  className="inline-flex min-h-11 items-center justify-center px-4 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted text-foreground transition-colors"
                >
                  Tournament Hub
                </Link>
                {activeEvent.whatsappLink && (
                  <a
                    href={activeEvent.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors gap-1.5"
                  >
                    <span>WhatsApp</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              row
              icon={Calendar}
              title="No tournament active"
              description="Browse upcoming debate tournaments and enrol."
              action={<NeoButton to="/dashboard/events">Browse Events</NeoButton>}
            />
          )}

          {/* Eliminated State: Show GameOverCard prominently & hide Check-In UI */}
          {activeEvent && isEliminatedInEvent && (
            <GameOverCard
              eventName={activeEvent.name}
              roundsDebated={eventRoundsDebated}
              wins={eventWins}
              roundLabel={
                latestPublishedDebate?.round?.name ||
                (latestPublishedDebate?.round?.roundNumber
                  ? `Round ${latestPublishedDebate.round.roundNumber}`
                  : null)
              }
            />
          )}

          {/* Current Round & Check-In Combined Card (Hidden when eliminated) */}
          {currentRound && !isEliminatedInEvent && (
            <div className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/80">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0"
                    aria-hidden="true"
                  />
                  <h3 className="text-base sm:text-lg font-heading font-bold text-foreground truncate">
                    {currentRound.name || `Round ${currentRound.roundNumber}`}
                  </h3>
                </div>
                <span
                  className={cn(
                    getRoundStatusChipClass(currentRound.status),
                    "font-heading uppercase"
                  )}
                >
                  {currentRound.status}
                </span>
              </div>

              {/* Check-In Row with Explicit Open/Close IST Timestamps & Status Pill */}
              <div
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl",
                  isCheckedIn
                    ? "ax-signal-win"
                    : checkInMeta.state === "CLOSED"
                    ? "ax-signal-loss"
                    : "ax-signal-warn"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-black/5 dark:bg-white/10">
                    {isCheckedIn ? (
                      <CheckCircle2
                        size={18}
                        className="ax-signal-ink"
                        aria-hidden="true"
                      />
                    ) : checkInMeta.state === "CLOSED" ? (
                      <XCircle
                        size={18}
                        className="ax-signal-ink"
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock
                        size={18}
                        className="ax-signal-ink"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs sm:text-sm font-heading font-bold ax-signal-ink">
                        {isCheckedIn
                          ? "Checked In for Round"
                          : checkInMeta.state === "OPEN"
                          ? "Check-in Window Live"
                          : checkInMeta.state === "CLOSED"
                          ? "Check-in Closed"
                          : checkInMeta.state === "UPCOMING"
                          ? "Check-in Scheduled"
                          : "Check-in Pending Schedule"}
                      </p>
                      <span className={cn(checkInMeta.pillClass, "font-mono uppercase")}>
                        {checkInMeta.pillLabel}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs font-mono opacity-90">
                      {checkInMeta.windowText}
                    </p>

                    <p className="text-[11px] opacity-80">
                      {isCheckedIn
                        ? "Your attendance is confirmed for pairings."
                        : checkInMeta.state === "OPEN"
                        ? "Confirm attendance now to be included in this round's pairings."
                        : checkInMeta.state === "UPCOMING"
                        ? "Button unlocks automatically when the check-in window opens."
                        : checkInMeta.state === "CLOSED"
                        ? "Window has ended. Contact adjudication if you need assistance."
                        : "Waiting for the organiser desk to configure check-in hours."}
                    </p>
                  </div>
                </div>

                {isCheckedIn ? (
                  <span className="ax-chip ax-chip--win shrink-0 font-mono uppercase">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    Presence Verified
                  </span>
                ) : checkInMeta.state === "OPEN" ? (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={checkingIn || checkInLoading || debatesLoading}
                    className="min-h-11 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {checkingIn ? (
                      <>
                        <Loader2
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        <span>Checking in...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} aria-hidden="true" />
                        <span>{checkInLoading || debatesLoading ? "Loading status…" : "Check In Now"}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="min-h-11 px-4 rounded-xl bg-muted/80 text-muted-foreground text-xs font-bold border border-border opacity-70 cursor-not-allowed shrink-0"
                  >
                    {checkInMeta.state === "UPCOMING"
                      ? "Opens Soon"
                      : checkInMeta.state === "CLOSED"
                      ? "Window Closed"
                      : "Not Open"}
                  </button>
                )}
              </div>

              {/* Matchup & Motion Panel */}
              {debatesLoading ? (
                <p role="status" className="py-4 text-center text-xs text-muted-foreground">
                  Loading your debate…
                </p>
              ) : nextDebate ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-xl border border-border bg-background/50 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Swords size={14} aria-hidden="true" /> Assigned Matchup
                      </span>
                      <span className="font-mono text-muted-foreground">
                        Room:{" "}
                        <strong className="text-foreground">
                          {nextDebate.room?.name || "TBD"}
                        </strong>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                      {nextDebate.round?.motion
                        ? `Motion: ${nextDebate.round.motion}`
                        : "Motion will be announced when round starts"}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-2">
                        <span>Side:</span>
                        <span
                          className={cn(
                            "ax-chip font-mono uppercase",
                            nextDebate.debater1Id === userData?.id
                              ? "ax-chip--gov"
                              : "ax-chip--opp"
                          )}
                        >
                          {nextDebate.debater1Id === userData?.id
                            ? "Government (GOV)"
                            : "Opposition (OPP)"}
                        </span>
                      </div>
                      {(nextDebate.adjudicator || nextDebate.judgeName) && (
                        <span>
                          Judge:{" "}
                          <strong className="text-foreground">
                            {nextDebate.adjudicator
                              ? [
                                  nextDebate.adjudicator.firstName,
                                  nextDebate.adjudicator.lastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                              : nextDebate.judgeName}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    to={`/dashboard/events/${activeEvent.id}/rounds/${currentRound.id}`}
                    className="min-h-11 w-full rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View Round Draw &amp; Details</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              ) : currentRound.pairingsPublished ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Draw released. You do not have a scheduled debate in this round.
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground">
                  <Lock size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    Pairings are being drawn by the adjudication core. Check back soon.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Latest Result Banner (Respecting Competition Privacy Boundaries) */}
          {latestCompletedDebate &&
            (() => {
              const isDebater1 =
                latestCompletedDebate.debater1Id === userData?.id;
              const opponent = isDebater1
                ? latestCompletedDebate.debater2
                : latestCompletedDebate.debater1;
              const published = Boolean(
                latestCompletedDebate.resultsPublished ||
                  latestCompletedDebate.round?.resultsPublished
              );
              const qualified = Boolean(latestCompletedDebate.isPromoted);
              const side = isDebater1 ? "GOV" : "OPP";

              return (
                <div
                  className={cn(
                    "p-4 rounded-2xl space-y-2.5",
                    published && qualified
                      ? "ax-signal-win"
                      : published && !qualified
                      ? "ax-signal-loss"
                      : "ax-signal-warn"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Award
                        size={15}
                        className="ax-signal-ink shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-heading font-bold truncate">
                        Latest: {latestCompletedDebate.round?.name || "Previous Round"}
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

                    {published ? (
                      <span
                        className={cn(
                          "ax-chip font-mono uppercase",
                          qualified ? "ax-chip--win" : "ax-chip--loss"
                        )}
                      >
                        {qualified ? (
                          <>
                            <CheckCircle2 size={12} aria-hidden="true" />
                            QUALIFIED
                          </>
                        ) : (
                          <>
                            <XCircle size={12} aria-hidden="true" />
                            ELIMINATED
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="ax-chip ax-chip--warn font-mono uppercase">
                        <Clock size={12} aria-hidden="true" />
                        Awaiting Selection
                      </span>
                    )}
                  </div>

                  <p className="text-xs opacity-90">
                    Debated vs{" "}
                    <span className="font-semibold">
                      {opponent?.firstName} {opponent?.lastName}
                    </span>
                    {opponent?.college ? ` (${opponent.college})` : ""}
                  </p>

                  <button
                    type="button"
                    onClick={jumpToInlineResults}
                    className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold ax-signal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <span>See All Results &amp; Event Standings</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </div>
              );
            })()}

          {/* Embedded Inline Results & Standings on Desktop Overview */}
          {activeEvent && (
            <div id="inline-results-desktop" className="hidden md:block pt-2">
              <ResultsHubSection
                activeEvent={activeEvent}
                eventDebates={eventDebates}
                rounds={roundsList}
                leaderboard={leaderboard}
                leaderboardLoading={leaderboardLoading}
                currentUserId={userData?.id}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab: ROUNDS */}
      {mobileTab === "rounds" && (
        <div className="space-y-3">
          {roundsList.length ? (
            roundsList.map((r) => {
              const roundWindow = getCheckInWindowMeta(r, clockNow);
              return (
                <div
                  key={r.id}
                  className="bg-card border-2 border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-bold text-base text-foreground truncate">
                        {r.name || `Round ${r.roundNumber}`}
                      </h3>
                      <span
                        className={cn(
                          getRoundStatusChipClass(r.status),
                          "font-heading uppercase"
                        )}
                      >
                        {r.status}
                      </span>
                      {r.resultsPublished && (
                        <span className="ax-chip ax-chip--win font-mono uppercase">
                          Results Out
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {roundWindow.windowText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.pairingsPublished ? "Draw published" : "Draw pending"}
                    </p>
                  </div>

                  <Link
                    to={`/dashboard/events/${activeEvent.id}/rounds/${r.id}`}
                    className="min-h-11 px-4 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>Open Round</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground bg-card border border-border rounded-xl">
              No rounds created yet for this tournament.
            </div>
          )}
        </div>
      )}

      {/* Tab: RESULTS (Full Inline Results & Event Standings — Zero Redirects) */}
      {mobileTab === "results" && (
        <div className="space-y-4">
          {activeEvent ? (
            <>
              {isEliminatedInEvent && (
                <GameOverCard
                  compact
                  eventName={activeEvent.name}
                  roundsDebated={eventRoundsDebated}
                  wins={eventWins}
                  roundLabel={
                    latestPublishedDebate?.round?.name ||
                    (latestPublishedDebate?.round?.roundNumber
                      ? `Round ${latestPublishedDebate.round.roundNumber}`
                      : null)
                  }
                />
              )}
              <ResultsHubSection
                activeEvent={activeEvent}
                eventDebates={eventDebates}
                rounds={roundsList}
                leaderboard={leaderboard}
                leaderboardLoading={leaderboardLoading}
                currentUserId={userData?.id}
              />
            </>
          ) : (
            <EmptyState
              compact
              icon={Trophy}
              title="No active tournament"
              description="Enrol in a tournament to track your debate outcomes and standings."
            />
          )}
        </div>
      )}

      {/* Quick link banner (desktop & tablet, unobtrusive) */}
      <aside
        className="hidden md:grid overflow-hidden rounded-xl bg-card border border-border p-4 axiom-rise"
        aria-label="Quick links"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              AXIOM 4.0
            </p>
            <p className="text-sm font-semibold text-foreground">
              Clarity under pressure · Parliamentary Debates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/events"
              className="min-h-11 px-3.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center"
            >
              All Tournaments
            </Link>
            <Link
              to="/dashboard/profile"
              className="min-h-11 px-3.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center"
            >
              My Profile
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
