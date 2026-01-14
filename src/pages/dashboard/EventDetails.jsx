import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Trophy,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Search as SearchIcon,
  School,
  User,
  Crown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { EventApi, DebateApi, UserApi, StatsApi } from "../../services/api";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/utils";
import { useEventSocket } from "../../hooks/useSocket";
import { UserAvatar } from "../../components/ui/UserAvatar";

export default function EventDetails() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // overview | rounds | participants | results
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // New State for inline tabs
  const [participants, setParticipants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [myDebates, setMyDebates] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [resultSubTab, setResultSubTab] = useState("my-results");

  // Fetch data function for reuse
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Fetch event details from backend
      const eventResponse = await EventApi.get(id, token);
      if (eventResponse.success && eventResponse.event) {
        setEvent(eventResponse.event);

        // Rounds are included with the event
        const eventRounds = eventResponse.event.rounds || [];
        setRounds(eventRounds);
      } else {
        setError("Event not found");
      }

      // Check enrollment status
      const enrollmentResponse = await EventApi.getEnrollmentStatus(id, token);
      if (enrollmentResponse.success) {
        setIsEnrolled(enrollmentResponse.isEnrolled);
      }

      // Fetch Participants
      try {
        const partsParams = await EventApi.getParticipants(id, token);
        if (partsParams.success) {
          setParticipants(partsParams.participants || []);
        }
      } catch (e) {
        console.error("Failed to fetch participants", e);
      }

      // Fetch User Profile (for ID check)
      try {
        const userResponse = await UserApi.getProfile(token);
        if (userResponse.success) {
          setCurrentUser(userResponse.user);
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }

      // Fetch My Debates
      try {
        const myDebatesResponse = await DebateApi.getMyDebates(token);
        if (myDebatesResponse.success) {
          setMyDebates(myDebatesResponse.debates || []);
        }
      } catch (e) {
        // Silently fail if no debates found or error
        console.log("No debates or error fetching debates", e);
      }

      // Fetch Leaderboard
      try {
        const leadResponse = await StatsApi.getLeaderboard(token, id, 100);
        if (leadResponse.success && leadResponse.data?.leaderboard) {
          setLeaderboard(leadResponse.data.leaderboard);
        } else if (
          leadResponse.leaderboard &&
          Array.isArray(leadResponse.leaderboard)
        ) {
          setLeaderboard(leadResponse.leaderboard);
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard", e);
      }
    } catch (err) {
      console.error("Failed to fetch event details", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates via WebSocket
  useEventSocket(id, {
    onRoundStatusChange: (data) => {
      console.log("[Socket] Round status changed:", data);
      // Update the specific round in state
      setRounds((prev) =>
        prev.map((r) =>
          r.id === data.roundId
            ? {
              ...r,
              status: data.status,
              checkInStartTime: data.checkInStartTime,
              checkInEndTime: data.checkInEndTime,
            }
            : r
        )
      );
      toast.info(
        "Round Updated",
        `Round status has been updated to ${data.status}`
      );
    },
    onPairingsPublished: (data) => {
      console.log("[Socket] Pairings published:", data);
      setRounds((prev) =>
        prev.map((r) =>
          r.id === data.roundId ? { ...r, pairingsPublished: data.published } : r
        )
      );
      if (data.published) {
        toast.success(
          "Pairings Published!",
          "Check your assigned debate room."
        );
      }
    },
    onDebateResult: (data) => {
      console.log("[Socket] Debate result:", data);
      toast.info("Result Submitted", "A debate result has been submitted.");
      // Refresh data on result
      fetchData();
    },
    onLeaderboardUpdate: () => {
      console.log("[Socket] Leaderboard updated");
      fetchData();
    },
  });

  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      const token = await getToken();
      await EventApi.enroll(id, token);
      toast.success(
        "Enrolled Successfully!",
        "You have been registered for this event."
      );
      setIsEnrolled(true);
      // Refresh participants list
      const partsParams = await EventApi.getParticipants(id, token);
      if (partsParams.success) {
        setParticipants(partsParams.participants || []);
      }
    } catch (err) {
      console.error("Enrollment failed", err);
      toast.error("Enrollment Failed", err.message);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground mb-6">
          {error || "The event you are looking for does not exist."}
        </p>
        <Link
          to="/dashboard/events"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header / Breadcrumb */}
      <div>
        <Link
          to="/dashboard/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tournaments
        </Link>
        <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Trophy className="w-64 h-64 text-primary" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border",
                  event.status === "ONGOING"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : event.status === "UPCOMING"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                )}
              >
                {event.status}
              </span>
              <span className="flex items-center text-muted-foreground text-sm">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(event.startDate).toLocaleDateString()}
                {event.endDate &&
                  ` - ${new Date(event.endDate).toLocaleDateString()}`}
              </span>
            </div>
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  {event.name}
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  {event.description || "No description available"}
                </p>
              </div>
              <button
                onClick={handleEnroll}
                disabled={isEnrolled || enrolling}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 min-w-[140px]",
                  isEnrolled
                    ? "bg-green-500 cursor-default hover:translate-y-0 hover:shadow-lg"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isEnrolled ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Enrolled
                  </span>
                ) : enrolling ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enrolling...
                  </span>
                ) : (
                  "Enroll Now"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 md:gap-6 border-b border-border overflow-x-auto pb-px">
        {["overview", "rounds", "participants", "results"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "relative pb-3 text-sm font-medium capitalize transition-colors whitespace-nowrap",
              activeTab === tab
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] relative">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid md:grid-cols-3 gap-6"
            >
              <div className="md:col-span-2 space-y-6">
                <section className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4">About the Event</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {event.description ||
                      "This debate competition features multiple rounds of competitive debating. Check back for more details about format and rules."}
                  </p>
                </section>
                <section className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4">
                    Schedule ({rounds.length} Rounds)
                  </h3>
                  {rounds.length === 0 ? (
                    <p className="text-muted-foreground">
                      No rounds have been scheduled yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {rounds.map((round) => (
                        <div
                          key={round.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-border">
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {round.name || `Round ${round.roundNumber}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {round.checkInStartTime
                                  ? `Check-in: ${new Date(
                                    round.checkInStartTime
                                  ).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Kolkata",
                                  })} IST`
                                  : "Time TBD"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-1 rounded",
                              round.status === "COMPLETED"
                                ? "bg-green-500/10 text-green-500"
                                : round.status === "ONGOING"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-primary/10 text-primary"
                            )}
                          >
                            {round.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-primary/20 to-purple-600/10 border border-primary/20 rounded-xl p-6">
                  <h3 className="font-bold mb-2">Event Status</h3>
                  <div className="flex items-center gap-2 text-green-400 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{event.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rounds.length} rounds scheduled
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-bold mb-4">Event Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-medium">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    {event.endDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">End Date</span>
                        <span className="font-medium">
                          {new Date(event.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Rounds
                      </span>
                      <span className="font-medium">{rounds.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "rounds" && (
            <motion.div
              key="rounds"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {rounds.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No rounds have been scheduled yet.</p>
                </div>
              ) : (
                rounds.map((round) => (
                  <Link
                    key={round.id}
                    to={`/dashboard/events/${id}/rounds/${round.id}`}
                    className="block p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">
                          {round.name || `Round ${round.roundNumber}`}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {round.checkInStartTime
                            ? `Check-in: ${new Date(
                              round.checkInStartTime
                            ).toLocaleString()}`
                            : "Time TBD"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-bold px-2 py-1 rounded",
                            round.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-500"
                              : round.status === "ONGOING"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-primary/10 text-primary"
                          )}
                        >
                          {round.status}
                        </span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                    {round.motion && round.pairingsPublished && (
                      <div className="p-4 rounded-lg bg-muted/20 border border-border">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                          Motion
                        </span>
                        <p className="text-lg font-medium mt-1">
                          {round.motion}
                        </p>
                      </div>
                    )}
                    {!round.pairingsPublished &&
                      round.status !== "UPCOMING" && (
                        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                          <p className="text-sm text-amber-500 font-medium">
                            Waiting for draws to be published...
                          </p>
                        </div>
                      )}
                  </Link>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "participants" && (
            <motion.div
              key="participants"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Search Bar */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              {/* Participants List */}
              <div className="space-y-3">
                {participants.filter((p) => {
                  const fullName = `${p.firstName || ""} ${p.lastName || ""
                    }`.toLowerCase();
                  const college = (p.college || "").toLowerCase();
                  const query = searchQuery.toLowerCase();
                  return fullName.includes(query) || college.includes(query);
                }).length === 0 ? (
                  <div className="text-center py-12 bg-card border border-border rounded-xl">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No participants found matching your search."
                        : "No participants registered yet."}
                    </p>
                  </div>
                ) : (
                  participants
                    .filter((p) => {
                      const fullName = `${p.firstName || ""} ${p.lastName || ""
                        }`.toLowerCase();
                      const college = (p.college || "").toLowerCase();
                      const query = searchQuery.toLowerCase();
                      return (
                        fullName.includes(query) || college.includes(query)
                      );
                    })
                    .map((participant, index) => (
                      <motion.div
                        key={participant.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <UserAvatar user={participant} size="lg" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate">
                                {participant.firstName} {participant.lastName}
                              </p>
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <School className="w-4 h-4" />
                              <span className="truncate">
                                {participant.college || "No college"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Sub-tabs for Results */}
              <div className="flex items-center gap-4 border-b border-border mb-4">
                {["my-results", "leaderboard"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setResultSubTab(tab)}
                    className={cn(
                      "relative pb-3 text-sm font-medium transition-colors capitalize",
                      resultSubTab === tab
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.replace("-", " ")}
                    {resultSubTab === tab && (
                      <motion.div
                        layoutId="activeResultTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="min-h-[200px] relative">
                <AnimatePresence mode="wait">
                  {resultSubTab === "my-results" && (
                    <motion.div
                      key="my-results"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {myDebates.filter((d) =>
                        rounds.map((r) => r.id).includes(d.roundId)
                      ).length === 0 ? (
                        <div className="text-center py-12 bg-card border border-border rounded-xl">
                          <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            No debate results yet for this event.
                          </p>
                        </div>
                      ) : (
                        myDebates
                          .filter((d) =>
                            rounds.map((r) => r.id).includes(d.roundId)
                          )
                          .map((debate, index) => {
                            const round = rounds.find(
                              (r) => r.id === debate.roundId
                            );
                            const isWinner =
                              debate.winnerId === currentUser?.id;
                            const isDebater1 =
                              debate.debater1Id === currentUser?.id;
                            const opponent = isDebater1
                              ? debate.debater2
                              : debate.debater1;
                            const myScore = isDebater1
                              ? debate.debater1Score
                              : debate.debater2Score;
                            const opponentScore = isDebater1
                              ? debate.debater2Score
                              : debate.debater1Score;

                            return (
                              <motion.div
                                key={debate.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
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
                                      {round?.name ||
                                        `Round ${round?.roundNumber || "?"}`}
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
                                  <UserAvatar user={opponent} size="md" />
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      vs {opponent?.firstName}{" "}
                                      {opponent?.lastName}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {opponent?.college}
                                    </p>
                                  </div>
                                  {debate.status === "COMPLETED" &&
                                    myScore !== null && (
                                      <div className="text-right">
                                        <p className="text-lg font-bold">
                                          {myScore} - {opponentScore}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Score
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </motion.div>
                            );
                          })
                      )}
                    </motion.div>
                  )}

                  {resultSubTab === "leaderboard" && (
                    <motion.div
                      key="leaderboard"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {leaderboard.length === 0 ? (
                        <div className="text-center py-12 bg-card border border-border rounded-xl">
                          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            Leaderboard will be available once results are
                            submitted.
                          </p>
                        </div>
                      ) : (
                        leaderboard.map((entry, index) => {
                          const isCurrentUser =
                            entry.user?.id === currentUser?.id;

                          return (
                            <motion.div
                              key={entry.user?.id || index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
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
                                {index === 0 ? (
                                  <Crown className="w-5 h-5" />
                                ) : (
                                  index + 1
                                )}
                              </div>


                              {/* Avatar */}
                              <UserAvatar user={entry.user || entry} size="md" />

                              {/* User Info */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    "font-semibold truncate",
                                    isCurrentUser && "text-primary"
                                  )}
                                >
                                  {entry.user?.firstName} {entry.user?.lastName}
                                  {isCurrentUser && " (You)"}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {entry.user?.college}
                                </p>
                              </div>

                              {/* Stats */}
                              <div className="text-right">
                                <p className="font-bold text-lg">
                                  {entry.stats?.wins}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.stats?.wins === 1 ? "Win" : "Wins"}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
