import {useState, useEffect} from "react";
import {motion} from "framer-motion";
import {Loader2, Calendar, Trophy, ArrowRight, MapPin} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {EventApi} from "../../services/api";
import {Link} from "react-router-dom";

export default function DashboardEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {getToken} = useAuth();

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const token = await getToken();
                const response = await EventApi.list(token);
                // Handle the API response structure: { success: true, events: [...] }
                const eventList = response.events || response.data || [];
                setEvents(eventList);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [getToken]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Tournaments</h1>
                <p className="text-muted-foreground mt-1">
                    Register for upcoming debates or view past results.
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
                    <p className="font-medium">Failed to load events</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            )}

            {events.length === 0 && !error ? (
                <div className="text-center py-16 bg-card border border-border rounded-2xl">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold mb-2">No Events Yet</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        There are no tournaments available at the moment. Check
                        back later for upcoming events!
                    </p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {events.map((event, i) => (
                        <motion.div
                            key={event.id}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: i * 0.1}}
                            className="group relative p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all hover:bg-muted/10 overflow-hidden"
                        >
                            {/* Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] duration-1000" />

                            <div className="relative flex flex-col gap-4">
                                {/* Top row: Date + Title */}
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-primary/10 flex flex-col items-center justify-center border border-primary/20">
                                        <span className="text-[10px] font-bold text-primary uppercase leading-none">
                                            {new Date(
                                                event.startDate
                                            ).toLocaleString("default", {
                                                month: "short",
                                            })}
                                        </span>
                                        <span className="text-xl font-bold text-foreground leading-none mt-0.5">
                                            {new Date(
                                                event.startDate
                                            ).getDate()}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors leading-tight">
                                            {event.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {event.description || "Debate Competition"}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                            <span className="flex items-center gap-1">
                                                <Trophy className="w-3.5 h-3.5" />
                                                {event.rounds?.length || 0} Rounds
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom row: Status + Button */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <div>
                                        {event.status === "ONGOING" && (
                                            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold animate-pulse">
                                                LIVE NOW
                                            </span>
                                        )}
                                        {event.status === "UPCOMING" && (
                                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
                                                UPCOMING
                                            </span>
                                        )}
                                        {event.status === "COMPLETED" && (
                                            <span className="px-3 py-1 rounded-full bg-gray-500/10 text-gray-500 text-xs font-bold">
                                                COMPLETED
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        to={`/dashboard/events/${event.id}`}
                                        className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-border hover:bg-primary hover:text-white hover:border-primary transition-all text-sm font-medium"
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
