import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
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
  XCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import {EventApi, DebateApi, UserApi} from "../../services/api";
import {useToast} from "../../hooks/useToast"
import { cn } from "../../lib/utils";
import { useEventSocket } from "../../hooks/useSocket";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { EventDetailsSkeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

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
  const [currentUser, setCurrentUser] = useState(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Admin check
  useEffect(() => {
    const checkAdmin = async () => {
      const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const API_BASE_URL = isLocalhost ? import.meta.env.VITE_API_URL || "http://localhost:3000/api" : "/api";
      try {
        const token = await getTokenRef.current();
        await fetch(`${API_BASE_URL}/admin/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // An unavailable admin check does not block participant event access.
      }
    };
    checkAdmin();
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

    } catch (err) {
      console.error("Failed to fetch event details", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header / Breadcrumb */}
      <div>
        <Link
          to="/dashboard/events"
          className="inline-flex items-center text-xs font-sans text-muted-foreground hover:text-primary mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournaments
        </Link>

        <div className="rounded-xl bg-card border border-border p-6 md:p-8 relative">
          <div className="axiom-page-header relative z-10">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs font-heading font-semibold uppercase tracking-wider border",
                  event.status === "ONGOING"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : event.status === "UPCOMING"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      : "bg-muted text-muted-foreground border-border"
                )}
              >
                {event.status}
              </span>
              <span className="flex items-center text-muted-foreground font-sans text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1 text-primary" aria-hidden="true" />
                {new Date(event.startDate).toLocaleDateString()}
                {event.endDate &&
                  ` - ${new Date(event.endDate).toLocaleDateString()}`}
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
              <div>
                <h1 className="text-2xl md:text-4xl font-heading font-bold text-foreground mb-2">
                  {event.name}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground font-sans max-w-2xl leading-relaxed">
                  {event.description || "No description available"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 flex-shrink-0">
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolled || enrolling}
                  className={cn(
                    "px-5 py-2.5 rounded-lg font-heading font-semibold text-xs transition-colors min-w-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isEnrolled
                      ? "bg-emerald-600 text-white cursor-default"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {isEnrolled ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      Enrolled
                    </span>
                  ) : enrolling ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
                    className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg font-heading font-semibold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors min-w-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    Join WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 md:gap-6 border-b border-border overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0">
        {["overview", "rounds", "participants", "results"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "relative pb-3 text-sm font-sans font-medium capitalize transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
              activeTab === tab
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
            {activeTab === tab && (
              <Motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{type: "tween", duration: 0.24, ease: "easeOut"}}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] relative">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <Motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid md:grid-cols-3 gap-6"
            >
              <div className="md:col-span-2 space-y-6">
                <section className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-base font-heading font-bold text-foreground mb-3">About the Event</h3>
                  <p className="text-muted-foreground font-sans text-sm leading-relaxed">
                    {event.description ||
                      "This debate competition features multiple rounds of competitive debating. Check back for more details about format and rules."}
                  </p>
                </section>
                <section className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-base font-heading font-bold text-foreground mb-3">
                    Schedule ({rounds.length} Rounds)
                  </h3>
                  {rounds.length === 0 ? (
                    <p className="text-muted-foreground font-sans text-sm">
                      No rounds have been scheduled yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {rounds.map((round) => (
                        <div
                          key={round.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-muted/20 border border-border/50 gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center border border-border shrink-0">
                              <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="font-heading font-semibold text-sm text-foreground">
                                {round.name || `Round ${round.roundNumber}`}
                              </p>
                              <p className="text-xs text-muted-foreground font-sans">
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
                                    <span className="text-[10px] font-heading font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                      PENDING
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={cn(
                                      "text-[10px] font-heading font-semibold px-2 py-0.5 rounded border whitespace-nowrap",
                                      debate.isPromoted
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                        : "bg-destructive/10 text-destructive border-destructive/20"
                                    )}
                                  >
                                    {debate.isPromoted ? "QUALIFIED" : "ELIMINATED"}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {round.pairingsPublished && (
                              <span className="text-[10px] font-heading font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                Draw Out
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[10px] font-heading font-semibold px-2 py-0.5 rounded border uppercase tracking-wider",
                                round.status === "COMPLETED"
                                  ? "bg-muted text-muted-foreground border-border"
                                  : round.status === "ONGOING"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-primary/10 text-primary border border-primary/20"
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
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-heading font-bold text-base mb-2 text-foreground">Event Status</h3>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span className="font-heading font-semibold text-sm">{event.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    {rounds.length} rounds scheduled
                  </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-heading font-bold text-base mb-3 text-foreground">Event Information</h3>
                  <div className="space-y-2.5 text-xs font-sans">
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-medium text-foreground">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    {event.endDate && (
                      <div className="flex justify-between border-b border-border/40 pb-2">
                        <span className="text-muted-foreground">End Date</span>
                        <span className="font-medium text-foreground">
                          {new Date(event.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Rounds
                      </span>
                      <span className="font-medium text-foreground">{rounds.length}</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Group Join Button */}
                {event.whatsappLink && (
                  <a
                    href={event.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-heading font-semibold text-xs hover:bg-emerald-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    Join WhatsApp Group
                  </a>
                )}
              </div>
            </Motion.div>
          )}

          {activeTab === "rounds" && (
            <Motion.div
              key="rounds"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {rounds.length === 0 ? (
                <EmptyState compact icon={Clock} title="No rounds scheduled" description="The schedule appears here once rounds are created." />
              ) : (
                rounds.map((round) => (
                  <Link
                    key={round.id}
                    to={`/dashboard/events/${id}/rounds/${round.id}`}
                    className="block p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-heading font-bold text-foreground group-hover:text-primary transition-colors">
                          {round.name || `Round ${round.roundNumber}`}
                        </h3>
                        <p className="text-muted-foreground text-xs font-sans mt-0.5">
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
                            "text-[10px] font-heading font-semibold px-2 py-0.5 rounded border uppercase tracking-wider",
                            round.status === "COMPLETED"
                              ? "bg-muted text-muted-foreground border-border"
                              : round.status === "ONGOING"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-primary/10 text-primary border border-primary/20"
                          )}
                        >
                          {round.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                      </div>
                    </div>
                    {round.motion && round.pairingsPublished && (
                      <div className="p-3.5 rounded-lg bg-muted/20 border border-border/60">
                        <span className="text-[10px] font-heading font-semibold text-primary uppercase tracking-wider">
                          Motion
                        </span>
                        <p className="text-sm font-sans font-medium text-foreground mt-0.5">
                          {round.motion}
                        </p>
                      </div>
                    )}
                    {!round.pairingsPublished &&
                      round.status !== "UPCOMING" && (
                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-sans font-medium">
                            Waiting for draws to be published...
                          </p>
                        </div>
                      )}
                  </Link>
                ))
              )}
            </Motion.div>
          )}

          {activeTab === "participants" && (
            <Motion.div
              key="participants"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Search Bar */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by name or college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm font-sans focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              {/* Participants List */}
              <div className="space-y-2.5">
                {participants.filter((p) => {
                  const fullName = `${p.firstName || ""} ${p.lastName || ""
                    }`.toLowerCase();
                  const college = (p.college || "").toLowerCase();
                  const query = searchQuery.toLowerCase();
                  return fullName.includes(query) || college.includes(query);
                }).length === 0 ? (
                  <EmptyState
                    compact
                    icon={School}
                    title={searchQuery ? "No match" : "No debaters yet"}
                    description={searchQuery ? "No participants found matching your search." : "No participants registered yet."}
                  />
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
                      <Motion.div
                        key={participant.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Avatar */}
                          <UserAvatar user={participant} size="md" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-heading font-semibold text-sm text-foreground truncate">
                                {participant.firstName} {participant.lastName}
                              </p>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans mt-0.5">
                              <School className="w-3.5 h-3.5" aria-hidden="true" />
                              <span className="truncate">
                                {participant.college || "No college specified"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Motion.div>
                    ))
                )}
              </div>
            </Motion.div>
          )}

          {activeTab === "results" && (
            <Motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="min-h-[200px] relative">
                <AnimatePresence mode="wait">
                  <Motion.div
                    key="my-results"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {myDebates.filter((d) =>
                      rounds.map((r) => r.id).includes(d.roundId)
                    ).length === 0 ? (
                      <div className="text-center py-12 bg-card border border-border rounded-xl">
                        <Trophy className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" aria-hidden="true" />
                        <p className="text-muted-foreground font-sans text-sm">
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
                            <Motion.div
                              key={debate.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={cn(
                                "bg-card border rounded-xl p-4 transition-colors",
                                debate.status === "COMPLETED" && round?.resultsPublished && debate.isPromoted
                                  ? "border-emerald-500/30"
                                  : debate.status === "COMPLETED" && round?.resultsPublished && !debate.isPromoted
                                    ? "border-destructive/30 opacity-80"
                                    : debate.status === "COMPLETED" && !round?.resultsPublished
                                      ? "border-amber-500/20 bg-amber-500/5 animate-pulse"
                                      : "border-border"
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-heading font-semibold text-foreground">
                                  {round?.name || `Round ${round?.roundNumber || "?"}`}
                                </span>
                                {debate.status === "COMPLETED" && round?.resultsPublished ? (
                                  <div
                                    className={cn(
                                      "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-heading font-semibold border uppercase tracking-wider",
                                      debate.isPromoted
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                        : "bg-destructive/10 text-destructive border-destructive/20"
                                    )}
                                  >
                                    {debate.isPromoted ? (
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
                                  </div>
                                ) : debate.status === "COMPLETED" && !round?.resultsPublished ? (
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-heading font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                                    <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                                    AWAITING SELECTION
                                  </div>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-heading font-semibold uppercase tracking-wider border border-border">
                                    {debate.status}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <UserAvatar user={opponent} size="md" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-heading font-semibold text-sm text-foreground truncate">
                                    vs {opponent?.firstName}{" "}
                                    {opponent?.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-sans truncate">
                                    {opponent?.college || "No college specified"}
                                  </p>
                                </div>
                              </div>
                            </Motion.div>
                          );
                        })
                    )}
                  </Motion.div>
                </AnimatePresence>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
