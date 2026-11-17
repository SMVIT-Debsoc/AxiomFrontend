import DashboardLink from "../../components/dashboard/DashboardLink";
import SectionRetry from "../../components/ui/SectionRetry";
import { lazy, Suspense, useState, useRef } from "react";
import {useParams} from "react-router-dom";
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
  XCircle,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "../../auth/client.jsx";
import {EventApi, DebateApi, UserApi} from "../../services/api";
import {useToast} from "../../hooks/useToast"
import { cn } from "../../lib/utils";
import { useEventSocket, useLiveRefresh } from "../../hooks/useSocket";
import {usePageRequests} from "../../hooks/usePageRequests";
import { socketService } from "../../services/socket";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { EventDetailsSkeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";

const WhatsAppFirstLoginModal = lazy(() =>
  import("../../components/dashboard/WhatsAppGroupPrompt").then((m) => ({
    default: m.WhatsAppFirstLoginModal,
  }))
);

const OVERVIEW_FIELDS = ["overview", "enrollment", "personal"];

export default function EventDetails() {
  const {id} = useParams();
  return <EventOverview key={id} id={id} />;
}

function EventOverview({id}) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentLoading, setEnrollmentLoading] = useState(true);
  const [enrollmentFailed, setEnrollmentFailed] = useState(false);

  const [participantCount, setParticipantCount] = useState(null);
  const [myDebates, setMyDebates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalFailed, setPersonalFailed] = useState(false);
  const eventDebates = myDebates.filter((debate) => rounds.some((round) => round.id === debate.roundId));

  const deleted = useRef(false);
  const enrollmentVersion = useRef(0);
  const refresh = usePageRequests(OVERVIEW_FIELDS, async (field, token, options, isCurrent) => {
    const canUpdate = () => isCurrent() && !deleted.current;
    const version = enrollmentVersion.current;
    try {
      if (field === "overview") {
        const response = await EventApi.getOverview(id, token, options);
        if (!canUpdate()) return;
        if (!response?.event) {
          setError("Event not found");
          return;
        }
        setEvent(response.event);
        setRounds(response.event.rounds || []);
        setError(null);
        setLoading(false);

        const count = response.event._count?.participants;
        if (Number.isInteger(count)) {
          setParticipantCount(count);
        } else {
          // Older API deployments may omit the count.
          const roster = await EventApi.getParticipants(id, token, options).catch(() => null);
          if (canUpdate() && roster?.success) {
            setParticipantCount(roster.total ?? roster.participants?.length ?? 0);
          }
        }
      } else if (field === "enrollment") {
        const response = await EventApi.getEnrollmentStatus(id, token, options);
        if (canUpdate() && version === enrollmentVersion.current && response?.success) {
          setIsEnrolled(response.isEnrolled);
          setEnrollmentFailed(false);
        }
      } else if (field === "personal") {
        const [profile, debates] = await Promise.allSettled([
          UserApi.getProfile(token, {...options, skipCache: false}),
          DebateApi.getMyDebates(token, options, id),
        ]);
        if (!canUpdate()) return;
        setPersonalFailed(debates.status === "rejected");
        if (profile.status === "fulfilled" && profile.value?.success) setCurrentUser(profile.value.user);
        if (debates.status === "fulfilled" && debates.value?.success) setMyDebates(debates.value.debates || []);
      }
    } catch (error) {
      if (canUpdate() && field === "overview" && !options.skipCache) setError(error.message);
      if (canUpdate() && field === "enrollment" && version === enrollmentVersion.current) setEnrollmentFailed(true);
    } finally {
      if (canUpdate()) {
        if (field === "overview") setLoading(false);
        if (field === "enrollment") setEnrollmentLoading(false);
        if (field === "personal") setPersonalLoading(false);
      }
    }
  }, "overview");

  useLiveRefresh(() => refresh(...OVERVIEW_FIELDS), {
    enabled: Boolean(id), eventId: id, jitterMs: 3000, invalidateCache: false,
  });

  // Real-time updates via WebSocket
  useEventSocket(id, {
    onRoundCreated: (data) => {
      console.log("[Socket] Round created:", data);
      toast.info("New Round!", "A new round has been added to this event.");
      refresh("overview");
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
    onRoundCheckInWindow: (data) => {
      if (data?.roundId) {
        setRounds((prev) =>
          prev.map((r) =>
            r.id === data.roundId
              ? {
                  ...r,
                  checkInStartTime: data.checkInStartTime,
                  checkInEndTime: data.checkInEndTime,
                }
              : r
          )
        );
      }
      toast.info("Check-in Window Updated", "Round check-in hours were updated.");
      refresh("overview");
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
      refresh("overview", "personal");
    },
    onDebateResult: (data) => {
      console.log("[Socket] Debate result:", data);

      // Update status optimistically without storing unreleased scores or winner IDs
      setMyDebates((prev) =>
        prev.map((d) =>
          d.id === data.debateId ? { ...d, status: "COMPLETED" } : d
        )
      );

      toast.info("Result Submitted", "A debate result has been submitted.");
      // The overview only needs a fresh result when this participant was involved.
      if (myDebates.some((debate) => debate.id === data.debateId)) refresh("personal");
    },
    onResultsPublished: (data) => {
      if (data?.published) {
        toast.success("Results Published!", "Round results and standings are now visible.");
      }
      refresh("overview", "personal");
    },
    onEventUpdated: (data) => {
      console.log("[Socket] Event updated:", data);
      if (data.event) {
        setEvent((prev) => ({ ...prev, ...data.event }));
        toast.info("Event Updated", "Event details have been modified.");
      } else {
        refresh("overview");
      }
    },
    onEventDeleted: () => {
      deleted.current = true;
      setLoading(false);
      toast.error("Event Deleted", "This event has been cancelled or removed.");
      // Redirect to dashboard logic could be added here, but for now just show toast/error state
      setError("Event has been deleted.");
    },
  });

  const handleEnroll = async () => {
    if (enrollmentLoading) return;
    try {
      setEnrolling(true);
      const token = await getToken();
      const enrollment = await EventApi.enroll(id, token);
      if (!enrollment?.success) throw new Error(enrollment?.error || "Enrollment could not be confirmed.");
      toast.success(
        "Enrolled Successfully!",
        "You have been registered for this event."
      );
      enrollmentVersion.current += 1;
      setIsEnrolled(true);
      setEnrollmentFailed(false);
      socketService.retryRoom("event", id, true);
      refresh("overview", "enrollment");
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
        <DashboardLink
          to="/dashboard/events"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
        </DashboardLink>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <Suspense fallback={null}>
        <WhatsAppFirstLoginModal event={event} />
      </Suspense>
      {/* Header / Breadcrumb */}
      <div>
        <DashboardLink
          to="/dashboard/events"
          className="inline-flex items-center text-xs font-sans text-muted-foreground hover:text-primary mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournaments
        </DashboardLink>

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
                  data-tour-anchor="enrollment"
                  data-tour-state={isEnrolled ? "enrolled" : undefined}
                  disabled={isEnrolled || enrolling || enrollmentLoading}
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
                    enrollmentLoading ? "Checking enrollment…" : "Enroll Now"
                  )}
                </button>
                {enrollmentFailed && (
                  <SectionRetry message="Could not verify enrollment." busy={enrollmentLoading} onRetry={() => {
                    setEnrollmentLoading(true);
                    refresh("enrollment");
                  }} />
                )}
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
      <div className="no-scrollbar flex items-center gap-4 md:gap-6 border-b border-border overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0">
        {["overview", "rounds", "results"].map((tab) => (
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
                                const published = Boolean(
                                  debate.resultsPublished || round.resultsPublished
                                );
                                if (!published) {
                                  return (
                                    <span className="ax-chip ax-chip--warn font-heading uppercase whitespace-nowrap">
                                      PENDING
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={cn(
                                      "ax-chip font-heading uppercase whitespace-nowrap",
                                      debate.isPromoted
                                        ? "ax-chip--win"
                                        : "ax-chip--loss"
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
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">
                        Total Rounds
                      </span>
                      <span className="font-medium text-foreground">{rounds.length}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-2">
                      <span className="text-muted-foreground">
                        Registered Debaters
                      </span>
                      <span className="font-medium text-foreground">{participantCount ?? "…"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Your Status
                      </span>
                      <span className="font-medium text-foreground">
                        {isEnrolled ? "Enrolled" : enrollmentLoading ? "Checking…" : enrollmentFailed ? "Status unavailable" : "Not enrolled"}
                      </span>
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
                  <DashboardLink
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
                  </DashboardLink>
                ))
              )}
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
                    {personalFailed && (
                      <SectionRetry message="Could not refresh your results." busy={personalLoading} onRetry={() => {
                        setPersonalLoading(true);
                        refresh("personal");
                      }} />
                    )}
                    {personalLoading && !eventDebates.length ? (
                      <p role="status" className="py-12 text-center text-sm text-muted-foreground">
                        Loading your results…
                      </p>
                    ) : !eventDebates.length && personalFailed ? null : !eventDebates.length ? (
                      <div className="text-center py-12 bg-card border border-border rounded-xl">
                        <Trophy className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" aria-hidden="true" />
                        <p className="text-muted-foreground font-sans text-sm">
                          No debate results yet for this event.
                        </p>
                      </div>
                    ) : (
                      eventDebates.map((debate, index) => {
                          const round = rounds.find(
                            (r) => r.id === debate.roundId
                          );
                          const isDebater1 =
                            debate.debater1Id === currentUser?.id;
                          const side = isDebater1 ? "GOV" : "OPP";
                          const opponent = isDebater1
                            ? debate.debater2
                            : debate.debater1;
                          const published = Boolean(
                            debate.resultsPublished || round?.resultsPublished
                          );

                          return (
                            <Motion.div
                              key={debate.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={cn(
                                "rounded-xl p-4 transition-colors",
                                debate.status === "COMPLETED" && published && debate.isPromoted
                                  ? "ax-signal-win"
                                  : debate.status === "COMPLETED" && published && !debate.isPromoted
                                    ? "ax-signal-loss"
                                    : debate.status === "COMPLETED" && !published
                                      ? "ax-signal-warn"
                                      : "bg-card border border-border"
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-heading font-semibold">
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
                                      debate.isPromoted
                                        ? "ax-chip--win"
                                        : "ax-chip--loss"
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
                    <DashboardLink
                      to={`/dashboard/events/${id}/results`}
                      className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-primary hover:border-primary/40 transition-colors"
                    >
                      Open Full Results &amp; Standings
                    </DashboardLink>
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
