import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Calendar, Trophy, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { EventApi } from '../../services/api';
import { Link } from 'react-router-dom';

export default function DashboardEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const token = await getToken();
                // Fallback for demo if backend not running or no events
                const data = await EventApi.list(token);
                // Ensure we handle the array response correctly
                // API might return data directly or wrapped in { data: ... }
                // Based on standard axios/fetch wrappers, let's assume standard response
                const eventList = Array.isArray(data) ? data : (data.data || []);
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Tournaments</h1>
                    <p className="text-muted-foreground mt-1">Register for upcoming debates or view past results.</p>
                </div>
                <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                    Join with Code
                </button>
            </div>

            <div className="grid gap-6">
                {events.map((event, i) => (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all hover:bg-muted/10 overflow-hidden"
                    >
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] duration-1000" />

                        <div className="relative flex flex-col md:flex-row gap-6 md:items-center justify-between">
                            <div className="flex gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex flex-col items-center justify-center border border-primary/20">
                                    <span className="text-xs font-bold text-primary uppercase">
                                        {new Date(event.startDate).toLocaleString('default', { month: 'short' })}
                                    </span>
                                    <span className="text-2xl font-bold text-foreground">
                                        {new Date(event.startDate).getDate()}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{event.name}</h3>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                                        <span className="flex items-center gap-1">
                                            <Trophy className="w-4 h-4" /> Single Elimination
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" /> Online/Hybrid
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {event.status === 'ONGOING' && (
                                    <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold animate-pulse">
                                        LIVE NOW
                                    </span>
                                )}
                                <Link
                                    to={`/dashboard/events/${event.id}`}
                                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border hover:bg-primary hover:text-white hover:border-primary transition-all font-medium"
                                >
                                    View Details
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
