import {lazy, Suspense, useState, useEffect, useRef} from "react";
import {motion as Motion} from "framer-motion";
import {
  Trophy,
  Calendar,
  CheckCircle2,
  Loader2,
  XCircle,
  Swords,
  Lock,
  ArrowRight,
  Award,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import {useAuth, useUser} from "../../auth/client.jsx";
import {UserApi, EventApi, DebateApi, CheckInApi, clearApiCache} from "../../services/api";
import {Link} from "react-router-dom";
import {useToast} from "../../hooks/useToast";
import {DashboardHomeSkeleton} from "../../components/ui/Skeleton";
import {useEventSocket, useSocket, SocketEvents, useLiveRefresh, invalidateRealtimeCache} from "../../hooks/useSocket";
import Sculpture from "../../components/brand/Sculpture";
import {UserAvatar} from "../../components/ui/UserAvatar";
import EmptyState from "../../components/ui/EmptyState";
import CountUp from "../../components/ui/CountUp";
import NeoButton from "../../components/neo/NeoButton";
import {cn} from "../../lib/utils";

const WhatsAppGroupBanner = lazy(() =>
  import("../../components/dashboard/WhatsAppGroupPrompt").then((m) => ({
    default: m.WhatsAppGroupBanner,
  }))
);
const WhatsAppFirstLoginModal = lazy(() =>
  import("../../components/dashboard/WhatsAppGroupPrompt").then((m) => ({
    default: m.WhatsAppFirstLoginModal,
  }))
);

export default function DashboardHome() {
  const {getToken} = useAuth();
  const {user: authUser, isLoaded: authLoaded} = useUser();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [nextDebate, setNextDebate] = useState(null);
  const [latestCompletedDebate, setLatestCompletedDebate] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [mobileTab, setMobileTab] = useState("now"); // "now" | "rounds" | "results"

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchDashboardData = async ({ silent = false } = {}) => {
    if (!authLoaded) return;
    if (!silent) setLoading(true);

    try {
      const token = await getTokenRef.current();

      const [profileRes, eventsRes, debatesRes] = await Promise.all([
        UserApi.getProfile(token),
        EventApi.list(token),
        DebateApi.getMyDebates(token).catch(() => ({success: false, debates: []})),
      ]);

      if (profileRes?.user) {
        setUserData(profileRes.user);
      }

      const allEvents = eventsRes?.events || [];
      const event =
        allEvents.find((e) => e.status === "ONGOING") ||
        allEvents.find((e) => e.status === "UPCOMING") ||
        allEvents[0] ||
        null;

      if (event) {
        setActiveEvent(event);

        const targetRound =
          event.rounds?.find((r) => r.status === "ONGOING") ||
          event.rounds?.find((r) => r.status === "UPCOMING") ||
          (event.rounds?.length > 0 ? event.rounds[event.rounds.length - 1] : null);

        if (targetRound) {
          setCurrentRound(targetRound);
          try {
            const checkIn = await CheckInApi.getMyStatus(targetRound.id, token);
            setCheckInStatus(checkIn.checkIn);
          } catch {
            setCheckInStatus(null);
          }
        } else {
          setCurrentRound(null);
          setCheckInStatus(null);
        }
      } else {
        setActiveEvent(null);
        setCurrentRound(null);
        setCheckInStatus(null);
      }

      const debates = debatesRes?.debates || [];
      const scheduled = debates.find((d) => d.status === "SCHEDULED") || null;
      const completed = debates
        .filter((d) => d.status === "COMPLETED")
        .sort((a, b) => (b.round?.roundNumber || 0) - (a.round?.roundNumber || 0));

      setNextDebate(scheduled);
      setLatestCompletedDebate(completed[0] || null);
      setError(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded]);

  useLiveRefresh(() => fetchDashboardData({ silent: true }));

  useEventSocket(activeEvent?.id, {
    onRoundStatusChange: (data) => {
      toast.info("Update", `Round status updated to ${data.status}`);
      fetchDashboardData({ silent: true });
    },
    onPairingsPublished: (data) => {
      if (data.published) {
        toast.success("Draw Released!", "Pairings have been published.");
      }
      fetchDashboardData({ silent: true });
    },
    onRoundUpdated: () => fetchDashboardData({ silent: true }),
    onDebateCreated: () => fetchDashboardData({ silent: true }),
    onDebateResult: () => fetchDashboardData({ silent: true }),
    onResultsPublished: (data) => {
      if (data?.published) {
        toast.success("Results Published!", "Round results are now available.");
      }
      fetchDashboardData({ silent: true });
    },
  });

  useSocket(SocketEvents.EVENT_UPDATED_GLOBAL, () => {
    invalidateRealtimeCache();
    fetchDashboardData({ silent: true });
  });

  if (loading) {
    return <DashboardHomeSkeleton />;
  }

  const displayName = userData
    ? [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
      userData.email
    : authUser?.firstName || authUser?.emailAddresses?.[0]?.emailAddress || "Debater";
  const college = userData?.college || "College not set";

  const totalDebates = userData?.stats?.totalDebates || 0;
  const qualifiedCount = userData?.stats?.qualified || 0;
  const winRate = totalDebates > 0 ? Math.round(userData?.stats?.winRate || 0) : 0;

  const handleCheckIn = async () => {
    if (!currentRound) return;
    try {
      setCheckingIn(true);
      const token = await getToken();
      const response = await CheckInApi.checkIn(currentRound.id, token);
      if (response.success) {
        setCheckInStatus(response.checkIn);
        toast.success("Successfully checked in!");
      }
    } catch (err) {
      toast.error(err.message || "Failed to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans">
      {/* WhatsApp First Login Modal & Persistent Alert */}
      <Suspense fallback={null}>
        <WhatsAppFirstLoginModal event={activeEvent} />
        <WhatsAppGroupBanner
          whatsappLink={activeEvent?.whatsappLink}
          eventName={activeEvent?.name}
        />
      </Suspense>

      {/* Error Banner */}
      {error && (
        <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-xl font-sans flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-bold">Error loading telemetry:</span>
            <span className="opacity-90">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearApiCache();
              setError(null);
              fetchDashboardData();
            }}
            className="min-h-9 px-3 rounded-lg bg-destructive/15 text-xs font-semibold hover:bg-destructive/25 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Compact Debater Command Strip */}
      <section className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <UserAvatar user={authUser} name={displayName} size="lg" className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate">
                {displayName}
              </h1>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-heading font-bold uppercase tracking-wider rounded shrink-0">
                Debater
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{college}</p>
          </div>
        </div>

        {/* Compact Stat Badges */}
        <div className="grid grid-cols-3 gap-2 bg-muted/40 border border-border/70 rounded-xl p-2 sm:px-4 text-center shrink-0">
          <div className="px-1 border-r border-border/50">
            <div className="text-base sm:text-lg font-heading font-bold text-foreground">
              <CountUp value={totalDebates} />
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Debates
            </div>
          </div>
          <div className="px-1 border-r border-border/50">
            <div className="text-base sm:text-lg font-heading font-bold text-emerald-600 dark:text-emerald-400">
              <CountUp value={qualifiedCount} />
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Qualified
            </div>
          </div>
          <div className="px-1">
            <div className="text-base sm:text-lg font-heading font-bold text-primary">
              {winRate}%
            </div>
            <div className="text-[9px] sm:text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
              Rate
            </div>
          </div>
        </div>
      </section>

      {/* Segmented Control Bar (Mobile & Desktop View Switcher) */}
      <div
        role="tablist"
        aria-label="Dashboard views"
        className="grid grid-cols-3 p-1 rounded-xl bg-muted/60 border border-border text-xs font-semibold gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "now"}
          onClick={() => setMobileTab("now")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5",
            mobileTab === "now"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Swords size={14} />
          <span>Live Matchup</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "rounds"}
          onClick={() => setMobileTab("rounds")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5",
            mobileTab === "rounds"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar size={14} />
          <span>Rounds {activeEvent?.rounds?.length ? `(${activeEvent.rounds.length})` : ""}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "results"}
          onClick={() => setMobileTab("results")}
          className={cn(
            "min-h-11 rounded-lg transition-all flex items-center justify-center gap-1.5",
            mobileTab === "results"
              ? "bg-card text-foreground font-bold shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Trophy size={14} />
          <span>Results</span>
        </button>
      </div>

      {/* Tab: NOW (Default Live Command View) */}
      {mobileTab === "now" && (
        <div className="space-y-4">
          {/* Active Tournament Headline */}
          {activeEvent ? (
            <div className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {activeEvent.status === "ONGOING" ? "Active Tournament" : activeEvent.status}
                </span>
                <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground">
                  {activeEvent.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/dashboard/events/${activeEvent.id}`}
                  className="inline-flex min-h-10 items-center justify-center px-4 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted text-foreground transition-colors"
                >
                  Tournament Hub
                </Link>
                {activeEvent.whatsappLink && (
                  <a
                    href={activeEvent.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors gap-1.5"
                  >
                    <span>WhatsApp</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              row
              icon={Calendar}
              title="No tournament active"
              description="Browse upcoming debate tournaments and enrol."
              action={<NeoButton to="/dashboard/events">Browse Events</NeoButton>}
            />
          )}

          {/* Current Round & Check-In Combined Card */}
          {currentRound && (
            <div className="bg-card border-2 border-border p-4 sm:p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-base sm:text-lg font-heading font-bold text-foreground">
                    {currentRound.name || `Round ${currentRound.roundNumber}`}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-heading font-bold uppercase tracking-wider border bg-muted text-muted-foreground border-border">
                  {currentRound.status}
                </span>
              </div>

              {/* Check-In Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 border border-border/70 p-3.5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                      checkInStatus?.status === "PRESENT"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    )}
                  >
                    {checkInStatus?.status === "PRESENT" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {checkInStatus?.status === "PRESENT" ? "Checked In for Round" : "Check-in Required"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {checkInStatus?.status === "PRESENT"
                        ? "Your attendance is confirmed."
                        : "Confirm attendance to be included in pairings."}
                    </p>
                  </div>
                </div>

                {checkInStatus?.status !== "PRESENT" ? (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="min-h-11 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    {checkingIn ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Checking in...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Check In Now</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Presence Verified
                  </span>
                )}
              </div>

              {/* Matchup & Motion Panel */}
              {nextDebate ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-xl border border-border bg-background/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Swords size={14} /> Assigned Matchup
                      </span>
                      <span className="font-mono text-muted-foreground">
                        Room: <strong className="text-foreground">{nextDebate.room?.name || "TBD"}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-foreground font-medium leading-relaxed">
                      {nextDebate.round?.motion
                        ? `Motion: ${nextDebate.round.motion}`
                        : "Motion will be announced when round starts"}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2">
                      <span>
                        Side:{" "}
                        <strong className="text-foreground">
                          {nextDebate.debater1Id === userData?.id ? "Government (GOV)" : "Opposition (OPP)"}
                        </strong>
                      </span>
                      {nextDebate.judgeName && (
                        <span>
                          Judge: <strong className="text-foreground">{nextDebate.judgeName}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    to={`/dashboard/events/${activeEvent.id}/rounds/${currentRound.id}`}
                    className="min-h-11 w-full rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View Round Draw &amp; Details</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ) : currentRound.pairingsPublished ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Draw released. You do not have a scheduled debate in this round.
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground">
                  <Lock size={16} className="shrink-0 text-muted-foreground" />
                  <span>Pairings are being drawn by the adjudication core. Check back soon.</span>
                </div>
              )}
            </div>
          )}

          {/* Latest Result Banner (Respecting Competition Boundaries) */}
          {latestCompletedDebate && (() => {
            const isDebater1 = latestCompletedDebate.debater1Id === userData?.id;
            const opponent = isDebater1 ? latestCompletedDebate.debater2 : latestCompletedDebate.debater1;
            const published = Boolean(
              latestCompletedDebate.resultsPublished || latestCompletedDebate.round?.resultsPublished
            );
            const qualified = Boolean(latestCompletedDebate.isPromoted);
            const resultEventId = latestCompletedDebate.round?.eventId || activeEvent?.id;

            return (
              <div className="bg-card border border-border p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-heading font-bold text-foreground flex items-center gap-1.5">
                    <Award size={14} className="text-primary" />
                    Latest: {latestCompletedDebate.round?.name || "Previous Round"}
                  </span>
                  {published ? (
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                        qualified
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}
                    >
                      {qualified ? "QUALIFIED" : "ELIMINATED"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" /> Awaiting Selection
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Debated vs <span className="font-semibold text-foreground">{opponent?.firstName} {opponent?.lastName}</span> ({isDebater1 ? "GOV" : "OPP"})
                </p>

                {resultEventId && (
                  <Link
                    to={`/dashboard/events/${resultEventId}/results`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    <span>View Standings</span>
                    <ArrowRight size={12} />
                  </Link>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: ROUNDS */}
      {mobileTab === "rounds" && (
        <div className="space-y-3">
          {activeEvent?.rounds?.length ? (
            activeEvent.rounds.map((r) => (
              <div
                key={r.id}
                className="bg-card border-2 border-border p-4 rounded-xl flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-base text-foreground">
                      {r.name || `Round ${r.roundNumber}`}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-heading font-bold uppercase border bg-muted text-muted-foreground border-border">
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.pairingsPublished ? "Draw published" : "Draw pending"}
                  </p>
                </div>

                <Link
                  to={`/dashboard/events/${activeEvent.id}/rounds/${r.id}`}
                  className="min-h-10 px-4 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>Open</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground bg-card border border-border rounded-xl">
              No rounds created yet for this tournament.
            </div>
          )}
        </div>
      )}

      {/* Tab: RESULTS */}
      {mobileTab === "results" && (
        <div className="space-y-4">
          <div className="bg-card border-2 border-border p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Trophy size={16} /> Tournament Results &amp; Standings
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Official promotion decisions, qualified debate finalists, and final ranks are published after round verification by the adjudication panel.
            </p>
            {activeEvent ? (
              <Link
                to={`/dashboard/events/${activeEvent.id}/results`}
                className="min-h-11 w-full rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <span>View Event Results</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground italic">No active event</p>
            )}
          </div>
        </div>
      )}

      {/* Quick link banner (desktop & tablet, unobtrusive) */}
      <aside className="hidden md:grid overflow-hidden rounded-xl bg-card border border-border p-4 axiom-rise" aria-label="Quick links">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">AXIOM 4.0</p>
            <p className="text-sm font-semibold text-foreground">Clarity under pressure · Parliamentary Debates</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard/events" className="min-h-9 px-3.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center">
              All Tournaments
            </Link>
            <Link to="/dashboard/profile" className="min-h-9 px-3.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center">
              My Profile
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
