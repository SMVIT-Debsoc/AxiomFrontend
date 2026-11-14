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
import {useRoundSocket} from "../../hooks/useSocket";
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
  const [activeTab, setActiveTab] = useState("my-debate");
  const [allDebates, setAllDebates] = useState([]);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
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

      if (roundResponse?.round?.pairingsPublished) {
        if (Array.isArray(roundResponse.round.debates) && roundResponse.round.debates.length > 0) {
          setAllDebates(roundResponse.round.debates);
        } else {
          try {
            const allDebatesRes = await DebateApi.getByRound(roundId, token);
            if (allDebatesRes.success) {
              setAllDebates(allDebatesRes.debates || []);
            }
          } catch {
            // debates not available yet
          }
        }
      } else {
        setAllDebates([]);
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

  useRoundSocket(roundId, {
    onRoundStatusChange: (data) => {
      setRound((prev) => (prev ? {...prev, ...data} : prev));
      if (data.pairingsPublished || data.status === "COMPLETED") {
        fetchData();
        toast.success("Round Updated", "Round status has changed.");
      }
    },
    onPairingsPublished: (data) => {
      if (data.published) {
        toast.success("Draw Released!", "Pairings have been published.");
      }
      fetchData();
    },
    onResultsPublished: (data) => {
      if (data.published) {
        toast.success("Results Published!", "Round results are now visible.");
      }
      fetchData();
    },
    onDebateResult: () => {
      fetchData();
    },
    onRoundUpdated: (data) => {
      if (data.round) {
        setRound((prev) => (prev ? {...prev, ...data.round} : data.round));
      }
      fetchData();
    },
    onCheckInUpdate: (data) => {
      if (data.userId === currentUserId) {
        fetchData();
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

      {/* Tabs */}
      <div className="flex items-center justify-center gap-6 border-b border-border">
        <button
          onClick={() => setActiveTab("my-debate")}
          className={cn(
            "pb-3 text-sm font-sans font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "my-debate"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Debate
        </button>
        <button
          onClick={() => setActiveTab("draws")}
          className={cn(
            "pb-3 text-sm font-sans font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "draws"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Full Draw
        </button>
      </div>

      {/* My Debate Tab */}
      {activeTab === "my-debate" && (
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
            const isDebater1 = myDebate.debater1Id === currentUser?.id;
            const myScore = myDebate.myScore ?? (isDebater1 ? myDebate.debater1Score : myDebate.debater2Score);
            const opponentScore = myDebate.opponentScore ?? (isDebater1 ? myDebate.debater2Score : myDebate.debater1Score);

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
                  <>
                    <p className="text-xs text-muted-foreground font-sans">
                      {myDebate.winnerId
                        ? myDebate.winnerId === currentUser?.id
                          ? "Congratulations! You won this round ballot."
                          : `${myDebate.winner?.firstName || "Your opponent"} ${myDebate.winner?.lastName || ""} won this ballot.`
                        : "Official round results have been published."}
                    </p>
                    {(myScore != null || opponentScore != null) && (
                      <div className="grid grid-cols-2 gap-2.5 rounded-lg bg-card border border-border/70 p-3 text-center">
                        <div>
                          <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Your Speaker Score</p>
                          <p className="text-lg font-heading font-bold text-foreground tabular-nums">
                            {myScore != null ? myScore : "—"}
                          </p>
                        </div>
                        <div className="border-l border-border/60">
                          <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Opponent Score</p>
                          <p className="text-lg font-heading font-bold text-muted-foreground tabular-nums">
                            {opponentScore != null ? opponentScore : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground font-sans">
                    Your debate ballot has been recorded. Scores and qualification status will appear here live once the adjudication desk publishes results.
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
      )}

      {/* Full Draw Tab */}
      {activeTab === "draws" && (
        <div className="space-y-3">
          {!round.pairingsPublished ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Swords className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" aria-hidden="true" />
              <h3 className="font-heading font-bold text-base mb-1 text-foreground">Draws Not Published</h3>
              <p className="text-muted-foreground font-sans text-xs">
                The pairings for this round have not been released yet.
              </p>
            </div>
          ) : allDebates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : (
            <div className="space-y-3">
              {allDebates.map((debate, index) => (
                <Motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{duration: 0.2, delay: index * 0.03}}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="w-[45%] flex flex-col items-center gap-1.5">
                      <div className="relative">
                        <UserAvatar
                          user={debate.debater1}
                          imageUrl={debate.debater1?.imageUrl}
                          size="md"
                        />
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-heading font-bold text-white bg-emerald-600 px-1.5 py-0.2 rounded-full shadow-sm z-10">
                          GOV
                        </span>
                      </div>
                      <p className="font-heading font-semibold text-xs truncate w-full text-center text-foreground">
                        {debate.debater1?.firstName} {debate.debater1?.lastName}
                      </p>
                      {round.resultsPublished && debate.winnerId && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          {debate.debater1Score != null && (
                            <span className="text-muted-foreground">{debate.debater1Score}</span>
                          )}
                          {debate.winnerId === debate.debater1Id && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                              WIN
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-muted-foreground font-heading font-bold text-xs">
                      VS
                    </div>
                    <div className="w-[45%] flex flex-col items-center gap-1.5">
                      <div className="relative">
                        <UserAvatar
                          user={debate.debater2}
                          imageUrl={debate.debater2?.imageUrl}
                          size="md"
                        />
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-heading font-bold text-white bg-[#1D1E18] dark:bg-[#2F5438] px-1.5 py-0.2 rounded-full shadow-sm z-10">
                          OPP
                        </span>
                      </div>
                      <p className="font-heading font-semibold text-xs truncate w-full text-center text-foreground">
                        {debate.debater2?.firstName} {debate.debater2?.lastName}
                      </p>
                      {round.resultsPublished && debate.winnerId && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          {debate.debater2Score != null && (
                            <span className="text-muted-foreground">{debate.debater2Score}</span>
                          )}
                          {debate.winnerId === debate.debater2Id && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                              WIN
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-xs text-muted-foreground font-sans">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{debate.room ? debate.room.name : "No Room"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Gavel className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{debate.adjudicator
                        ? `${debate.adjudicator.firstName} ${debate.adjudicator.lastName}`
                        : "TBD"}</span>
                    </div>
                  </div>
                </Motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
