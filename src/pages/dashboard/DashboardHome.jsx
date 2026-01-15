import {useState, useEffect} from "react";
import {motion} from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Users,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  MapPin,
  Loader2,
  XCircle,
  ChevronRight,
  Shield,
  Swords,
} from "lucide-react";
import {useAuth, useUser} from "@clerk/clerk-react";
import {UserApi, EventApi, DebateApi, CheckInApi} from "../../services/api";
import {Link} from "react-router-dom";
import {useToast} from "../../components/ui/Toast";
import {cn} from "../../lib/utils";
import {DashboardHomeSkeleton} from "../../components/ui/Skeleton";

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

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!clerkLoaded) return;

      try {
        setLoading(true);
        const token = await getToken();

        // Fetch user profile with stats
        const profileResponse = await UserApi.getProfile(token);
        setUserData(profileResponse.user);

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
            // If no ongoing round, find the next upcoming one
            targetRound = event.rounds?.find((r) => r.status === "UPCOMING");
          }

          if (!targetRound && event.rounds?.length > 0) {
            // If no active rounds, show the latest round (e.g. last completed)
            targetRound = event.rounds[event.rounds.length - 1];
          }

          if (targetRound) {
            setCurrentRound(targetRound);

            // Check user's check-in status for this round
            try {
              const checkIn = await CheckInApi.getMyStatus(
                targetRound.id,
                token
              );
              setCheckInStatus(checkIn.checkIn);
            } catch (e) {
              // User might not have checked in yet
              setCheckInStatus(null);
            }
          }
        }

        // Fetch user's debates
        try {
          const debatesResponse = await DebateApi.getMyDebates(token);
          const debates = debatesResponse.debates || [];
          // Find next scheduled debate
          const scheduled = debates.find((d) => d.status === "SCHEDULED");
          if (scheduled) {
            setNextDebate(scheduled);
          }
        } catch (e) {
          // User might not have any debates
        }

        setError(null);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [getToken, clerkLoaded]);

  if (loading) {
    return <DashboardHomeSkeleton />;
  }

  // Use fetched data or fallback to Clerk data
  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ""}`.trim()
    : clerkUser?.fullName || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const college = userData?.college || "Complete your profile";

  const stats = [
    {
      label: "Debates",
      value: userData?.stats?.totalDebates || 0,
      color: "text-gray-800",
    },
    {
      label: "Wins",
      value: userData?.stats?.wonDebates || 0,
      color: "text-green-600",
    },
    {
      label: "Win Rate",
      value:
        userData?.stats?.totalDebates > 0
          ? `${Math.round(
              (userData.stats.wonDebates / userData.stats.totalDebates) * 100
            )}%`
          : "0%",
      color: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-6 max-w-md mx-auto md:max-w-4xl md:mx-0">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
          <p className="font-medium">Failed to load dashboard data</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-[#6D28D9] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          {clerkUser?.imageUrl ? (
            <img
              src={clerkUser.imageUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-white/80 text-sm">{college}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-medium uppercase">
                Debater
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between bg-white rounded-2xl p-4 text-center shadow-sm">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex-1 border-r last:border-0 border-gray-100"
            >
              <div className={`text-xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Event Card */}
      {activeEvent ? (
        <motion.div
          initial={{y: 20, opacity: 0}}
          animate={{y: 0, opacity: 1}}
          className={cn(
            "text-white p-6 rounded-3xl shadow-lg relative overflow-hidden",
            activeEvent.status === "ONGOING"
              ? "bg-[#F97316]"
              : activeEvent.status === "UPCOMING"
              ? "bg-[#3B82F6]"
              : "bg-[#6B7280]"
          )}
        >
          <Link
            to={`/dashboard/events/${activeEvent.id}`}
            className="block relative z-10"
          >
            <div className="flex items-center gap-2 mb-1 opacity-90 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              {activeEvent.status === "ONGOING"
                ? "ACTIVE EVENT"
                : activeEvent.status}
            </div>
            <h2 className="text-2xl font-bold mb-1">{activeEvent.name}</h2>
            <p className="opacity-90 text-sm mb-4">
              {activeEvent.description || "Debate Competition"}
            </p>

            {currentRound && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-sm">
                {currentRound.name || `Round ${currentRound.roundNumber}`} ·{" "}
                {currentRound.status}
              </div>
            )}
          </Link>
          <ArrowUpRight className="absolute top-6 right-6 w-6 h-6 z-10 opacity-75" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </motion.div>
      ) : (
        <div className="bg-card border border-border p-6 rounded-3xl text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-bold text-lg mb-1">No Active Events</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Check out upcoming tournaments
          </p>
          <Link
            to="/dashboard/events"
            className="inline-flex px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
          >
            Browse Events
          </Link>
        </div>
      )}

      {/* Check-In Status */}
      {currentRound && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-lg">Check-In Status</h3>
            <span className="text-xs text-muted-foreground">
              {currentRound.name || `Round ${currentRound.roundNumber}`}
            </span>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    checkInStatus?.status === "PRESENT"
                      ? "bg-green-100 text-green-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {checkInStatus?.status === "PRESENT" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-100">
                    {checkInStatus?.status === "PRESENT"
                      ? "Checked In"
                      : "Not Checked In"}
                  </p>
                  {checkInStatus?.checkedInAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  checkInStatus?.status === "PRESENT"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {checkInStatus?.status === "PRESENT" ? "Present" : "Pending"}
              </span>
            </div>

            {/* Check-In Button - Show when not checked in */}
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
                className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Check In Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Next Debate */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg">Your Next Debate</h3>
          <Link
            to="/dashboard/events"
            className="text-primary text-sm font-medium hover:underline"
          >
            View All
          </Link>
        </div>
        {nextDebate ? (
          <div className="bg-white dark:bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <span className="text-primary font-bold text-sm">
                {nextDebate.round?.name || "Upcoming Round"}
              </span>
              <span className="text-neutral-500 text-xs">
                Room: {nextDebate.room?.name || "TBD"}
              </span>
            </div>

            <p className="font-medium text-foreground mb-6 leading-relaxed">
              {nextDebate.round?.motion
                ? `Motion: ${nextDebate.round.motion}`
                : "Motion will be announced soon"}
            </p>

            <div className="flex gap-2">
              <Link
                to={`/dashboard/events/${nextDebate.round.eventId}/rounds/${nextDebate.round.id}`}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 text-center flex items-center justify-center"
              >
                View Details
              </Link>
              <Link
                to={`/dashboard/events/${nextDebate.round.eventId}/rounds/${nextDebate.round.id}`}
                className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground transition-colors flex items-center justify-center"
              >
                <MapPin className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border p-5 rounded-2xl text-center">
            <Trophy className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              No upcoming debates scheduled
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
