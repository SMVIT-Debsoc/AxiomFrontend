import {useState, useEffect, useCallback, useRef} from "react";
import {motion as Motion} from "framer-motion";
import {Trophy} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {EventApi} from "../../services/api";
import {Link} from "react-router-dom";
import {EventCardSkeleton} from "../../components/ui/Skeleton";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {useSocket, SocketEvents} from "../../hooks/useSocket";
import EmptyState from "../../components/ui/EmptyState";
import NeoButton from "../../components/neo/NeoButton";
import TournamentGuide from "../../components/dashboard/TournamentGuide";
import {RefreshCw} from "lucide-react";

export default function DashboardEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {getToken} = useAuth();

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchEvents = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const response = await EventApi.list(token);
      // Handle the API response structure: { success: true, events: [...] }
      const eventList = response.events || response.data || [];
      setEvents(eventList);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Real-time updates
  const {subscribe} = useSocket();
  useEffect(() => {
    const unsubs = [
      subscribe(SocketEvents.EVENT_CREATED, () => {
        fetchEvents();
      }),
      subscribe(SocketEvents.EVENT_UPDATED_GLOBAL, () => {
        fetchEvents();
      }),
      subscribe(SocketEvents.EVENT_DELETED_GLOBAL, () => {
        fetchEvents();
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe, fetchEvents]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="axiom-page-header max-w-full">
          <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
            Competitions
          </span>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1 break-words">
            Tournaments
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-sans mt-1">
            Register for upcoming debates or inspect completed stages.
          </p>
        </div>
        <LoadingIndicator label="Loading tournament events" />
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          aria-busy="true"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="axiom-page-header max-w-full">
        <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
          Competitions
        </span>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1 break-words">
          Tournaments
        </h1>
        <p className="text-sm md:text-base text-muted-foreground font-sans mt-1">
          Register for upcoming debates or inspect completed stages.
        </p>
      </div>

      {error && (
        <EmptyState
          row
          icon={RefreshCw}
          title="Couldn't reach the arena"
          description={`Tournaments could not be loaded (${error}). Check your connection and try again.`}
          action={<NeoButton onClick={fetchEvents}>Try again</NeoButton>}
        />
      )}

      {events.length === 0 && !error ? (
        <EmptyState
          title="No events yet"
          description="There are no tournaments available at the moment. Check back soon for announcements."
        />
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event, i) => (
            <Motion.div
              key={event.id}
              initial={{opacity: 0, y: 14}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: i * 0.05, duration: 0.3}}
              whileHover={{y: -3}}
              className="group relative min-w-0 p-5 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-[border-color,box-shadow]"
            >
              <div className="relative flex h-full flex-col justify-between gap-4">
                {/* Top row: Date + Title */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-primary/10 flex flex-col items-center justify-center border border-primary/20">
                    <span className="text-[10px] font-heading font-bold text-primary uppercase leading-none">
                      {new Date(event.startDate).toLocaleString("default", {
                        month: "short",
                      })}
                    </span>
                    <span className="text-lg font-heading font-bold text-foreground leading-none mt-0.5">
                      {new Date(event.startDate).getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors leading-tight truncate">
                      {event.name}
                    </h3>
                    <p className="text-sm font-sans text-muted-foreground mt-1 line-clamp-2">
                      {event.description || "Debate Competition"}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-sans text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                        {event.rounds?.length || 0} Rounds
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom row: Status + Button */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div>
                    {event.status === "ONGOING" && (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
                        Live Now
                      </span>
                    )}
                    {event.status === "UPCOMING" && (
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider">
                        Upcoming
                      </span>
                    )}
                    {event.status === "COMPLETED" && (
                      <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border text-xs font-semibold uppercase tracking-wider">
                        Completed
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/dashboard/events/${event.id}`}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </Motion.div>
          ))}
        </div>
      ) : null}

      <TournamentGuide />
    </div>
  );
}
