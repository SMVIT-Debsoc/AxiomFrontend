import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
    Trophy,
    Search,
    ChevronRight,
    Loader2,
    Calendar,
    ArrowLeft,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi, RoundApi } from "../../services/api";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminResults() {
    const { getToken } = useAuth();
    const navigate = useNavigate();

    // Navigation State
    const [viewMode, setViewMode] = useState("events"); // 'events' | 'rounds' | 'results'
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedRound, setSelectedRound] = useState(null);

    // Data State
    const [events, setEvents] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [debates, setDebates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // --- 1. Fetch Events (Initial Load) ---
    useEffect(() => {
        if (viewMode === "events") {
            fetchEvents();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const response = await EventApi.list(token);
            if (response.success) {
                setEvents(response.events || []);
            }
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. Fetch Rounds (When Event Selected) ---
    const handleSelectEvent = async (event) => {
        setSelectedEvent(event);
        setViewMode("rounds");
        setLoading(true);
        try {
            const token = await getToken();
            const response = await RoundApi.listByEvent(event.id, token);
            if (response.success) {
                setRounds(response.rounds || []);
            }
        } catch (error) {
            console.error("Failed to fetch rounds:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 3. Fetch Results (When Round Selected) ---
    const handleSelectRound = async (round) => {
        setSelectedRound(round);
        setViewMode("results");
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/debates/round/${round.id}`,
                "GET",
                null,
                token
            );
            if (response.success) {
                setDebates(response.debates || []);
            }
        } catch (error) {
            console.error("Failed to fetch debates:", error);
        } finally {
            setLoading(false);
        }
    };

    // Back Navigation
    const handleBack = () => {
        setSearchQuery("");
        if (viewMode === "results") {
            setViewMode("rounds");
            setSelectedRound(null);
            setDebates([]);
        } else if (viewMode === "rounds") {
            setViewMode("events");
            setSelectedEvent(null);
            setRounds([]);
        }
    };

    // Filtering
    const filteredEvents = events.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredRounds = rounds.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredDebates = debates.filter(d =>
        !searchQuery ||
        d.debater1.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.debater2.firstName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Render Views ---

    const renderEvents = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
                <Motion.button
                    type="button"
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handleSelectEvent(event)}
                    className="w-full text-left cursor-pointer bg-card/70 border border-border/70 rounded-xl p-5 hover:border-primary/50 transition-all shadow-sm backdrop-blur-sm"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Trophy className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-sans border ${
                            event.status === 'ONGOING'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : event.status === 'COMPLETED'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                        }`}>
                            {event.status}
                        </span>
                    </div>
                    <h3 className="font-heading font-bold text-base mb-1 truncate text-foreground">{event.name}</h3>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-2 mb-4 h-8">
                        {event.description || "No description provided."}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground font-sans gap-4">
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            {new Date(event.startDate).toLocaleDateString()}
                        </span>
                    </div>
                </Motion.button>
            ))}
        </div>
    );

    const renderRounds = () => (
        <div className="space-y-3">
            {filteredRounds.length === 0 ? (
                <EmptyState compact icon={Trophy} title="No rounds yet" description="No rounds found for this tournament." />
            ) : (
                filteredRounds.map((round) => (
                    <Motion.button
                        type="button"
                        key={round.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleSelectRound(round)}
                        className="w-full text-left cursor-pointer bg-card/70 border border-border/70 p-4 rounded-xl hover:bg-muted/30 transition-all flex items-center justify-between group backdrop-blur-sm"
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm shrink-0">
                                {round.roundNumber}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-heading font-semibold text-sm text-foreground truncate">{round.name}</h4>
                                <p className="text-xs text-muted-foreground font-serif italic truncate">
                                    {round.motion ? `"${round.motion}"` : "No motion assigned"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                round.status === 'COMPLETED'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : round.status === 'ONGOING'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                    : 'bg-muted text-muted-foreground border-border'
                            }`}>
                                {round.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                        </div>
                    </Motion.button>
                ))
            )}
        </div>
    );

    const renderResults = () => (
        <>
            {/* Desktop View (Table) */}
            <div className="hidden md:block bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left" aria-label="Debate results list">
                        <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                            <tr>
                                <th scope="col" className="px-5 py-3.5">Matchup</th>
                                <th scope="col" className="px-5 py-3.5 text-center">Scores</th>
                                <th scope="col" className="px-5 py-3.5">Winner</th>
                                <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {filteredDebates.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-xs text-muted-foreground font-sans">
                                        No debates found.
                                    </td>
                                </tr>
                            ) : (
                                filteredDebates.map((debate) => (
                                    <tr key={debate.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5 text-sm font-sans font-medium text-foreground">
                                                <span className={debate.winnerId === debate.debater1Id ? "text-emerald-500 font-bold" : ""}>
                                                    {debate.debater1.firstName} {debate.debater1.lastName}
                                                </span>
                                                <span className="text-muted-foreground text-xs font-normal">vs</span>
                                                <span className={debate.winnerId === debate.debater2Id ? "text-emerald-500 font-bold" : ""}>
                                                    {debate.debater2.firstName} {debate.debater2.lastName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            {debate.status === 'COMPLETED' ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/50 border border-border/70 text-xs font-mono">
                                                    <span className={debate.winnerId === debate.debater1Id ? "text-emerald-500 font-bold" : ""}>
                                                        {debate.debater1Score}
                                                    </span>
                                                    <span className="text-muted-foreground">-</span>
                                                    <span className={debate.winnerId === debate.debater2Id ? "text-emerald-500 font-bold" : ""}>
                                                        {debate.debater2Score}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground font-sans italic">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {debate.winnerId ? (
                                                <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-emerald-500">
                                                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                                                    <span>{debate.winnerId === debate.debater1Id ? debate.debater1.firstName : debate.debater2.firstName}</span>
                                                </div>
                                            ) : <span className="text-xs text-muted-foreground font-sans">-</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => navigate(`/admin/results/${debate.id}`)}
                                                className="text-xs font-sans font-semibold text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5"
                                            >
                                                {debate.status === 'COMPLETED' ? "Edit Result" : "Enter Result"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-3">
                {filteredDebates.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground font-sans">No debates found.</div>
                ) : (
                    filteredDebates.map((debate) => (
                        <div key={debate.id} className="bg-card/70 border border-border/70 rounded-xl p-3.5 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                                    Debate #{debate.id.substring(0, 4)}
                                </span>
                                <span className={`text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    debate.status === 'COMPLETED'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }`}>
                                    {debate.status}
                                </span>
                            </div>

                            <div className="flex justify-between items-center font-sans">
                                <div className="flex-1 text-center">
                                    <p className={`text-xs font-medium truncate ${debate.winnerId === debate.debater1Id ? "text-emerald-500 font-bold" : "text-foreground"}`}>
                                        {debate.debater1.firstName}
                                    </p>
                                    {debate.status === 'COMPLETED' && (
                                        <p className="text-base font-mono font-bold mt-0.5">{debate.debater1Score}</p>
                                    )}
                                </div>
                                <div className="px-3 text-[10px] text-muted-foreground font-bold italic">VS</div>
                                <div className="flex-1 text-center">
                                    <p className={`text-xs font-medium truncate ${debate.winnerId === debate.debater2Id ? "text-emerald-500 font-bold" : "text-foreground"}`}>
                                        {debate.debater2.firstName}
                                    </p>
                                    {debate.status === 'COMPLETED' && (
                                        <p className="text-base font-mono font-bold mt-0.5">{debate.debater2Score}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/admin/results/${debate.id}`)}
                                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-sans font-semibold transition-colors"
                            >
                                {debate.status === 'COMPLETED' ? "Edit Result" : "Enter Result"}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div className="flex items-center gap-3">
                    {viewMode !== "events" && (
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Navigate back"
                        >
                            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
                                AXIOM 4.0
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                                {viewMode === "events"
                                    ? "Tournaments"
                                    : viewMode === "rounds"
                                    ? selectedEvent?.name
                                    : `${selectedEvent?.name} • Round ${selectedRound?.roundNumber}`}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                            {viewMode === "events"
                                ? "Results Command"
                                : viewMode === "rounds"
                                ? `${selectedEvent?.name} Rounds`
                                : `${selectedRound?.name} Matchup Results`}
                        </h1>
                        <p className="text-xs md:text-sm text-muted-foreground font-sans mt-0.5">
                            {viewMode === "events"
                                ? "Browse tournaments to inspect debater scores and final adjudications"
                                : viewMode === "rounds"
                                ? "Select a round to view debate scoring details"
                                : "Review ballots, edit scores, and confirm declared winners"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                    type="text"
                    placeholder={`Search ${viewMode}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={`Search ${viewMode}`}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
                />
            </div>

            {/* Dynamic Content */}
            {loading ? (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading results" />
                </div>
            ) : (
                <>
                    {viewMode === "events" && renderEvents()}
                    {viewMode === "rounds" && renderRounds()}
                    {viewMode === "results" && renderResults()}
                </>
            )}
        </div>
    );
}
