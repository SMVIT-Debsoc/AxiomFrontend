import {useState, useEffect} from "react";
import {useParams, Link} from "react-router-dom";
import {motion} from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Gavel,
  Shield,
  Swords,
  Timer,
} from "lucide-react";
import {useAuth, useUser} from "@clerk/clerk-react";
import {RoundApi, CheckInApi, DebateApi, UserApi} from "../../services/api";
import {socketService, SocketEvents} from "../../services/socket";
import {useToast} from "../../components/ui/Toast";
import {cn} from "../../lib/utils";
import {UserAvatar} from "../../components/ui/UserAvatar";

export default function RoundDetails() {
  const {eventId, roundId} = useParams();
  const {getToken} = useAuth();
  const {user: clerkUser} = useUser();
  const toast = useToast();

  const [round, setRound] = useState(null);
  const [myDebate, setMyDebate] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("my-debate");
  const [allDebates, setAllDebates] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Fetch round details
      const roundResponse = await RoundApi.get(roundId, token);
      if (roundResponse.success && roundResponse.round) {
        setRound(roundResponse.round);
      }

      // Fetch current user profile
      const userResponse = await UserApi.getProfile(token);
      if (userResponse.success) {
        setCurrentUser(userResponse.user);
      }

      // Fetch check-in status
      try {
        const checkInRes = await CheckInApi.getMyStatus(roundId, token);
        if (checkInRes.success) {
          setCheckInStatus(checkInRes);
        }
      } catch (e) {
        // User might not have checked in yet
      }

      // Fetch my debate for this round
      try {
        const debatesResponse = await DebateApi.getMyDebates(token);
        if (debatesResponse.success) {
          const debates = debatesResponse.debates || [];
          const myRoundDebate = debates.find((d) => d.roundId === roundId);
          if (myRoundDebate) {
            setMyDebate(myRoundDebate);
          }
        }
      } catch (e) {
        // No debates yet
      }

      // Fetch all debates if pairings published
      try {
        if (roundResponse.round?.pairingsPublished) {
          const allDebatesRes = await DebateApi.getByRound(roundId, token);
          if (allDebatesRes.success) {
            setAllDebates(allDebatesRes.debates || []);
          }
        }
      } catch (e) {
        console.error("Failed to fetch all debates", e);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch round details", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket setup
    socketService.joinRound(roundId);

    const unsubscribeStatus = socketService.on(
      SocketEvents.ROUND_STATUS_CHANGE,
      (data) => {
        // Update local round state immediately
        setRound((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...data,
          };
        });

        // If pairings were published or check-in closed, we might need a full refresh
        if (data.pairingsPublished) {
          fetchData();
          toast.success("Round Updated", "Round status has changed.");
        } else if (data.checkInEndTime) {
          // Just updating the time is enough for the UI to disable the button
          // But if we want to be safe, we can refetch
        }
      }
    );

    const unsubscribePairings = socketService.on(
      SocketEvents.PAIRINGS_GENERATED,
      () => {
        fetchData();
        toast.info(
          "Draws Released!",
          "The pairings for this round have been published."
        );
      }
    );

    const unsubscribeCheckIn = socketService.on(
      SocketEvents.CHECKIN_UPDATE,
      (data) => {
        // If it's me, refresh to show "Checked In" status
        if (currentUser && data.userId === currentUser.id) {
          fetchData();
        }
      }
    );

    return () => {
      socketService.leaveRound(roundId);
      unsubscribeStatus();
      unsubscribePairings();
      unsubscribeCheckIn();
    };
  }, [roundId, getToken, currentUser?.id]);

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
    const now = new Date();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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
    <div className="max-w-2xl mx-auto space-y-6 px-4">
      {/* Header */}
      <div>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Event
        </Link>

        <div className="bg-gradient-to-br from-primary to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-bold",
                round.status === "ONGOING"
                  ? "bg-green-500"
                  : round.status === "COMPLETED"
                  ? "bg-gray-500"
                  : "bg-blue-500"
              )}
            >
              {round.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1">
            {round.name || `Round ${round.roundNumber}`}
          </h1>
          <p className="text-white/80">{round.event?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-6 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("my-debate")}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "my-debate"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Debate
        </button>
        <button
          onClick={() => setActiveTab("draws")}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "draws"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Full Draw
        </button>
      </div>

      {/* My Debate Tab */}
      {activeTab === "my-debate" && (
        <div className="space-y-6">
          {/* Motion Display */}
          {round.motion && round.pairingsPublished && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.4}}
              className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6"
            >
              <div className="flex items-center gap-2 text-amber-500 mb-3">
                <Gavel className="w-5 h-5" />
                <span className="font-semibold text-sm">MOTION</span>
              </div>
              <p className="text-lg font-medium">{round.motion}</p>
            </motion.div>
          )}

          {/* Check-in Section */}
          {round.checkInStartTime && round.checkInEndTime && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.4, delay: 0.1}}
              className="bg-card border border-border rounded-xl p-6"
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Check-in
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Check-in Window:
                  </span>
                  <span>
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
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <p className="font-semibold">You're Checked In!</p>
                      <p className="text-sm opacity-80">
                        Marked as present for this round
                      </p>
                    </div>
                  </div>
                ) : isCheckInOpen() ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkingIn ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    {checkingIn ? "Checking In..." : "Check In Now"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-xl text-muted-foreground">
                    <Clock className="w-6 h-6" />
                    <div>
                      <p className="font-semibold">Check-in Not Available</p>
                      <p className="text-sm">
                        {new Date() < new Date(round.checkInStartTime)
                          ? "Check-in has not started yet"
                          : "Check-in window has closed"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Waiting for Draws */}
          {isCheckedIn && !round.pairingsPublished && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.4, delay: 0.2}}
              className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Timer className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Waiting for Draws</h3>
              <p className="text-muted-foreground">
                You're checked in! Please wait for the draws to be published.
              </p>
            </motion.div>
          )}

          {/* Pairing / Debate Details */}
          {round.pairingsPublished && myDebate && userPosition && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.4, delay: 0.2}}
              className="space-y-4"
            >
              {/* Your Position */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className={cn(
                    "p-4 text-white flex items-center gap-3",
                    userPosition.position === "GOV"
                      ? "bg-gradient-to-r from-green-600 to-emerald-600"
                      : "bg-gradient-to-r from-red-600 to-rose-600"
                  )}
                >
                  {userPosition.position === "GOV" ? (
                    <Shield className="w-6 h-6" />
                  ) : (
                    <Swords className="w-6 h-6" />
                  )}
                  <div>
                    <p className="text-sm opacity-80">Your Position</p>
                    <p className="font-bold text-lg">
                      {userPosition.position === "GOV"
                        ? "Government"
                        : "Opposition"}
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Opponent */}
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      user={userPosition.opponent}
                      imageUrl={userPosition.opponent?.imageUrl}
                      size="lg"
                    />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Your Opponent
                      </p>
                      <p className="font-semibold">
                        {userPosition.opponent?.firstName}{" "}
                        {userPosition.opponent?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {userPosition.opponent?.college}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "ml-auto px-3 py-1 rounded-full text-xs font-bold",
                        userPosition.opponentPosition === "GOV"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      )}
                    >
                      {userPosition.opponentPosition === "GOV" ? "GOV" : "OPP"}
                    </div>
                  </div>

                  {/* Room */}
                  {myDebate.room && (
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <MapPin className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Room</p>
                        <p className="font-semibold">{myDebate.room.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Adjudicator */}
                  {myDebate.adjudicator && (
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <Gavel className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Adjudicator
                        </p>
                        <p className="font-semibold">
                          {myDebate.adjudicator.firstName}{" "}
                          {myDebate.adjudicator.lastName}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Time Slot */}
                  {(myDebate.startTime || myDebate.endTime) && (
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Time Slot
                        </p>
                        <p className="font-semibold">
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
                          {(myDebate.startTime || myDebate.endTime) && " IST"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* No Debate Found */}
          {round.pairingsPublished && !myDebate && (
            <div className="bg-muted/50 rounded-xl p-6 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Debate Assigned</h3>
              <p className="text-muted-foreground text-sm">
                You don't have a debate assigned for this round. This could be
                because you weren't checked in or there was an odd number of
                participants.
              </p>
            </div>
          )}

          {/* View Results Link (Only if my debate is done or round completed) */}
          {round.status === "COMPLETED" && (
            <Link
              to={`/dashboard/events/${eventId}/results`}
              className="block w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-center hover:bg-primary/90 transition-colors"
            >
              View Results
            </Link>
          )}
        </div>
      )}

      {/* Full Draw Tab */}
      {activeTab === "draws" && (
        <div className="space-y-4">
          {!round.pairingsPublished ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl">
              <Swords className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-bold text-lg mb-2">Draws Not Published</h3>
              <p className="text-muted-foreground">
                The pairings for this round have not been released yet.
              </p>
            </div>
          ) : allDebates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {allDebates.map((debate, index) => (
                <motion.div
                  key={debate.id}
                  initial={{opacity: 0, y: 20}}
                  animate={{opacity: 1, y: 0}}
                  transition={{duration: 0.3, delay: index * 0.1}}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="w-[45%] flex flex-col items-center gap-2">
                      <div className="relative">
                        <UserAvatar
                          user={debate.debater1}
                          imageUrl={debate.debater1.imageUrl}
                          size="md"
                        />
                        <span className="absolute -bottom-2 -right-2 text-[10px] font-bold text-white bg-green-600 px-2 py-0.5 rounded-full shadow-sm z-10">
                          GOV
                        </span>
                      </div>
                      <p className="font-bold text-sm truncate w-full text-center">
                        {debate.debater1.firstName} {debate.debater1.lastName}
                      </p>
                    </div>
                    <div className="text-muted-foreground font-black text-xs pt-4">
                      VS
                    </div>
                    <div className="w-[45%] flex flex-col items-center gap-2">
                      <div className="relative">
                        <UserAvatar
                          user={debate.debater2}
                          imageUrl={debate.debater2.imageUrl}
                          size="md"
                        />
                        <span className="absolute -bottom-2 -right-2 text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full shadow-sm z-10">
                          OPP
                        </span>
                      </div>
                      <p className="font-bold text-sm truncate w-full text-center">
                        {debate.debater2.firstName} {debate.debater2.lastName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {debate.room ? debate.room.name : "No Room"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Gavel className="w-3 h-3" />
                      {debate.adjudicator
                        ? `${debate.adjudicator.firstName} ${debate.adjudicator.lastName}`
                        : "TBD"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
