import ModalSurface from "../../components/ui/ModalSurface";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import {
  Clock,
  Plus,
  ChevronRight,
  Settings,
  Users,
  Activity,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Info,
  MessageCircle,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi } from "../../services/api";
import {serializeEventDates, toLocalDateTime} from "../../lib/datetime";
import { useEventSocket } from "../../hooks/useSocket";

export default function AdminEventDetails() {
  const { id: eventId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [activeTab, setActiveTab] = useState("rounds");
  const [deletingRoundId, setDeletingRoundId] = useState(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchData = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const results = await Promise.allSettled([
        EventApi.getById(eventId, token),
        AdminApi.apiRequest(`/rounds/event/${eventId}`, "GET", null, token),
        AdminApi.apiRequest(`/stats/event/${eventId}`, "GET", null, token),
        EventApi.getParticipants(eventId, token),
      ]);

      const [eventRes, roundsRes, statsRes, participantsRes] = results;

      if (eventRes.status === "fulfilled" && eventRes.value.success) {
        setEvent(eventRes.value.event);
      } else {
        console.error("Event fetch failed:", eventRes);
      }

      if (roundsRes.status === "fulfilled" && roundsRes.value.success) {
        setRounds(roundsRes.value.rounds || []);
      }

      if (statsRes.status === "fulfilled" && statsRes.value.success) {
        setStats(statsRes.value.data);
      }

      if (
        participantsRes.status === "fulfilled" &&
        participantsRes.value.success
      ) {
        setParticipants(participantsRes.value.participants || []);
      }
    } catch (error) {
      console.error("Failed to fetch event data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]); // stable - getToken via ref

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates
  useEventSocket(eventId, {
    onEventUpdated: () => fetchData(),
    onRoundCreated: () => fetchData(),
    onRoundUpdated: () => fetchData(),
    onRoundDeleted: () => fetchData(),
    onEventEnrollment: () => fetchData(),
    onRoundStatusChange: () => fetchData(),
    onPairingsPublished: () => fetchData(),
  });

  const handleDeleteRound = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this round? All pairings and results will be lost."
      )
    )
      return;
    try {
      setDeletingRoundId(id);
      const token = await getToken();
      const response = await AdminApi.deleteRound(id, token);
      if (response.success) {
        fetchData();
      } else {
        alert(response.error || "Failed to delete round");
      }
    } catch {
      alert("Error deleting round");
    } finally {
      setDeletingRoundId(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = await getToken();
      const response = await AdminApi.apiRequest("/users?limit=1000", "GET", null, token);
      if (response.success) {
        // Filter out users already enrolled
        const enrolledIds = new Set(participants.map((p) => p.id));
        setAllUsers(response.users.filter((u) => !enrolledIds.has(u.id)));
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const handleManualEnroll = async (userId) => {
    try {
      const token = await getToken();
      const response = await EventApi.enrollUserManual(eventId, userId, token);
      if (response.success) {
        fetchData(); // Refresh participants
        setShowAddParticipant(false);
      } else {
        alert(response.error || "Failed to enroll user");
      }
    } catch {
      alert("Error enrolling user");
    }
  };

  useEffect(() => {
    if (showAddParticipant) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddParticipant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading event details" />
      </div>
    );
  }

  if (!event) return <div className="text-center py-20 font-sans text-muted-foreground">Event not found</div>;

  const statsCards = [
    {
      label: "Check-ins",
      value: stats?.checkIns?.present || 0,
      total: stats?.checkIns?.total,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "Rounds",
      value: rounds.length,
      icon: Activity,
      color: "text-primary",
    },
    {
      label: "Debates",
      value: stats?.debates?.completed || 0,
      total: stats?.debates?.total,
      icon: CheckCircle2,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <button
            onClick={() => navigate("/admin/events")}
            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors shrink-0 mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to tournaments list"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
                Tournament
              </span>
              <span className="text-muted-foreground/60">•</span>
              <span
                className={`text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                  event.status === "ONGOING"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : event.status === "UPCOMING"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {event.status}
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-heading font-bold text-foreground break-words mt-1">
              {event.name}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-sans break-words line-clamp-2 md:line-clamp-none max-w-2xl">
              {event.description || "No description provided"}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 w-full md:w-auto shrink-0">
          <button
            onClick={() => setShowEditEvent(true)}
            className="p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Edit Tournament Settings"
            aria-label="Edit tournament settings"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => setShowCreateRound(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Round {rounds.length + 1}</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {statsCards.map((card, i) => (
          <Motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card/70 border border-border/70 rounded-xl p-5 flex items-center justify-between backdrop-blur-sm"
          >
            <div>
              <p className="text-xs text-muted-foreground font-sans font-medium mb-1">
                {card.label}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground">
                {card.value}
                {card.total ? (
                  <span className="text-sm text-muted-foreground font-sans font-normal">
                    {" "}
                    / {card.total}
                  </span>
                ) : (
                  ""
                )}
              </h3>
            </div>
            <card.icon className={`w-7 h-7 ${card.color} opacity-30`} aria-hidden="true" />
          </Motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-6 border-b border-border/70 mb-6" role="group" aria-label="Tournament view">
        <button
          type="button"
          aria-pressed={activeTab === "rounds"}
          onClick={() => setActiveTab("rounds")}
          className={cn(
            "relative pb-3 text-sm font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "rounds"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tournament Rounds
          {activeTab === "rounds" && (
            <Motion.div
              layoutId="activeAdminTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "tween", duration: .24, ease: "easeOut" }}
            />
          )}
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "participants"}
          onClick={() => setActiveTab("participants")}
          className={cn(
            "relative pb-3 text-sm font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
            activeTab === "participants"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Participants ({participants.length})
          {activeTab === "participants" && (
            <Motion.div
              layoutId="activeAdminTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "tween", duration: .24, ease: "easeOut" }}
            />
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-4 relative overflow-hidden min-h-[350px]">
          <AnimatePresence mode="wait">
            {activeTab === "rounds" ? (
              <Motion.div
                key="rounds"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-heading font-bold text-foreground">Round Sequence</h2>
                </div>

                {rounds.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-border/80 rounded-xl bg-card/40">
                    <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" aria-hidden="true" />
                    <h3 className="font-heading font-bold text-base text-foreground mb-1">No Rounds Configured</h3>
                    <p className="text-xs text-muted-foreground mb-5 font-sans">
                      Start your tournament by creating the first preliminary round.
                    </p>
                    <button
                      onClick={() => setShowCreateRound(true)}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Create Round 1
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rounds.map((round) => (
                      <Link
                        key={round.id}
                        to={`/admin/rounds/${round.id}`}
                        className="block group bg-card/70 border border-border/70 rounded-xl p-4 hover:border-primary/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center font-heading font-bold text-primary shrink-0 text-sm">
                              {round.roundNumber}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-heading font-semibold text-sm break-words pr-2 text-foreground group-hover:text-primary transition-colors">
                                {round.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground font-sans mt-0.5">
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  {new Date(round.checkInStartTime).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Kolkata",
                                  })}{" "}
                                  IST
                                </span>
                                <span>•</span>
                                <span
                                  className={`capitalize font-medium ${
                                    round.status === "ONGOING"
                                      ? "text-emerald-500"
                                      : round.status === "COMPLETED"
                                      ? "text-blue-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {round.status?.toLowerCase()}
                                </span>
                                {round.pairingsPublished && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                      Draw Public
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingRound(round);
                              }}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground opacity-100 md:opacity-0 group-hover:opacity-100 transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Edit round ${round.name}`}
                              title="Edit Round"
                            >
                              <Settings className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteRound(round.id);
                              }}
                              disabled={deletingRoundId === round.id}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Delete round ${round.name}`}
                              title="Delete Round"
                            >
                              {deletingRoundId === round.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <X className="w-4 h-4" aria-hidden="true" />
                              )}
                            </button>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                          </div>
                        </div>
                        {round.motion && (
                          <div className="mt-3 p-2.5 rounded-lg bg-muted/40 text-xs italic text-muted-foreground border-l-2 border-primary/50 font-serif">
                            "{round.motion}"
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </Motion.div>
            ) : (
              <Motion.div
                key="participants"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-heading font-bold text-foreground">Enrolled Debaters</h2>
                  <button
                    onClick={() => setShowAddParticipant(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-sans font-medium hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add Participant</span>
                  </button>
                </div>

                {participants.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-border/80 rounded-xl bg-card/40">
                    <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" aria-hidden="true" />
                    <h3 className="font-heading font-bold text-base text-foreground mb-1">No Participants Registered</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      Enroll registered debaters manually or share tournament registration links.
                    </p>
                  </div>
                ) : (
                  <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left" aria-label="Enrolled participants">
                        <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                          <tr>
                            <th scope="col" className="px-4 py-3">Debater</th>
                            <th scope="col" className="px-4 py-3">Institution</th>
                            <th scope="col" className="px-4 py-3">Email</th>
                            <th scope="col" className="px-4 py-3 hidden lg:table-cell">Enrolled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {participants.map((p) => (
                            <tr
                              key={p.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                                    {p.firstName?.[0]}
                                    {p.lastName?.[0]}
                                  </div>
                                  <span className="font-sans font-medium text-sm text-foreground">
                                    {p.firstName} {p.lastName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground font-sans">
                                {p.college || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground font-sans">
                                {p.email}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground font-sans lg:table-cell hidden">
                                {p.createdAt
                                  ? new Date(p.createdAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-card/70 border border-border/70 rounded-xl p-5 backdrop-blur-sm">
            <h3 className="font-heading font-bold text-sm text-foreground flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" aria-hidden="true" />
              Tournament Logistics
            </h3>
            <div className="space-y-3 font-sans text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                  Start Date
                </p>
                <p className="text-foreground font-medium">
                  {new Date(event.startDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(event.startDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                  End Date
                </p>
                <p className="text-foreground font-medium">
                  {new Date(event.endDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(event.endDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <hr className="border-border/60" />
              <div className="pt-1">
                <Link
                  to={`/dashboard/events/${eventId}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <span>Public tournament page</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-card/70 border border-border/70 rounded-xl p-5 backdrop-blur-sm">
            <h3 className="font-heading font-semibold text-xs uppercase tracking-wider text-emerald-500 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" /> Admin Notice
            </h3>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Generating pairings for a round will automatically close the check-in window and mark absent users as eliminated for single-elimination formats.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Components */}
      {showCreateRound && (
        <CreateRoundModal
          eventId={eventId}
          roundNumber={rounds.length + 1}
          onClose={() => setShowCreateRound(false)}
          onCreated={() => {
            setShowCreateRound(false);
            fetchData();
          }}
        />
      )}

      {showEditEvent && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onUpdated={() => {
            setShowEditEvent(false);
            fetchData();
          }}
        />
      )}

      {editingRound && (
        <EditRoundModal
          round={editingRound}
          onClose={() => setEditingRound(null)}
          onUpdated={() => {
            setEditingRound(null);
            fetchData();
          }}
        />
      )}

      {showAddParticipant && (
        <ModalSurface onDismiss={() => setShowAddParticipant(false)}
          aria-label="Add Participant"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-lg flex flex-col max-h-[80vh] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground">Add Debater to Tournament</h2>
                <p className="text-xs text-muted-foreground font-sans">Select from registered platform accounts</p>
              </div>
              <button
                onClick={() => setShowAddParticipant(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search registered debaters..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-sans rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {allUsers
                .filter((u) => {
                  const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
                  const query = userSearchQuery.toLowerCase();
                  return name.includes(query) || (u.email || "").toLowerCase().includes(query);
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleManualEnroll(u.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/70 hover:bg-muted/50 transition-all group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                        {u.firstName?.[0]}
                        {u.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-heading font-semibold text-foreground truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-sans truncate">{u.email}</p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" aria-hidden="true" />
                  </button>
                ))}
              {allUsers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs italic font-sans">
                  No additional registered users found to enroll.
                </div>
              )}
            </div>
          </Motion.div>
        </ModalSurface>
      )}
    </div>
  );
}

function CreateRoundModal({ eventId, roundNumber, onClose, onCreated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);


  const toISTDateTimeString = (date) => {
    return date
      .toLocaleString("sv-SE", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(" ", "T");
  };

  const [formData, setFormData] = useState({
    eventId,
    roundNumber,
    name: `Preliminary Round ${roundNumber}`,
    motion: "",
    checkInStartTime: toISTDateTimeString(new Date()),
    checkInEndTime: toISTDateTimeString(new Date(Date.now() + 3600000)),
    status: "UPCOMING",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const toISTISOString = (dateTimeLocal) => {
        if (!dateTimeLocal) return null;
        return new Date(dateTimeLocal + ":00+05:30").toISOString();
      };

      const submitData = {
        ...formData,
        checkInStartTime: toISTISOString(formData.checkInStartTime),
        checkInEndTime: toISTISOString(formData.checkInEndTime),
      };

      const response = await AdminApi.createRound(submitData, token);
      if (response.success) {
        onCreated();
      } else {
        alert(response.error || "Failed to create round");
      }
    } catch {
      alert("Error creating round");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSurface onDismiss={onClose} aria-label={`Create Round ${roundNumber}`}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Create Round {roundNumber}</h2>
          <p className="text-xs text-muted-foreground font-sans">Set check-in timeline and debate motion</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="md:col-span-2"><span className="text-xs font-semibold mb-1 block text-foreground">Round Name</span><input type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
          <label className="md:col-span-2"><span className="text-xs font-semibold mb-1 block text-foreground">
            Debate Motion (Optional)
          </span><textarea value={formData.motion}
          onChange={(e) => setFormData({ ...formData, motion: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
          rows={3}
          placeholder="This house believes that..." /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in Start (IST)</span><input type="datetime-local"
          required
          value={formData.checkInStartTime}
          onChange={(e) =>
            setFormData({ ...formData, checkInStartTime: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in End (IST)</span><input type="datetime-local"
          required
          value={formData.checkInEndTime}
          onChange={(e) =>
            setFormData({ ...formData, checkInEndTime: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>
        <div className="flex gap-2.5 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
          >
            {loading ? "Creating..." : "Create Round"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}

function EditEventModal({ event, onClose, onUpdated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);


  const [formData, setFormData] = useState({
    name: event.name || "",
    description: event.description || "",
    startDate: event.startDate
      ? toLocalDateTime(event.startDate)
      : "",
    endDate: event.endDate
      ? toLocalDateTime(event.endDate)
      : "",
    status: event.status || "UPCOMING",
    whatsappLink: event.whatsappLink || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const response = await AdminApi.updateEvent(event.id, serializeEventDates(formData, event), token);
      if (response.success) {
        onUpdated();
      } else {
        alert(response.error || "Failed to update event");
      }
    } catch {
      alert("Error updating event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSurface onDismiss={onClose} aria-label="Edit Tournament Settings"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Edit Tournament Settings</h2>
          <p className="text-xs text-muted-foreground font-sans">Modify parameters and status</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Tournament Name</span><input type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Description</span><textarea value={formData.description}
        onChange={(e) =>
          setFormData({ ...formData, description: e.target.value })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
        rows={3} /></label>
    
        <div className="grid md:grid-cols-2 gap-3">
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Start Date (local time)</span><input type="datetime-local"
          required
          value={formData.startDate}
          onChange={(e) =>
            setFormData({ ...formData, startDate: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">End Date (local time)</span><input type="datetime-local"
          required
          value={formData.endDate}
          onChange={(e) =>
            setFormData({ ...formData, endDate: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Status</span><select value={formData.status}
        onChange={(e) =>
          setFormData({ ...formData, status: e.target.value })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"><option value="UPCOMING">Upcoming</option>
        <option value="ONGOING">Ongoing</option>
        <option value="COMPLETED">Completed</option></select></label>
    
        <label ><span className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
        WhatsApp Group Link
        <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span></span><input type="url"
        value={formData.whatsappLink}
        onChange={(e) =>
          setFormData({
            ...formData,
            whatsappLink: e.target.value,
          })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
        placeholder="https://chat.whatsapp.com/..." /></label>
    
        <div className="flex gap-2.5 pt-4 border-t border-border/60 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}

function EditRoundModal({ round, onClose, onUpdated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);


  const toISTDateTimeString = (utcDate) => {
    if (!utcDate) return "";
    const date = new Date(utcDate);
    return date
      .toLocaleString("sv-SE", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(" ", "T");
  };

  const [formData, setFormData] = useState({
    name: round.name || "",
    motion: round.motion || "",
    checkInStartTime: toISTDateTimeString(round.checkInStartTime),
    checkInEndTime: toISTDateTimeString(round.checkInEndTime),
    status: round.status || "UPCOMING",
    pairingsPublished: round.pairingsPublished || false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const toISTISOString = (dateTimeLocal) => {
        if (!dateTimeLocal) return null;
        return new Date(dateTimeLocal + ":00+05:30").toISOString();
      };

      const submitData = {
        ...formData,
        checkInStartTime: toISTISOString(formData.checkInStartTime),
        checkInEndTime: toISTISOString(formData.checkInEndTime),
      };

      const response = await AdminApi.updateRound(round.id, submitData, token);
      if (response.success) {
        onUpdated();
      } else {
        alert(response.error || "Failed to update round");
      }
    } catch {
      alert("Error updating round");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSurface onDismiss={onClose} aria-label="Edit Round"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Edit Round Parameters</h2>
          <p className="text-xs text-muted-foreground font-sans">Update schedule, motion, and draw visibility</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Round Name</span><input type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Debate Motion</span><textarea value={formData.motion}
        onChange={(e) => setFormData({ ...formData, motion: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
        rows={3} /></label>
    
        <div className="grid md:grid-cols-2 gap-3">
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in Start (IST)</span><input type="datetime-local"
          required
          value={formData.checkInStartTime}
          onChange={(e) =>
            setFormData({ ...formData, checkInStartTime: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in End (IST)</span><input type="datetime-local"
          required
          value={formData.checkInEndTime}
          onChange={(e) =>
            setFormData({ ...formData, checkInEndTime: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Status</span><select value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"><option value="UPCOMING">Upcoming</option>
        <option value="ONGOING">Ongoing</option>
        <option value="COMPLETED">Completed</option></select></label>
    
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-muted/40 border border-border/70">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            id="pairingsPublished"
            checked={formData.pairingsPublished}
            onChange={(e) =>
              setFormData({ ...formData, pairingsPublished: e.target.checked })
            }
          />
          <label htmlFor="pairingsPublished" className="text-xs font-medium cursor-pointer text-foreground">
            Publish Draw (Makes matchups and room allocations visible to debaters)
          </label>
        </div>
    
        <div className="flex gap-2.5 pt-4 border-t border-border/60 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}
