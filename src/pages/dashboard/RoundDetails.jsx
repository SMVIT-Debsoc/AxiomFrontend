import {useState, useEffect, useRef, useMemo} from "react";
import {useParams, Link} from "react-router-dom";
import {motion as Motion} from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Gavel,
  Shield,
  Swords,
  Timer,
  Trophy,
} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {RoundApi, CheckInApi, DebateApi, UserApi} from "../../services/api";
import {useRoundSocket, useLiveRefresh} from "../../hooks/useSocket";
import {usePageRequests} from "../../hooks/usePageRequests";
import {useToast} from "../../hooks/useToast";
import {cn, formatTimeIST} from "../../lib/utils";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {RoundDetailsSkeleton} from "../../components/ui/Skeleton";
import GameOverCard from "../../components/dashboard/GameOverCard";

const ROUND_FIELDS = ["round", "profile", "checkIn", "debates"];
const ROUND_LIVE_FIELDS = ["round", "checkIn", "debates"];

export default function RoundDetails() {
  const {eventId, roundId} = useParams();
  return <RoundPage key={eventId + "/" + roundId} eventId={eventId} roundId={roundId} />;
}

function RoundPage({eventId, roundId}) {
  const {getToken} = useAuth();
  const toast = useToast();

  const [round, setRound] = useState(null);
  const [allMyDebates, setAllMyDebates] = useState([]);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [error, setError] = useState(null);

  const [checkInLoading, setCheckInLoading] = useState(true);
  const [debatesLoading, setDebatesLoading] = useState(true);
  const checkInVersion = useRef(0);
  const currentUserId = currentUser?.id;
  const myDebate = allMyDebates.find((debate) => debate.roundId === roundId) || null;

  const refresh = usePageRequests(ROUND_FIELDS, async (field, token, options, isCurrent) => {
    const checkInVersionAtStart = checkInVersion.current;
    try {
      if (field === "round") {
        const response = await RoundApi.getSummary(roundId, token, options);
        if (isCurrent()) {
          setRound(response.round);
          setError(null);
        }
      } else if (field === "profile") {
        const response = await UserApi.getProfile(token, options);
        if (isCurrent() && response?.success) setCurrentUser(response.user);
      } else if (field === "checkIn") {
        const response = await CheckInApi.getMyStatus(roundId, token, options);
        if (isCurrent() && checkInVersionAtStart === checkInVersion.current && response?.success) {
          setCheckInStatus(response);
        }
      } else if (field === "debates") {
        const response = await DebateApi.getMyDebates(token, options, eventId);
        if (isCurrent() && response?.success) setAllMyDebates(response.debates || []);
      }
    } catch (failure) {
      if (isCurrent() && field === "round") setError(failure.message);
    } finally {
      if (isCurrent()) {
        if (field === "round") setLoading(false);
        if (field === "checkIn") setCheckInLoading(false);
        if (field === "debates") setDebatesLoading(false);
      }
    }
  });

  useLiveRefresh(() => refresh(...ROUND_LIVE_FIELDS), {
    enabled: Boolean(roundId), intervalMs: 12000, jitterMs: 3000, invalidateCache: false,
  });

  useRoundSocket(roundId, {
    onRoundStatusChange: (data) => {
      refresh("round", "checkIn");
      if (data.pairingsPublished || data.status === "COMPLETED") {
        refresh("debates");
        toast.success("Round Updated", "Round status has changed.");
      }
    },
    onRoundCheckInWindow: () => {
      toast.info("Check-in Window Updated", "Check-in times were updated.");
      refresh("round", "checkIn");
    },
    onPairingsPublished: (data) => {
      if (data.published) toast.success("Draw Released!", "Pairings have been published.");
      refresh(...ROUND_LIVE_FIELDS);
    },
    onResultsPublished: (data) => {
      if (data.published) toast.success("Results Published!", "Round results are now visible.");
      refresh(...ROUND_LIVE_FIELDS);
    },
    onDebateResult: ({debateId}) => {
      if (allMyDebates.some((debate) => debate.id === debateId)) refresh("debates", "checkIn");
    },
    onRoundUpdated: () => refresh(...ROUND_LIVE_FIELDS),
    onCheckInUpdate: (data) => {
      if (data.userId === currentUserId) refresh("checkIn");
    },
  });

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const token = await getToken();
      const response = await CheckInApi.checkIn(roundId, token);
      checkInVersion.current += 1;
      setCheckInStatus({checkIn: response.checkIn, isCheckedIn: true});
      setCheckInLoading(false);

      toast.success(
        "Checked In!",
        "You have been marked as present for this round."
      );

      refresh("checkIn");
    } catch (err) {
      console.error("Check-in failed", err);
      toast.error("Check-in Failed", err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // Check-in window boundary timer
  const checkInStartTime = round?.checkInStartTime;
  const checkInEndTime = round?.checkInEndTime;
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

  const {isEliminated, eventRoundsDebated, eventWins, eliminatedRoundLabel} =
    useMemo(() => {
      const targetEventId = round?.eventId || eventId;
      const eventDebates = allMyDebates.filter(
        (d) => (d.round?.eventId || targetEventId) === targetEventId
      );
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

      const currentRoundLost = Boolean(
        myDebate &&
          myDebate.status === "COMPLETED" &&
          Boolean(round?.resultsPublished || myDebate.resultsPublished) &&
          !myDebate.isPromoted &&
          !hasLaterOverride
      );

      const eventEliminated = Boolean(
        latestPub && !latestPub.isPromoted && !hasLaterOverride
      );

      const eliminated = Boolean(
        checkInStatus?.isEliminated ||
          checkInStatus?.checkIn?.isEliminated ||
          currentRoundLost ||
          eventEliminated
      );

      const completedCount = eventDebates.filter(
        (d) => d.status === "COMPLETED"
      ).length;
      const winsCount = completedPublished.filter((d) =>
        Boolean(d.didWin ?? (currentUserId && d.winnerId === currentUserId))
      ).length;

      return {
        isEliminated: eliminated,
        eventRoundsDebated: completedCount || eventDebates.length,
        eventWins: winsCount,
        eliminatedRoundLabel:
          latestPub?.round?.name ||
          (latestPubRoundNum ? `Round ${latestPubRoundNum}` : null),
      };
    }, [
      allMyDebates,
      checkInStatus,
      currentUserId,
      eventId,
      myDebate,
      round?.eventId,
      round?.resultsPublished,
    ]);

  const isCheckInOpen = () => {
    if (!round?.checkInStartTime || !round?.checkInEndTime) return false;
    const now = new Date(clockNow);
    return (
      now >= new Date(round.checkInStartTime) &&
      now <= new Date(round.checkInEndTime)
    );
  };

  const isCheckedIn =
    checkInStatus?.isCheckedIn || checkInStatus?.checkIn?.status === "PRESENT";

  const getUserPosition = () => {
    if (!myDebate || !currentUser) return null;

    if (myDebate.debater1Id === currentUser.id) {
      return {
        position: myDebate.debater1Position || "GOV",
        opponent: myDebate.debater2,
        opponentPosition: myDebate.debater2Position || "OPP",
      };
    } else if (myDebate.debater2Id === currentUser.id) {
      return {
        position: myDebate.debater2Position || "OPP",
        opponent: myDebate.debater1,
        opponentPosition: myDebate.debater1Position || "GOV",
      };
    }
    return null;
  };

  const userPosition = getUserPosition();

  if (loading) {
    return <RoundDetailsSkeleton />;
  }

  if (error || !round) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <AlertCircle
          className="w-16 h-16 mx-auto mb-4 text-rose-500"
          aria-hidden="true"
        />
        <h2 className="text-2xl font-bold mb-2">Round Not Found</h2>
        <p className="text-muted-foreground mb-6">
          {error || "The round you are looking for does not exist."}
        </p>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex min-h-11 items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Event
        </Link>
      </div>
    );
  }

  const checkInOpenTime = round.checkInStartTime
    ? formatTimeIST(round.checkInStartTime)
    : null;
  const checkInCloseTime = round.checkInEndTime
    ? formatTimeIST(round.checkInEndTime)
    : null;
  const windowOpen = isCheckInOpen();
  const windowUpcoming =
    Boolean(round.checkInStartTime) &&
    clockNow < new Date(round.checkInStartTime).getTime();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex min-h-11 items-center text-xs font-sans text-muted-foreground hover:text-primary mb-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournament
        </Link>

        <div className="rounded-xl bg-card border border-border p-6 md:p-8 relative">
          <div className="axiom-page-header relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={cn(
                  "ax-chip font-heading uppercase",
                  round.status === "ONGOING"
                    ? "ax-chip--win"
                    : round.status === "UPCOMING"
                    ? "ax-chip--info"
                    : "ax-chip--idle"
                )}
              >
                {round.status}
              </span>
              <span className="text-xs text-muted-foreground font-sans">
                {round.event?.name}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
              {round.name || `Round ${round.roundNumber}`}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Round Stack */}
      <div className="space-y-4">
        {/* Compact Game Over Banner if Eliminated in Event */}
        {isEliminated && (
          <GameOverCard
            compact
            eventName={round.event?.name || "AXIOM 4.0"}
            roundsDebated={eventRoundsDebated}
            wins={eventWins}
            roundLabel={eliminatedRoundLabel}
          />
        )}

        {/* Motion Display */}
        {round.motion && round.pairingsPublished && (
          <Motion.div
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.24}}
            className="bg-muted/20 border border-border/60 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 text-primary mb-2">
              <Gavel className="w-4 h-4" aria-hidden="true" />
              <span className="font-heading font-semibold text-xs uppercase tracking-wider">
                MOTION
              </span>
            </div>
            <p className="text-base font-sans font-medium text-foreground leading-relaxed">
              {round.motion}
            </p>
          </Motion.div>
        )}

        {/* Check-in Section (Hidden when eliminated) */}
        {!isEliminated && round.checkInStartTime && round.checkInEndTime && (
          <Motion.div
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.24, delay: 0.04}}
            className="bg-card border border-border rounded-xl p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2 text-foreground">
                <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                Check-in Window
              </h3>
              <span
                className={cn(
                  "ax-chip font-mono uppercase",
                  isCheckedIn || windowOpen
                    ? "ax-chip--win"
                    : windowUpcoming
                    ? "ax-chip--warn"
                    : "ax-chip--loss"
                )}
              >
                {windowOpen
                  ? "OPEN NOW"
                  : windowUpcoming
                  ? `OPENS AT ${checkInOpenTime} IST`
                  : "CLOSED"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
              <span className="text-muted-foreground">Schedule:</span>
              <span className="font-mono font-semibold text-foreground">
                Opens {checkInOpenTime} IST · Closes {checkInCloseTime} IST
              </span>
            </div>

            {isCheckedIn ? (
              <div className="ax-signal-win flex items-center gap-3 p-3.5 rounded-xl">
                <CheckCircle2
                  className="w-5 h-5 shrink-0 ax-signal-ink"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-heading font-bold text-sm ax-signal-ink">
                    You&apos;re Checked In
                  </p>
                  <p className="text-xs font-sans opacity-90">
                    Marked as present for this round
                  </p>
                </div>
              </div>
            ) : windowOpen ? (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={checkingIn || checkInLoading || debatesLoading}
                className="w-full min-h-11 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {checkingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{checkingIn ? "Checking In..." : checkInLoading || debatesLoading ? "Loading status…" : "Check In Now"}</span>
              </button>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl",
                  windowUpcoming ? "ax-signal-warn" : "ax-signal-loss"
                )}
              >
                {windowUpcoming ? (
                  <Clock
                    className="w-4 h-4 shrink-0 ax-signal-ink"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="w-4 h-4 shrink-0 ax-signal-ink"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="font-heading font-bold text-xs ax-signal-ink">
                    {windowUpcoming
                      ? "Check-in Not Started Yet"
                      : "Check-in Window Closed"}
                  </p>
                  <p className="text-xs font-sans opacity-90">
                    {windowUpcoming
                      ? `Check-in opens at ${checkInOpenTime} IST.`
                      : `Check-in closed at ${checkInCloseTime} IST.`}
                  </p>
                </div>
              </div>
            )}
          </Motion.div>
        )}

        {/* Waiting for Draws */}
        {!isEliminated && isCheckedIn && !round.pairingsPublished && (
          <Motion.div
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.24, delay: 0.08}}
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Timer className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="font-heading font-bold text-base text-foreground mb-1">
              Waiting for Draws
            </h3>
            <p className="text-muted-foreground font-sans text-xs">
              You are registered and checked in. The adjudication core will publish pairings shortly.
            </p>
          </Motion.div>
        )}

        {/* Pairing / Debate Details */}
        {round.pairingsPublished && myDebate && userPosition && (
          <Motion.div
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.24, delay: 0.08}}
            className="space-y-4"
          >
            {/* Your Position */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div
                className={cn(
                  "p-4 flex items-center justify-between gap-3",
                  userPosition.position === "GOV"
                    ? "bg-[#065F46] text-[#ECFDF5]"
                    : "bg-[#312E81] text-[#EEF2FF]"
                )}
              >
                <div className="flex items-center gap-3">
                  {userPosition.position === "GOV" ? (
                    <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Swords className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-[11px] font-mono opacity-85 uppercase tracking-wider">
                      Your Position
                    </p>
                    <p className="font-heading font-bold text-base">
                      {userPosition.position === "GOV"
                        ? "Government (GOV)"
                        : "Opposition (OPP)"}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "ax-chip font-mono uppercase",
                    userPosition.position === "GOV"
                      ? "ax-chip--gov"
                      : "ax-chip--opp"
                  )}
                >
                  {userPosition.position}
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Opponent */}
                <div className="flex items-center gap-3.5">
                  <UserAvatar
                    user={userPosition.opponent}
                    imageUrl={userPosition.opponent?.imageUrl}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-sans">
                      Your Opponent
                    </p>
                    <p className="font-heading font-semibold text-sm text-foreground truncate">
                      {userPosition.opponent?.firstName}{" "}
                      {userPosition.opponent?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground font-sans truncate">
                      {userPosition.opponent?.college || "No college specified"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "ax-chip font-mono uppercase ml-auto shrink-0",
                      userPosition.opponentPosition === "GOV"
                        ? "ax-chip--gov"
                        : "ax-chip--opp"
                    )}
                  >
                    {userPosition.opponentPosition === "GOV" ? "GOV" : "OPP"}
                  </span>
                </div>

                {/* Room & Adjudicator & Time */}
                <div className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/50 text-xs font-sans">
                  {myDebate.room && (
                    <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg">
                      <MapPin
                        className="w-4 h-4 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Room
                        </p>
                        <p className="font-medium text-foreground">
                          {myDebate.room.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {(myDebate.adjudicator || myDebate.judgeName) && (
                    <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg">
                      <Gavel
                        className="w-4 h-4 text-amber-500 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Adjudicator
                        </p>
                        <p className="font-medium text-foreground">
                          {myDebate.adjudicator
                            ? [
                                myDebate.adjudicator.firstName,
                                myDebate.adjudicator.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ")
                            : myDebate.judgeName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(myDebate.startTime || myDebate.endTime) && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg text-xs font-sans">
                    <Clock
                      className="w-4 h-4 text-blue-500 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Time Slot
                      </p>
                      <p className="font-medium text-foreground">
                        {myDebate.startTime && formatTimeIST(myDebate.startTime)}
                        {myDebate.startTime && myDebate.endTime && " - "}
                        {myDebate.endTime && formatTimeIST(myDebate.endTime)}
                        {" IST"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Motion.div>
        )}

        {/* No Debate Found (only when not already showing GameOverCard or clarify cleanly) */}
        {round.pairingsPublished && !debatesLoading && !myDebate && !isEliminated && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <XCircle
              className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50"
              aria-hidden="true"
            />
            <h3 className="font-heading font-semibold text-sm mb-1 text-foreground">
              No Debate Assigned
            </h3>
            <p className="text-muted-foreground font-sans text-xs max-w-sm mx-auto">
              You don&apos;t have a debate assigned for this round. Check with tournament adjudication if you are checked in.
            </p>
          </div>
        )}

        {/* Round Outcome Showcase */}
        {myDebate &&
          myDebate.status === "COMPLETED" &&
          (() => {
            const published = Boolean(
              round.resultsPublished || myDebate.resultsPublished
            );
            const qualified = Boolean(myDebate.isPromoted);

            return (
              <Motion.div
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.24}}
                className={cn(
                  "rounded-xl p-5 space-y-3",
                  published && qualified
                    ? "ax-signal-win"
                    : published && !qualified
                    ? "ax-signal-loss"
                    : "ax-signal-warn"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy
                      className="w-4 h-4 ax-signal-ink shrink-0"
                      aria-hidden="true"
                    />
                    <h3 className="font-heading font-bold text-sm">
                      Round Outcome
                    </h3>
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
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          QUALIFIED
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" aria-hidden="true" />
                          ELIMINATED
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="ax-chip ax-chip--warn font-mono uppercase">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      AWAITING PUBLICATION
                    </span>
                  )}
                </div>

                {published ? (
                  <p className="text-xs opacity-90 font-sans">
                    {qualified
                      ? "Congratulations! You have qualified for the next stage."
                      : "Official round results have been published."}
                  </p>
                ) : (
                  <p className="text-xs opacity-90 font-sans">
                    Your debate ballot has been recorded. Qualification status will appear here live once the adjudication desk publishes results.
                  </p>
                )}
              </Motion.div>
            );
          })()}

        {/* View Results Link */}
        {(round.status === "COMPLETED" ||
          round.resultsPublished ||
          myDebate?.status === "COMPLETED") && (
          <Link
            to={`/dashboard/events/${eventId}/results`}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View Full Results &amp; Standings
          </Link>
        )}
      </div>
    </div>
  );
}
