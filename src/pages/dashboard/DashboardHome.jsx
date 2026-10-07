import {useState, useEffect, useRef} from "react";
import {motion as Motion} from "framer-motion";
import {
  Trophy,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  MapPin,
  Loader2,
  XCircle,
  Swords,
  Lock,
  ArrowRight,
} from "lucide-react";
import {useAuth, useUser} from "@clerk/clerk-react";
import {UserApi, EventApi, DebateApi, CheckInApi} from "../../services/api";
import {Link} from "react-router-dom";
import {useToast} from "../../hooks/useToast"
import {DashboardHomeSkeleton} from "../../components/ui/Skeleton";
import {useEventSocket} from "../../hooks/useSocket";
import Sculpture from "../../components/brand/Sculpture";
import {UserAvatar} from "../../components/ui/UserAvatar";
import EmptyState from "../../components/ui/EmptyState";
import CountUp from "../../components/ui/CountUp";
import NeoButton from "../../components/neo/NeoButton";
import NeoProgressBar from "../../components/neo/NeoProgressBar";

export default function DashboardHome() {
  const {getToken} = useAuth();
  const {user: clerkUser, isLoaded: clerkLoaded} = useUser();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [nextDebate, setNextDebate] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Fetch data function extracted for reuse
  const fetchDashboardData = async () => {
    if (!clerkLoaded) return;

    try {
      const token = await getTokenRef.current();

      // Fetch user profile stats if we don't have them
      if (!userData) {
        const profileResponse = await UserApi.getProfile(token);
        setUserData(profileResponse.user);
      }

      // Fetch events to find active one (ONGOING first, then UPCOMING)
      let eventsResponse = await EventApi.list(token, "ONGOING");
      let events = eventsResponse.events || [];

      // If no ongoing events, check for upcoming ones
      if (events.length === 0) {
        eventsResponse = await EventApi.list(token, "UPCOMING");
        events = eventsResponse.events || [];
      }

      // If still no events, fetch all events
      if (events.length === 0) {
        eventsResponse = await EventApi.list(token);
        events = eventsResponse.events || [];
      }

      if (events.length > 0) {
        const event = events[0];
        setActiveEvent(event);

        // Find active or latest round (Ongoing > Upcoming > Latest)
        let targetRound = event.rounds?.find((r) => r.status === "ONGOING");

        if (!targetRound) {
          targetRound = event.rounds?.find((r) => r.status === "UPCOMING");
        }

        if (!targetRound && event.rounds?.length > 0) {
          targetRound = event.rounds[event.rounds.length - 1];
        }

        if (targetRound) {
          setCurrentRound(targetRound);

          // Check user's check-in status for this round
          try {
            const checkIn = await CheckInApi.getMyStatus(targetRound.id, token);
            setCheckInStatus(checkIn.checkIn);
          } catch {
            setCheckInStatus(null);
          }
        }
      }

      // Fetch user's debates
      try {
        const debatesResponse = await DebateApi.getMyDebates(token);
        const debates = debatesResponse.debates || [];
        const scheduled = debates.find((d) => d.status === "SCHEDULED");
        if (scheduled) {
          setNextDebate(scheduled);
        } else {
          setNextDebate(null);
        }
      } catch {
        // User might not have any debates
      }

      setError(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (loading) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded]);

  // Real-time updates
  useEventSocket(activeEvent?.id, {
    onRoundStatusChange: (data) => {
      console.log("Round status changed, refreshing dashboard...", data);
      toast.info("Update", `Round status updated to ${data.status}`);
      fetchDashboardData();
    },
    onPairingsPublished: (data) => {
      console.log("Pairings published, refreshing dashboard...", data);
      if (data.published) {
        toast.success("Draw Released!", "Pairings have been published.");
      }
      fetchDashboardData();
    },
    onRoundUpdated: () => {
      fetchDashboardData();
    },
    onDebateCreated: () => {
      fetchDashboardData();
    },
  });

  if (loading) {
    return <DashboardHomeSkeleton />;
  }

  // Use fetched data or fallback to Clerk data
  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ""}`.trim()
    : clerkUser?.fullName || "User";
  const college = userData?.college || "Complete your profile";

  const stats = [
    {
      label: "Debates",
      value: userData?.stats?.totalDebates || 0,
      color: "text-foreground",
    },
    {
      label: "Qualified",
      value: userData?.stats?.qualified || 0,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Qualify Rate",
      value:
        userData?.stats?.totalDebates > 0
          ? `${Math.round(userData.stats.winRate)}%`
          : "0%",
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="axiom-page-header axiom-rise">
        <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
          Overview
        </span>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
          Debater Desk
        </h1>
        <p className="text-sm text-muted-foreground font-sans mt-0.5">
          Live tournament schedule, pairings, and personal standings.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-lg font-sans flex flex-wrap items-baseline gap-x-3">
          <p className="font-semibold text-sm">Failed to load dashboard data</p>
          <p className="text-xs opacity-90">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
      <div className="space-y-4 min-w-0">
      {/* Profile / Performance Overview Surface */}
      <div className="bg-card border border-border p-6 rounded-xl relative overflow-hidden axiom-rise" style={{"--i": 1}}>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-5">
            <UserAvatar user={clerkUser} name={displayName} size="xl" className="axiom-avatar-pop" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-heading font-bold text-foreground truncate">{displayName}</h2>
                <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded text-[10px] font-heading font-semibold uppercase tracking-wider shrink-0">
                  Debater
                </span>
              </div>
              <p className="text-muted-foreground font-sans text-xs mt-0.5 truncate">{college}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-muted/30 border border-border/60 rounded-lg p-3 text-center">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="border-r last:border-0 border-border/50 px-1 axiom-rise"
                style={{"--i": index + 3}}
              >
                <div className={`text-xl font-heading font-bold ${stat.color}`}>
                  <CountUp value={stat.value} />
                </div>
                <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-heading font-semibold uppercase tracking-wider text-muted-foreground">
              Win rate
            </p>
            <NeoProgressBar
              label="Qualify rate"
              value={userData?.stats?.totalDebates > 0 ? Math.round(userData.stats.winRate) : 0}
            />
          </div>
        </div>

      </div>

      {/* Active Event Card */}
      {activeEvent ? (
        <Motion.div
          initial={{y: 14, opacity: 0}}
          animate={{y: 0, opacity: 1}}
          transition={{duration: 0.3}}
          className="bg-card border border-border hover:border-primary/40 hover:shadow-md transition-[border-color,box-shadow] p-6 rounded-xl relative"
          whileHover={{y: -3}}
          whileTap={{scale: 0.99}}
        >
          <Link
            to={`/dashboard/events/${activeEvent.id}`}
            className="block relative z-10 group"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-heading font-semibold uppercase tracking-wider text-primary">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {activeEvent.status === "ONGOING"
                    ? "Active Tournament"
                    : activeEvent.status}
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
              {activeEvent.name}
            </h2>
            <p className="text-muted-foreground font-sans text-sm mb-4 line-clamp-2">
              {activeEvent.description || "Debate Competition"}
            </p>

            {currentRound && (
              <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/60 border border-border text-xs font-sans text-foreground">
                <span className="font-medium">
                  {currentRound.name || `Round ${currentRound.roundNumber}`}
                </span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="uppercase text-[10px] font-heading font-semibold text-primary">
                  {currentRound.status}
                </span>
              </div>
            )}
          </Link>
        </Motion.div>
      ) : (
        <EmptyState
          row
          icon={Calendar}
          title="The arena is quiet"
          description="No tournament is running right now. Browse upcoming events and take your place."
          action={
            <NeoButton to="/dashboard/events">
              Browse events <ArrowRight size={16} aria-hidden="true" />
            </NeoButton>
          }
        />
      )}

      <aside className="axiom-fill-tall grid-cols-[1fr_auto] items-end overflow-hidden rounded-xl bg-primary text-[var(--axiom-ink)] axiom-rise" style={{"--i": 5}} aria-label="Quick links">
        <div className="p-6 self-center">
          <p className="axiom-eyebrow mb-2">Between rounds</p>
          <p className="text-4xl leading-none uppercase" style={{fontFamily: "var(--font-display)"}}>Clarity<br />under pressure.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/dashboard/events" className="axiom-button axiom-press">Events</Link>
            <Link to="/dashboard/profile" className="axiom-button axiom-button--outline axiom-press">Profile</Link>
          </div>
        </div>
        <Sculpture figure="lotus-goddess" variant="detail" className="h-48 w-auto self-end mr-6 object-contain" />
      </aside>
      </div>

      <div className="space-y-4 min-w-0">

      {/* Check-In Status */}
      {currentRound && (
        <div className="space-y-2 axiom-rise" style={{"--i": 2}}>
          <div className="flex items-center justify-between px-0.5">
            <h3 className="font-heading font-bold text-base text-foreground">Check-In Status</h3>
            <span className="text-xs text-muted-foreground font-sans">
              {currentRound.name || `Round ${currentRound.roundNumber}`}
            </span>
          </div>
          <div className="bg-card p-5 rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    checkInStatus?.status === "PRESENT"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {checkInStatus?.status === "PRESENT" ? (
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-foreground">
                    {checkInStatus?.status === "PRESENT"
                      ? "Checked In"
                      : "Not Checked In"}
                  </p>
                  {checkInStatus?.checkedInAt && (
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      {new Date(checkInStatus.checkedInAt).toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        }
                      )}
                      {" IST"}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-heading font-semibold uppercase tracking-wider shrink-0 border ${
                  checkInStatus?.status === "PRESENT"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                }`}
              >
                {checkInStatus?.status === "PRESENT" ? "Present" : "Pending"}
              </span>
            </div>

            {/* Check-In Button */}
            {checkInStatus?.status !== "PRESENT" && (
              <button
                onClick={async () => {
                  try {
                    setCheckingIn(true);
                    const token = await getToken();
                    const response = await CheckInApi.checkIn(
                      currentRound.id,
                      token
                    );
                    if (response.success) {
                      setCheckInStatus(response.checkIn);
                      toast.success("Successfully checked in!");
                    }
                  } catch (err) {
                    console.error("Check-in error:", err);
                    toast.error(
                      err.message || "Failed to check in. Please try again."
                    );
                  } finally {
                    setCheckingIn(false);
                  }
                }}
                disabled={checkingIn}
                className="w-full mt-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Check In Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Draw Status Section */}
      {currentRound && (
        <div className="space-y-2 axiom-rise" style={{"--i": 3}}>
          <div className="flex items-center justify-between px-0.5">
            <h3 className="font-heading font-bold text-base text-foreground">Draw Status</h3>
            <span className="text-xs text-muted-foreground font-sans">
              {currentRound.name || `Round ${currentRound.roundNumber}`}
            </span>
          </div>

          {currentRound.pairingsPublished ? (
            <Motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
              className="bg-card border border-border p-5 rounded-xl relative"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-heading font-bold text-base text-foreground mb-0.5 flex items-center gap-2">
                    Draw Released
                    <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 py-0.5 rounded font-heading font-semibold uppercase tracking-wider">
                      Public
                    </span>
                  </h4>
                  <p className="text-muted-foreground font-sans text-xs">
                    Pairings are now live. Check your assigned room and opponent.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Swords className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>

              <Link
                to={`/dashboard/events/${activeEvent.id}/rounds/${currentRound.id}`}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>View Draw</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </Link>
            </Motion.div>
          ) : (
            <div className="bg-card border border-border p-5 rounded-xl">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-heading font-bold text-base text-foreground mb-0.5 flex items-center gap-2">
                    Draw Not Released
                    <span className="bg-muted text-muted-foreground border border-border text-[10px] px-2 py-0.5 rounded font-heading font-semibold uppercase tracking-wider">
                      Pending
                    </span>
                  </h4>
                  <p className="text-muted-foreground font-sans text-xs">
                    The adjudication core has not released the pairings yet.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>

              <button
                disabled
                className="w-full py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-xs border border-border/50 cursor-not-allowed opacity-80 flex items-center justify-center"
              >
                Wait for Announcement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Next Debate */}
      <div className="space-y-2 axiom-rise" style={{"--i": 4}}>
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-heading font-bold text-base text-foreground">Your Next Debate</h3>
          <Link
            to="/dashboard/events"
            className="text-primary text-xs font-sans font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            View All
          </Link>
        </div>
        {nextDebate ? (
          <div className="bg-card border border-border p-5 rounded-xl">
            <div className="flex justify-between items-start mb-3">
              <span className="text-primary font-heading font-semibold text-xs uppercase tracking-wider">
                {nextDebate.round?.name || "Upcoming Round"}
              </span>
              <span className="text-muted-foreground text-xs font-sans">
                Room: {nextDebate.room?.name || "TBD"}
              </span>
            </div>

            <p className="font-medium text-foreground text-sm mb-4 leading-relaxed font-sans">
              {nextDebate.round?.motion
                ? `Motion: ${nextDebate.round.motion}`
                : "Motion will be announced soon"}
            </p>

            <div className="flex gap-2">
              <Link
                to={`/dashboard/events/${nextDebate.round.eventId}/rounds/${nextDebate.round.id}`}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs text-center flex items-center justify-center hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View Details
              </Link>
              <Link
                to={`/dashboard/events/${nextDebate.round.eventId}/rounds/${nextDebate.round.id}`}
                aria-label="View debate room location"
                className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MapPin className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            row
            icon={Trophy}
            title="No debate on the horizon"
            description="Your next pairing appears here once the draw is released."
          />
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
