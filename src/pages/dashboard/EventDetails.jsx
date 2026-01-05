import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Trophy, Clock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { EventApi, RoundApi } from '../../services/api';
import { cn } from '../../lib/utils';

export default function EventDetails() {
    const { id } = useParams();
    const { getToken } = useAuth();
    const [event, setEvent] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = await getToken();

                // Mock data fetch simulation since backend might be empty
                // In real app, we would use:
                // const eventData = await EventApi.get(id, token);
                // const roundsData = await RoundApi.listByEvent(id, token);

                // Simulating network delay
                await new Promise(r => setTimeout(r, 600));

                setEvent({
                    id,
                    name: 'Axiom Pre-Worlds 2026',
                    description: 'The ultimate prep tournament before Worlds. Join the best debaters from across the region in this high-stakes competition. 5 rounds of intense debating followed by break rounds.',
                    startDate: '2026-03-01T09:00:00Z',
                    endDate: '2026-03-03T18:00:00Z',
                    status: 'UPCOMING',
                    location: 'Hybrid / Zoom',
                    organizer: 'Debate Society XYZ'
                });

                setRounds([
                    { id: 'r1', name: 'Round 1', motion: 'THBT AI should be granted legal personhood', startTime: '2026-03-01T10:00:00Z', status: 'COMPLETED' },
                    { id: 'r2', name: 'Round 2', motion: 'THW ban all forms of gambling', startTime: '2026-03-01T14:00:00Z', status: 'UPCOMING' },
                    { id: 'r3', name: 'Round 3', motion: 'Infoslide: ...', startTime: '2026-03-02T10:00:00Z', status: 'SCHEDULED' },
                ]);

                setLoading(false);
            } catch (error) {
                console.error("Failed to fetch event details", error);
                setLoading(false);
            }
        };

        fetchData();
    }, [id, getToken]);

    if (loading) return <div className="p-10 text-center">Loading event details...</div>;
    if (!event) return <div className="p-10 text-center">Event not found</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header / Breadcrumb */}
            <div>
                <Link to="/dashboard/events" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tournaments
                </Link>
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Trophy className="w-64 h-64 text-primary" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                                {event.status}
                            </span>
                            <span className="flex items-center text-muted-foreground text-sm">
                                <Calendar className="w-4 h-4 mr-1" />
                                {new Date(event.startDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center text-muted-foreground text-sm">
                                <MapPin className="w-4 h-4 mr-1" />
                                {event.location}
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">{event.name}</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl">{event.description}</p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-6 border-b border-border">
                {['overview', 'rounds', 'standings'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "pb-3 text-sm font-medium capitalize transition-all border-b-2",
                            activeTab === tab
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            <section className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-bold mb-4">About the Event</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    This is the flagship event of the season. Featuring top adjudicators and a prize pool of $500.
                                    The format follows standard British Parliamentary style with 5 preliminary rounds breaking to Quarter Finals.
                                </p>
                            </section>
                            <section className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-bold mb-4">Schedule</h3>
                                <div className="space-y-4">
                                    {rounds.map((round) => (
                                        <div key={round.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-border">
                                                    <Clock className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{round.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(round.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={cn(
                                                "text-xs font-bold px-2 py-1 rounded",
                                                round.status === 'COMPLETED' ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                                            )}>
                                                {round.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-primary/20 to-purple-600/10 border border-primary/20 rounded-xl p-6">
                                <h3 className="font-bold mb-2">Registration Status</h3>
                                <div className="flex items-center gap-2 text-green-400 mb-4">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-medium">Confirmed</span>
                                </div>
                                <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                                    Manage Team
                                </button>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="font-bold mb-4">Adjudication Core</h3>
                                <div className="space-y-3">
                                    {['Jane Doe (CA)', 'John Smith (DCA)', 'Alice Wong (DCA)'].map((person, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                                                {person.charAt(0)}
                                            </div>
                                            <span className="text-sm">{person}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'rounds' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {rounds.map((round) => (
                            <div key={round.id} className="p-6 rounded-xl bg-card border border-border">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold">{round.name}</h3>
                                        <p className="text-muted-foreground text-sm">
                                            {new Date(round.startTime).toLocaleString()}
                                        </p>
                                    </div>
                                    <button className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                                        View Draw
                                    </button>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/20 border border-border">
                                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Motion</span>
                                    <p className="text-lg font-medium mt-1">{round.motion}</p>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'standings' && (
                    <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Standings will be available after Round 1 results are published.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
