import {useState, useEffect} from "react";
import {Link} from "react-router-dom";
import {motion} from "framer-motion";
import {
  Activity,
  Calendar,
  ChevronRight,
  Search,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {AdminApi, EventApi} from "../../services/api";
import {RoundCardSkeleton} from "../../components/ui/Skeleton";

export default function AdminRounds() {
  const {getToken} = useAuth();
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
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Round Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage tournament rounds and pairings across all events
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by event or round name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-2xl">
          <Activity className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-xl font-bold mb-2">No Active Rounds Found</h3>
          <p className="text-muted-foreground mb-6">
            Create rounds within an event to manage them here.
          </p>
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium"
          >
            Go to Events
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredEvents.map((event) => (
            <div key={event.id} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-purple-500" />
                <h3 className="font-bold text-lg">{event.name}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {event.rounds.map((round) => (
                  <Link
                    key={round.id}
                    to={`/admin/rounds/${round.id}`}
                    className="bg-card border border-border rounded-2xl p-5 hover:border-purple-500/50 transition-all flex flex-col justify-between group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center font-bold text-purple-500">
                        {round.roundNumber}
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          round.status === "ONGOING"
                            ? "bg-green-500/10 text-green-500"
                            : round.status === "COMPLETED"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {round.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 group-hover:text-purple-500 transition-colors uppercase tracking-tight">
                        {round.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3" />
                        Check-in:{" "}
                        {new Date(round.checkInStartTime).toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Kolkata",
                          }
                        )}{" "}
                        IST
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs font-bold text-purple-500">
                      <span>Manage Round</span>
                      <ChevronRight className="w-4 h-4" />
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
