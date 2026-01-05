import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Calendar,
    MapPin,
    Users,
    Trophy,
    Clock,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { EventApi, RoundApi, CheckInApi } from "../../services/api";
import { cn } from "../../lib/utils";

export default function EventDetails() {
    const { id } = useParams();
    const { getToken } = useAuth();
    const [event, setEvent] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [checkingIn, setCheckingIn] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const token = await getToken();

                // Fetch event details from backend
                const eventResponse = await EventApi.get(id, token);
                if (eventResponse.success && eventResponse.event) {
                    setEvent(eventResponse.event);

                    // Rounds are included with the event
                    const eventRounds = eventResponse.event.rounds || [];
                    setRounds(eventRounds);
                } else {
                    setError("Event not found");
                }
            } catch (err) {
                console.error("Failed to fetch event details", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, getToken]);

    const handleCheckIn = async (roundId) => {
        try {
            setCheckingIn(true);
            const token = await getToken();
            await CheckInApi.checkIn(roundId, token);
            // Refresh the event data
            const eventResponse = await EventApi.get(id, token);
            if (eventResponse.success && eventResponse.event) {
                setRounds(eventResponse.event.rounds || []);
            }
        } catch (err) {
            console.error("Check-in failed", err);
            alert(err.message);
        } finally {
            setCheckingIn(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="max-w-2xl mx-auto text-center py-16">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
                <p className="text-muted-foreground mb-6">
                    {error || "The event you are looking for does not exist."}
                </p>
                <Link
                    to="/dashboard/events"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header / Breadcrumb */}
            <div>
                <Link
                    to="/dashboard/events"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tournaments
                </Link>
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Trophy className="w-64 h-64 text-primary" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-bold border",
                                    event.status === "ONGOING"
                                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                                        : event.status === "UPCOMING"
                                            ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                )}
                            >
                                {event.status}
                            </span>
                            <span className="flex items-center text-muted-foreground text-sm">
                                <Calendar className="w-4 h-4 mr-1" />
                                {new Date(event.startDate).toLocaleDateString()}
                                {event.endDate &&
                                    ` - ${new Date(
                                        event.endDate
                                    ).toLocaleDateString()}`}
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            {event.name}
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl">
                            {event.description || "No description available"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-6 border-b border-border">
                {["overview", "rounds", "standings"].map((tab) => (
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
                {activeTab === "overview" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid md:grid-cols-3 gap-6"
                    >
                        <div className="md:col-span-2 space-y-6">
                            <section className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-bold mb-4">
                                    About the Event
                                </h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {event.description ||
                                        "This debate competition features multiple rounds of competitive debating. Check back for more details about format and rules."}
                                </p>
                            </section>
                            <section className="bg-card border border-border rounded-xl p-6">
                                <h3 className="text-lg font-bold mb-4">
                                    Schedule ({rounds.length} Rounds)
                                </h3>
                                {rounds.length === 0 ? (
                                    <p className="text-muted-foreground">
                                        No rounds have been scheduled yet.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {rounds.map((round) => (
                                            <div
                                                key={round.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-border">
                                                        <Clock className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {round.name ||
                                                                `Round ${round.roundNumber}`}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {round.checkInStartTime
                                                                ? `Check-in: ${new Date(
                                                                    round.checkInStartTime
                                                                ).toLocaleTimeString(
                                                                    [],
                                                                    {
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    }
                                                                )}`
                                                                : "Time TBD"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "text-xs font-bold px-2 py-1 rounded",
                                                        round.status ===
                                                            "COMPLETED"
                                                            ? "bg-green-500/10 text-green-500"
                                                            : round.status ===
                                                                "ONGOING"
                                                                ? "bg-amber-500/10 text-amber-500"
                                                                : "bg-primary/10 text-primary"
                                                    )}
                                                >
                                                    {round.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-primary/20 to-purple-600/10 border border-primary/20 rounded-xl p-6">
                                <h3 className="font-bold mb-2">Event Status</h3>
                                <div className="flex items-center gap-2 text-green-400 mb-4">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-medium">
                                        {event.status}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {rounds.length} rounds scheduled
                                </p>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6">
                                <h3 className="font-bold mb-4">
                                    Event Information
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Start Date
                                        </span>
                                        <span className="font-medium">
                                            {new Date(
                                                event.startDate
                                            ).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {event.endDate && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                End Date
                                            </span>
                                            <span className="font-medium">
                                                {new Date(
                                                    event.endDate
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Total Rounds
                                        </span>
                                        <span className="font-medium">
                                            {rounds.length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === "rounds" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                    >
                        {rounds.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No rounds have been scheduled yet.</p>
                            </div>
                        ) : (
                            rounds.map((round) => (
                                <div
                                    key={round.id}
                                    className="p-6 rounded-xl bg-card border border-border"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold">
                                                {round.name ||
                                                    `Round ${round.roundNumber}`}
                                            </h3>
                                            <p className="text-muted-foreground text-sm">
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
                                                    "text-xs font-bold px-2 py-1 rounded",
                                                    round.status === "COMPLETED"
                                                        ? "bg-green-500/10 text-green-500"
                                                        : round.status ===
                                                            "ONGOING"
                                                            ? "bg-amber-500/10 text-amber-500"
                                                            : "bg-primary/10 text-primary"
                                                )}
                                            >
                                                {round.status}
                                            </span>
                                            {round.status === "ONGOING" && (
                                                <button
                                                    onClick={() =>
                                                        handleCheckIn(round.id)
                                                    }
                                                    disabled={checkingIn}
                                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {checkingIn
                                                        ? "Checking in..."
                                                        : "Check In"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {round.motion ? (
                                        <div className="p-4 rounded-lg bg-muted/20 border border-border">
                                            <span className="text-xs font-bold text-primary uppercase tracking-wider">
                                                Motion
                                            </span>
                                            <p className="text-lg font-medium mt-1">
                                                {round.motion}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-lg bg-muted/20 border border-border text-muted-foreground">
                                            Motion will be announced soon
                                        </div>
                                    )}

                                    {round.debates && round.debates.length > 0 ? (
                                        <div className="mt-6 space-y-3">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                <Users className="w-4 h-4" /> Pairings (Draw)
                                            </h4>
                                            <div className="grid gap-3">
                                                {round.debates.map((debate) => (
                                                    <div key={debate.id} className="p-3 rounded-lg bg-background border border-border flex items-center justify-between group hover:border-primary/50 transition-all">
                                                        <div className="flex-1 flex items-center gap-4">
                                                            <div className="text-right flex-1">
                                                                <p className="font-bold text-sm">{debate.debater1.firstName} {debate.debater1.lastName}</p>
                                                                <p className="text-xs text-muted-foreground">{debate.debater1.college}</p>
                                                            </div>
                                                            <div className="px-2 py-0.5 rounded bg-muted text-[10px] font-black italic text-muted-foreground">VS</div>
                                                            <div className="flex-1">
                                                                <p className="font-bold text-sm">{debate.debater2.firstName} {debate.debater2.lastName}</p>
                                                                <p className="text-xs text-muted-foreground">{debate.debater2.college}</p>
                                                            </div>
                                                        </div>
                                                        {debate.room && (
                                                            <div className="ml-4 flex items-center gap-1.5 px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                                                                <MapPin className="w-3 h-3" />
                                                                {debate.room.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        round.status !== 'UPCOMING' && (
                                            <div className="mt-6 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                                                <p className="text-sm text-amber-500 font-medium">Draw is being finalized and will be released shortly.</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))
                        )}
                    </motion.div>
                )}

                {activeTab === "standings" && (
                    <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl border-dashed">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>
                            Standings will be available after Round 1 results
                            are published.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
