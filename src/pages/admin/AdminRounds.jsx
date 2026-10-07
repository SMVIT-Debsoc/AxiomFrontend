import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  Activity,
  Calendar,
  ChevronRight,
  Search,
  Clock,
  Loader2,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi } from "../../services/api";

export default function AdminRounds() {
  const { getToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const token = await getToken();
        const response = await EventApi.list(token);
        if (response.success) {
          const eventList = response.events || [];

          // For each event, fetch its rounds
          const eventsWithRounds = await Promise.all(
            eventList.map(async (event) => {
              const roundRes = await AdminApi.apiRequest(
                `/rounds/event/${event.id}`,
                "GET",
                null,
                token
              );
              return {
                ...event,
                rounds: roundRes.success ? roundRes.rounds : [],
              };
            })
          );

          setEvents(eventsWithRounds.filter((e) => e.rounds.length > 0));
        }
      } catch (error) {
        console.error("Failed to fetch rounds data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = events.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.rounds.some((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading rounds" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="max-w-full">
          <div className="flex items-center gap-2 mb-1">
            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
              AXIOM 4.0
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Sequencing
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground break-words">
            Round Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5 font-sans">
            Manage tournament rounds, check-in windows, and pairings across all active events
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by event or round name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search rounds"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-card/60 border border-border/70 rounded-xl">
          <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" aria-hidden="true" />
          <h3 className="text-lg font-heading font-bold mb-1 text-foreground">No Active Rounds Found</h3>
          <p className="text-sm text-muted-foreground mb-5 font-sans">
            {searchQuery ? "No rounds matched your search query." : "Create rounds within a tournament to manage them here."}
          </p>
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to Events
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredEvents.map((event) => (
            <div key={event.id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                <h3 className="font-heading font-bold text-base text-foreground">{event.name}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {event.rounds.map((round) => (
                  <Link
                    key={round.id}
                    to={`/admin/rounds/${round.id}`}
                    className="bg-card/70 border border-border/70 rounded-xl p-5 hover:border-primary/50 transition-all flex flex-col justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm">
                          {round.roundNumber}
                        </div>
                        <span
                          className={`text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            round.status === "ONGOING"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : round.status === "COMPLETED"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {round.status}
                        </span>
                      </div>
                      <h4 className="font-heading font-semibold text-sm mb-1 group-hover:text-primary transition-colors uppercase tracking-tight text-foreground">
                        {round.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Check-in:{" "}
                        {new Date(round.checkInStartTime).toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Kolkata",
                          }
                        )}{" "}
                        IST</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-sans font-semibold text-primary">
                      <span>Manage Round</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
