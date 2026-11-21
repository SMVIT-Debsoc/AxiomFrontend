import DashboardLink from "../../components/dashboard/DashboardLink";
import {useState, useEffect} from "react";
import {useParams} from "react-router-dom";
import {motion as Motion} from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {usePageRequests} from "../../hooks/usePageRequests";
import {
  EventApi,
  DebateApi,
  UserApi,
  CheckInApi,
} from "../../services/api";
import {cn} from "../../lib/utils";
import {useEventSocket, useLiveRefresh, useSocket, SocketEvents} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {ResultsSkeleton} from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import SectionRetry from "../../components/ui/SectionRetry";
import GameOverCard from "../../components/dashboard/GameOverCard";

const RESULTS_FIELDS = ["event", "personal"];

export default function Results() {
  const {eventId} = useParams();
  return <ResultsPage key={eventId} eventId={eventId} />;
}

function ResultsPage({eventId}) {

  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [myDebates, setMyDebates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalFailed, setPersonalFailed] = useState(false);
  const [eliminationStatus, setEliminationStatus] = useState(null);

  const latestPublishedRound = [...rounds]
    .filter((r) => Boolean(r.resultsPublished))
    .sort((a, b) => (b.roundNumber || 0) - (a.roundNumber || 0))[0] || null;
  const latestPublishedRoundId = latestPublishedRound?.id || null;

  const refresh = usePageRequests(RESULTS_FIELDS, async (field, token, options, isCurrent) => {
    try {
      if (field === "event") {
        const response = await EventApi.getOverview(eventId, token, options);
        if (isCurrent() && response?.event) {
          setEvent(response.event);
          setRounds(response.event.rounds || []);
        }
      } else if (field === "personal") {
        const [profile, debates] = await Promise.allSettled([
          UserApi.getProfile(token, {...options, skipCache: false}),
          DebateApi.getMyDebates(token, options, eventId),
        ]);
        if (!isCurrent()) return;
        setPersonalFailed(debates.status === "rejected");
        if (profile.status === "fulfilled" && profile.value?.success) setCurrentUser(profile.value.user);
        if (debates.status === "fulfilled" && debates.value?.success) setMyDebates(debates.value.debates || []);
      } else if (field === "elimination") {
        if (!latestPublishedRoundId) {
          if (isCurrent()) setEliminationStatus(null);
          return;
        }
        const statusRes = await CheckInApi.getMyStatus(latestPublishedRoundId, token, options);
        if (isCurrent()) {
          setEliminationStatus(statusRes?.success ? statusRes : null);
        }
      }
    } catch (error) {
      if (isCurrent()) {
        console.error("Failed to fetch results", error);
      }
    } finally {
      if (isCurrent()) {
        if (field === "event") setLoading(false);
        if (field === "personal") setPersonalLoading(false);
      }
    }
  }, "event");

  // Filter debates for rounds of this event
  const eventRoundIds = new Set(rounds.map((r) => r.id));
  const myEventDebates = myDebates
    .filter((d) => d.round?.eventId === eventId || eventRoundIds.has(d.roundId))
    .sort((a, b) => (a.round?.roundNumber || 0) - (b.round?.roundNumber || 0));

  const hasPublishedResults = Boolean(
    rounds.some((r) => r.resultsPublished) ||
      myEventDebates.some((d) => d.resultsPublished || d.round?.resultsPublished)
  );

  useEffect(() => {
    if (latestPublishedRoundId) refresh("elimination");
  }, [latestPublishedRoundId, refresh]);

  useLiveRefresh(() => {
    refresh(...RESULTS_FIELDS);
    if (latestPublishedRoundId) refresh("elimination");
  }, {enabled: Boolean(eventId), eventId, intervalMs: 12000, jitterMs: 3000, invalidateCache: false});

  useEventSocket(eventId, {
    onDebateResult: ({debateId}) => {
      if (myDebates.some((debate) => debate.id === debateId)) refresh("personal");
    },
    onResultsPublished: () => {
      refresh(...RESULTS_FIELDS, "elimination");
    },
    onPairingsPublished: () => refresh(...RESULTS_FIELDS),
    onRoundStatusChange: () => refresh("event"),
    onRoundUpdated: () => refresh(...RESULTS_FIELDS, "elimination"),
  });

  const {subscribe} = useSocket();
  useEffect(() => {
    if (!SocketEvents.ROUND_PROMOTIONS) return undefined;
    return subscribe(SocketEvents.ROUND_PROMOTIONS, () => {
      refresh("personal", "elimination");
    });
  }, [subscribe, refresh]);

  const completedPublished = [...myEventDebates]
    .filter(
      (d) =>
        d.status === "COMPLETED" &&
        Boolean(d.resultsPublished || d.round?.resultsPublished)
    )
    .sort((a, b) => (b.round?.roundNumber || 0) - (a.round?.roundNumber || 0));
  const latestPubDebate = completedPublished[0] || null;
  const latestPubRoundNum = latestPubDebate?.round?.roundNumber || 0;
  const hasLaterOverride = Boolean(
    latestPubDebate &&
      myEventDebates.some(
        (d) =>
          (d.round?.roundNumber || 0) > latestPubRoundNum &&
          (d.status === "SCHEDULED" || Boolean(d.isPromoted))
      )
  );
  const eliminatedByDebate = Boolean(
    latestPubDebate && !latestPubDebate.isPromoted && !hasLaterOverride
  );
  const eliminatedByRoundStatus = Boolean(
    latestPublishedRoundId && eliminationStatus?.isEliminated && !hasLaterOverride
  );
  const isEliminatedInEvent = Boolean(
    hasPublishedResults && (eliminatedByDebate || eliminatedByRoundStatus)
  );
  const eventWins = completedPublished.filter((d) =>
    Boolean(d.didWin ?? (currentUser?.id && d.winnerId === currentUser.id))
  ).length;
  const eliminatedRoundLabel =
    latestPubDebate?.round?.name ||
    (latestPubRoundNum ? `Round ${latestPubRoundNum}` : null) ||
    latestPublishedRound?.name ||
    (latestPublishedRound?.roundNumber ? `Round ${latestPublishedRound.roundNumber}` : null);

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
        <DashboardLink
          to={`/dashboard/events/${eventId}`}
          className="inline-flex min-h-11 items-center text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground mb-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Back to Event
        </DashboardLink>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="axiom-eyebrow">Tournament Results</div>
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
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted/40 border border-border/70 px-3 py-3">
            <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums text-foreground">
              {personalLoading ? "…" : myEventDebates.length}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
              Debates
            </p>
          </div>
          <div className="ax-signal-win rounded-xl px-3 py-3">
            <p className="ax-signal-ink text-2xl sm:text-3xl font-heading font-bold tabular-nums">
              {personalLoading ? "…" : qualifiedCount}
            </p>
            <p className="text-[11px] opacity-85 font-mono uppercase tracking-wider mt-1">
              Qualified
            </p>
          </div>
          <div className="ax-signal-loss rounded-xl px-3 py-3">
            <p className="ax-signal-ink text-2xl sm:text-3xl font-heading font-bold tabular-nums">
              {personalLoading ? "…" : eliminatedCount}
            </p>
            <p className="text-[11px] opacity-85 font-mono uppercase tracking-wider mt-1">
              Eliminated
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold">My Results</h2>
      <Motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        className="space-y-3"
      >
        {isEliminatedInEvent && (
          <GameOverCard
            eventName={event?.name || "AXIOM 4.0"}
            roundsDebated={myEventDebates.filter((d) => d.status === "COMPLETED").length || myEventDebates.length}
            wins={eventWins}
            roundLabel={eliminatedRoundLabel}
            compact
          />
        )}
        {personalFailed && (
          <SectionRetry message="Could not refresh your results." busy={personalLoading} onRetry={() => {
            setPersonalLoading(true);
            refresh("personal");
          }} />
        )}
        {personalLoading && !myEventDebates.length ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading your results…</p>
        ) : myEventDebates.length === 0 && personalFailed ? null : myEventDebates.length === 0 ? (
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

    </div>
  );
}
