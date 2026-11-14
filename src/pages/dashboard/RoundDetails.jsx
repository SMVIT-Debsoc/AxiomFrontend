import {useState, useEffect, useRef, useCallback} from "react";
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
  RefreshCw,
} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {RoundApi, CheckInApi, DebateApi, UserApi} from "../../services/api";
import {useRoundSocket, useLiveRefresh} from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast"
import {cn} from "../../lib/utils";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {RoundDetailsSkeleton} from "../../components/ui/Skeleton";

export default function RoundDetails() {
  const {eventId, roundId} = useParams();
  const {getToken} = useAuth();
  const toast = useToast();

  const [round, setRound] = useState(null);
  const [myDebate, setMyDebate] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [error, setError] = useState(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchData = useCallback(async ({silent = false} = {}) => {
    try {
      if (!silent) setLoading(true);
      const token = await getTokenRef.current();

      const [roundResponse, userResponse, checkInRes, debatesResponse] = await Promise.all([
        RoundApi.get(roundId, token),
        UserApi.getProfile(token).catch(() => ({success: false})),
        CheckInApi.getMyStatus(roundId, token).catch(() => ({success: false})),
        DebateApi.getMyDebates(token).catch(() => ({success: false, debates: []})),
      ]);

      if (roundResponse?.success && roundResponse.round) {
        setRound(roundResponse.round);
      }

      if (userResponse?.success) {
        setCurrentUser(userResponse.user);
      }

      if (checkInRes?.success) {
        setCheckInStatus(checkInRes);
      }

      if (debatesResponse?.success) {
        const debates = debatesResponse.debates || [];
        const myRoundDebate = debates.find((d) => d.roundId === roundId);
        setMyDebate(myRoundDebate || null);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch round details", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  const currentUserId = currentUser?.id;
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const softRefetch = useCallback(() => fetchData({silent: true}), [fetchData]);
  useLiveRefresh(softRefetch, {enabled: Boolean(roundId)});

  useRoundSocket(roundId, {
    onRoundStatusChange: (data) => {
      setRound((prev) => (prev ? {...prev, ...data} : prev));
      if (data.pairingsPublished || data.status === "COMPLETED") {
        softRefetch();
        toast.success("Round Updated", "Round status has changed.");
      }
    },
    onPairingsPublished: (data) => {
      if (data.published) {
        toast.success("Draw Released!", "Pairings have been published.");
      }
      softRefetch();
    },
    onResultsPublished: (data) => {
      if (data.published) {
        toast.success("Results Published!", "Round results are now visible.");
      }
      softRefetch();
    },
    onDebateResult: () => {
      softRefetch();
    },
    onRoundUpdated: (data) => {
      if (data.round) {
        setRound((prev) => (prev ? {...prev, ...data.round} : data.round));
      }
      softRefetch();
    },
    onCheckInUpdate: (data) => {
      if (data.userId === currentUserId) {
        softRefetch();
      }
    },
  });

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const token = await getToken();
      await CheckInApi.checkIn(roundId, token);

      toast.success(
        "Checked In!",
        "You have been marked as present for this round."
      );

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Check-in failed", err);
      toast.error("Check-in Failed", err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // Check-in window helpers
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

  // Determine user position in debate
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

  const checkInStartTime = round?.checkInStartTime;
  const checkInEndTime = round?.checkInEndTime;
  useEffect(() => {
    if (!checkInStartTime || !checkInEndTime) return;
    let timer;
    const updateAtBoundary = () => {
      const now = Date.now();
      setClockNow(now);
      const nextBoundary = [Date.parse(checkInStartTime), Date.parse(checkInEndTime)]
        .filter((time) => time > now)
        .sort((a, b) => a - b)[0];
      if (nextBoundary) timer = window.setTimeout(updateAtBoundary, nextBoundary - now + 5);
    };
    updateAtBoundary();
    return () => window.clearTimeout(timer);
  }, [checkInStartTime, checkInEndTime]);

  if (loading) {
    return <RoundDetailsSkeleton />;
  }

  if (error || !round) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2">Round Not Found</h2>
        <p className="text-muted-foreground mb-6">
          {error || "The round you are looking for does not exist."}
        </p>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Event
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-xs font-sans text-muted-foreground hover:text-primary mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournament
        </Link>

        <div className="rounded-xl bg-card border border-border p-6 md:p-8 relative">
          <div className="axiom-page-header relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs font-heading font-semibold uppercase tracking-wider border",
                  round.status === "ONGOING"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : round.status === "COMPLETED"
                    ? "bg-muted text-muted-foreground border-border"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
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

      {/* My Debate Details */}
      <div className="space-y-4">
          {/* Motion Display */}
          {round.motion && round.pairingsPublished && (
            <Motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
              className="bg-muted/20 border border-border/60 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 text-primary mb-2">
                <Gavel className="w-4 h-4" aria-hidden="true" />
                <span className="font-heading font-semibold text-xs uppercase tracking-wider">MOTION</span>
              </div>
              <p className="text-base font-sans font-medium text-foreground leading-relaxed">{round.motion}</p>
            </Motion.div>
          )}

          {/* Check-in Section */}
          {round.checkInStartTime && round.checkInEndTime && (
            <Motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3, delay: 0.05}}
              className="bg-card border border-border rounded-xl p-5"
            >
              <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
                <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                Check-in
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-muted-foreground">
                    Check-in Window:
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(round.checkInStartTime).toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      }
                    )}
                    {" - "}
                    {new Date(round.checkInEndTime).toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      }
                    )}
                    {" IST"}
                  </span>
                </div>

                {isCheckedIn ? (
                  <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-heading font-semibold text-sm">You're Checked In</p>
                      <p className="text-xs font-sans opacity-90">
                        Marked as present for this round
                      </p>
                    </div>
                  </div>
                ) : isCheckInOpen() ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {checkingIn ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    )}
                    {checkingIn ? "Checking In..." : "Check In Now"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 bg-muted/40 border border-border/50 rounded-lg text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-heading font-semibold text-xs text-foreground">Check-in Not Available</p>
                      <p className="text-xs font-sans">
                        {clockNow < new Date(round.checkInStartTime).getTime()
                          ? "Check-in has not started yet"
                          : "Check-in window has closed"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Motion.div>
          )}

          {/* Waiting for Draws */}
          {isCheckedIn && !round.pairingsPublished && (
            <Motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3, delay: 0.1}}
              className="bg-card border border-border rounded-xl p-6 text-center"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Timer className="w-6 h-6 animate-pulse" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-bold text-base text-foreground mb-1">Waiting for Draws</h3>
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
              transition={{duration: 0.3, delay: 0.1}}
              className="space-y-4"
            >
              {/* Your Position */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className={cn(
                    "p-4 text-white flex items-center gap-3",
                    userPosition.position === "GOV"
                      ? "bg-emerald-600"
                      : "bg-[#1D1E18] dark:bg-[#2F5438]"
                  )}
                >
                  {userPosition.position === "GOV" ? (
                    <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Swords className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-xs font-sans opacity-90 uppercase tracking-wider">Your Position</p>
                    <p className="font-heading font-bold text-base">
                      {userPosition.position === "GOV"
                        ? "Government"
                        : "Opposition"}
                    </p>
                  </div>
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
                    <div
                      className={cn(
                        "ml-auto px-2.5 py-0.5 rounded text-[10px] font-heading font-semibold border uppercase tracking-wider",
                        userPosition.opponentPosition === "GOV"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-[#1D1E18]/10 text-[#1D1E18] dark:text-[#B9F5D8] border-[#1D1E18]/25"
                      )}
                    >
                      {userPosition.opponentPosition === "GOV" ? "GOV" : "OPP"}
                    </div>
                  </div>

                  {/* Room & Adjudicator & Time */}
                  <div className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/50 text-xs font-sans">
                    {myDebate.room && (
                      <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg">
                        <MapPin className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Room</p>
                          <p className="font-medium text-foreground">{myDebate.room.name}</p>
                        </div>
                      </div>
                    )}

                    {(myDebate.adjudicator || myDebate.judgeName) && (
                      <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg">
                        <Gavel className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Adjudicator</p>
                          <p className="font-medium text-foreground">
                            {myDebate.adjudicator
                              ? [myDebate.adjudicator.firstName, myDebate.adjudicator.lastName].filter(Boolean).join(" ")
                              : myDebate.judgeName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(myDebate.startTime || myDebate.endTime) && (
                    <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg text-xs font-sans">
                      <Clock className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Time Slot</p>
                        <p className="font-medium text-foreground">
                          {myDebate.startTime &&
                            new Date(myDebate.startTime).toLocaleTimeString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Kolkata",
                              }
                            )}
                          {myDebate.startTime && myDebate.endTime && " - "}
                          {myDebate.endTime &&
                            new Date(myDebate.endTime).toLocaleTimeString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Kolkata",
                              }
                            )}
                          {" IST"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Motion.div>
          )}

          {/* No Debate Found */}
          {round.pairingsPublished && !myDebate && (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <XCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" aria-hidden="true" />
              <h3 className="font-heading font-semibold text-sm mb-1 text-foreground">No Debate Assigned</h3>
              <p className="text-muted-foreground font-sans text-xs max-w-sm mx-auto">
                You don't have a debate assigned for this round. Check with tournament adjudication if you are checked in.
              </p>
            </div>
          )}

          {/* Round Outcome Showcase */}
          {myDebate && myDebate.status === "COMPLETED" && (() => {
            const published = Boolean(round.resultsPublished || myDebate.resultsPublished);
            const qualified = Boolean(myDebate.isPromoted);

            return (
              <Motion.div
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.3}}
                className={cn(
                  "border rounded-xl p-5 space-y-3",
                  published && qualified
                    ? "bg-emerald-500/[0.04] border-emerald-500/40"
                    : published && !qualified
                    ? "bg-destructive/[0.04] border-destructive/30"
                    : "bg-amber-500/[0.04] border-amber-500/30"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    <h3 className="font-heading font-bold text-sm text-foreground">
                      Round Outcome
                    </h3>
                  </div>
                  {published ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-heading font-bold uppercase tracking-wider border",
                        qualified
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-heading font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                      AWAITING PUBLICATION
                    </span>
                  )}
                </div>

                {published ? (
                  <p className="text-xs text-muted-foreground font-sans">
                    {qualified
                      ? "Congratulations! You have qualified for the next stage."
                      : "Official round results have been published."}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground font-sans">
                    Your debate ballot has been recorded. Qualification status will appear here live once the adjudication desk publishes results.
                  </p>
                )}
              </Motion.div>
            );
          })()}

          {/* View Results Link */}
          {(round.status === "COMPLETED" || round.resultsPublished || myDebate?.status === "COMPLETED") && (
            <Link
              to={`/dashboard/events/${eventId}/results`}
              className="block w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs text-center hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View Full Results &amp; Standings
            </Link>
          )}
        </div>
    </div>
  );
}
