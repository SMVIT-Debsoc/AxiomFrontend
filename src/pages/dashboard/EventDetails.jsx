import { useState, useEffect, useCallback, useRef } from "react";
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
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { EventApi, DebateApi, UserApi, StatsApi } from "../../services/api";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/utils";
import { useEventSocket } from "../../hooks/useSocket";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { EventDetailsSkeleton } from "../../components/ui/Skeleton";

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
  const [isAdmin, setIsAdmin] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Admin check
  useEffect(() => {
    const checkAdmin = async () => {
      const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const API_BASE_URL = isLocalhost ? import.meta.env.VITE_API_URL || "http://localhost:3000/api" : "/api";
      try {
        const token = await getTokenRef.current();
        const response = await fetch(`${API_BASE_URL}/admin/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.success && !!data.admin);
        }
      } catch (e) {}
    };
    checkAdmin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once

  // Fetch data function for reuse
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // stable - getToken via ref, id is the real dependency

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates via WebSocket
  useEventSocket(id, {
    onRoundCreated: (data) => {
      console.log("[Socket] Round created:", data);
      toast.info("New Round!", "A new round has been added to this event.");
      fetchData();
    },
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
              pairingsPublished: data.pairingsPublished,
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

      // Optimistic update for immediate UI feedback
      setMyDebates((prev) =>
        prev.map((d) => {
          if (d.id === data.debateId) {
            return {
              ...d,
              status: "COMPLETED",
              winnerId: data.winnerId,
              debater1Score: data.debater1Score,
              debater2Score: data.debater2Score,
            };
          }
          return d;
        })
      );

      toast.info("Result Submitted", "A debate result has been submitted.");
      // Refresh data to ensure full consistency
      fetchData();
    },
    onLeaderboardUpdate: () => {
      console.log("[Socket] Leaderboard updated");
      fetchData();
    },
    onEventUpdated: (data) => {
      console.log("[Socket] Event updated:", data);
      if (data.event) {
        setEvent((prev) => ({ ...prev, ...data.event }));
        toast.info("Event Updated", "Event details have been modified.");
      } else {
        fetchData();
      }
    },
    onEventDeleted: () => {
      toast.error("Event Deleted", "This event has been cancelled or removed.");
      // Redirect to dashboard logic could be added here, but for now just show toast/error state
      setError("Event has been deleted.");
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
    return <EventDetailsSkeleton />;
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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header / Breadcrumb */}
      <div>
        <Link
          to="/dashboard/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tournaments
        </Link>
        <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-6 md:p-12">
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
                <h1 className="text-3xl md:text-5xl font-bold mb-4">
                  {event.name}
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  {event.description || "No description available"}
                </p>
              </div>
              <div className="flex flex-col gap-3 flex-shrink-0">
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolled || enrolling}
                  className={cn(
                    "px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 min-w-[160px]",
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
                {event.whatsappLink && (
                  <a
                    href={event.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-green-400 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 min-w-[160px]"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Join WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 md:gap-6 border-b border-border overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
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
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 gap-3"
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
                          <div className="flex flex-wrap items-center gap-2">
                            {(() => {
                              const debate = myDebates.find(
                                (d) => d.roundId === round.id
                              );
                              if (debate?.status === "COMPLETED") {
                                if (!debate.resultsPublished) {
                                  return (
                                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-500 whitespace-nowrap">
                                      PENDING
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap",
                                      debate.isPromoted
                                        ? "bg-green-500/10 text-green-500"
                                        : "bg-red-500/10 text-red-500"
                                    )}
                                  >
                                    {debate.isPromoted ? "QUALIFIED" : "ELIMINATED"}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {round.pairingsPublished && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/10 text-purple-500 whitespace-nowrap">
                                Draw Out
                              </span>
                            )}
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

                {/* WhatsApp Group Join Button */}
                {event.whatsappLink && (
                  <a
                    href={event.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-500 font-semibold hover:bg-green-500/20 transition-all"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Join WhatsApp Group
                  </a>
                )}
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
              <div className="min-h-[200px] relative">
                <AnimatePresence mode="wait">
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
                          const isDebater1 =
                            debate.debater1Id === currentUser?.id;
                          const opponent = isDebater1
                            ? debate.debater2
                            : debate.debater1;

                          return (
                            <motion.div
                              key={debate.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={cn(
                                "bg-card border rounded-xl p-4 transition-all",
                                debate.status === "COMPLETED" && debate.resultsPublished && debate.isPromoted
                                  ? "border-green-500/30 shadow-lg shadow-green-500/5 transition-all"
                                  : debate.status === "COMPLETED" && debate.resultsPublished && !debate.isPromoted
                                    ? "border-red-500/30 opacity-80"
                                    : debate.status === "COMPLETED" && !debate.resultsPublished
                                      ? "border-amber-500/20 bg-amber-500/5 animate-pulse"
                                      : "border-border"
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {round?.name || `Round ${round?.roundNumber || "?"}`}
                                  </span>
                                </div>
                                {debate.status === "COMPLETED" && debate.resultsPublished ? (
                                  <div
                                    className={cn(
                                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                                      debate.isPromoted
                                        ? "bg-green-500/10 text-green-500"
                                        : "bg-red-500/10 text-red-500"
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
                                ) : debate.status === "COMPLETED" ? (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    AWAITING SELECTION
                                  </div>
                                ) : (
                                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
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
                              </div>
                            </motion.div>
                          );
                        })
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
