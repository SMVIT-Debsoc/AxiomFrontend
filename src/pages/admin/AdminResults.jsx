import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Trophy,
    Search,
    ChevronRight,
    Loader2,
    Calendar,
    ArrowLeft,
    List
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi, RoundApi } from "../../services/api";

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
                <motion.div
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleSelectEvent(event)}
                    className="cursor-pointer bg-card border border-border rounded-xl p-5 hover:border-purple-500/50 transition-all shadow-sm"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${event.status === 'ONGOING' ? 'bg-green-500/10 text-green-500' :
                                event.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
                            }`}>
                            {event.status}
                        </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate">{event.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                        {event.description || "No description provided."}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground gap-4">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.startDate).toLocaleDateString()}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );

    const renderRounds = () => (
        <div className="space-y-4">
            {filteredRounds.length === 0 ? (
                <div className="text-center py-12 bg-muted/5 rounded-xl border border-dashed border-border">
                    <p className="text-muted-foreground">No rounds found for this event.</p>
                </div>
            ) : (
                filteredRounds.map((round) => (
                    <motion.div
                        key={round.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleSelectRound(round)}
                        className="cursor-pointer bg-card border border-border p-4 rounded-xl hover:bg-muted/30 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold">
                                {round.roundNumber}
                            </div>
                            <div>
                                <h4 className="font-bold text-base">{round.name}</h4>
                                <p className="text-xs text-muted-foreground italic">"{round.motion}"</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${round.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' :
                                    round.status === 'ONGOING' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
                                }`}>
                                {round.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </div>
                    </motion.div>
                ))
            )}
        </div>
    );

    const renderResults = () => (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                        <tr>
                            <th className="px-6 py-4 text-left">Matchup</th>
                            <th className="px-6 py-4 text-center">Scores</th>
                            <th className="px-6 py-4 text-left">Winner</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredDebates.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-8 text-muted-foreground">No debates found.</td></tr>
                        ) : (
                            filteredDebates.map((debate) => (
                                <tr key={debate.id} className="hover:bg-muted/10">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3 text-sm font-medium">
                                            <span className={debate.winnerId === debate.debater1Id ? "text-green-500 font-bold" : ""}>
                                                {debate.debater1.firstName} {debate.debater1.lastName}
                                            </span>
                                            <span className="text-muted-foreground text-xs">VS</span>
                                            <span className={debate.winnerId === debate.debater2Id ? "text-green-500 font-bold" : ""}>
                                                {debate.debater2.firstName} {debate.debater2.lastName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {debate.status === 'COMPLETED' ? (
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50 border border-border text-xs font-mono">
                                                <span className={debate.winnerId === debate.debater1Id ? "text-green-500 font-bold" : ""}>
                                                    {debate.debater1Score}
                                                </span>
                                                <span className="text-muted-foreground">-</span>
                                                <span className={debate.winnerId === debate.debater2Id ? "text-green-500 font-bold" : ""}>
                                                    {debate.debater2Score}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground italic">Pending</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {debate.winnerId ? (
                                            <div className="flex items-center gap-2 text-sm font-bold text-green-600">
                                                <Trophy className="w-3 h-3" />
                                                {debate.winnerId === debate.debater1Id ? debate.debater1.firstName : debate.debater2.firstName}
                                            </div>
                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => navigate(`/admin/results/${debate.id}`)}
                                            className="text-xs font-bold text-purple-500 hover:text-purple-600 px-3 py-1 bg-purple-500/10 rounded hover:bg-purple-500/20 transition-colors"
                                        >
                                            {debate.status === 'COMPLETED' ? 'Edit' : 'Enter'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span className={viewMode === 'events' ? "text-foreground font-medium" : ""}>Events</span>
                    {viewMode !== 'events' && (
                        <>
                            <ChevronRight className="w-4 h-4" />
                            <span className={viewMode === 'rounds' ? "text-foreground font-medium" : ""}>
                                {selectedEvent?.name}
                            </span>
                        </>
                    )}
                    {viewMode === 'results' && (
                        <>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-foreground font-medium">Round {selectedRound?.roundNumber}</span>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {viewMode !== 'events' && (
                            <button onClick={handleBack} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-3xl font-bold">
                            {viewMode === 'events' ? 'Results & Scores' :
                                viewMode === 'rounds' ? 'Select Round' :
                                    `${selectedRound?.name} Results`}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder={`Search ${viewMode}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border focus:border-purple-500 outline-none transition-all"
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : (
                <>
                    {viewMode === 'events' && renderEvents()}
                    {viewMode === 'rounds' && renderRounds()}
                    {viewMode === 'results' && renderResults()}
                </>
            )}
        </div>
    );
}
