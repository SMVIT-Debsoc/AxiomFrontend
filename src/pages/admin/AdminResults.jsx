import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
    Trophy,
    Search,
    ChevronRight,
    Calendar,
    ArrowLeft,
    ClipboardList,
    Medal,
} from "lucide-react";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import { useAuth } from "../../auth/client.jsx";
import { AdminApi, EventApi, RoundApi } from "../../services/api";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import { SocketEvents, useEventSocket, useRoundSocket, useLiveRefresh } from "../../hooks/useSocket";
import { useDebouncedCallback, useLatestRequest, useSocketRefresh } from "../../hooks/useAdminRealtime";

import { AreaHeader, AreaTabs } from "../../components/ops/AreaHeader";
import { useAreaTab } from "../../components/ops/useAreaTab";

const AdminLeaderboard = lazy(() => import("./AdminLeaderboard"));

const RESULTS_TABS = [
    { key: "results", label: "Ballots", icon: ClipboardList },
    { key: "standings", label: "Standings", icon: Medal },
];

export default function AdminResults() {
    const { getToken } = useAuth();
    const navigate = useNavigate();
    // ?tab=standings (legacy ?tab=leaderboard still works)
    const [activeTab, setActiveTab] = useAreaTab(RESULTS_TABS, { aliases: { leaderboard: "standings" } });

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

    const [loadError, setLoadError] = useState(null);
    const latest = useLatestRequest();
    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    // One loader for every drill-down level. Each call supersedes (and aborts)
    // the previous one, so clicking quickly between events/rounds can never
    // show the rounds or ballots of a tournament that is no longer selected.
    const loadView = useCallback(async (mode, target, { silent = false, skipCache = false } = {}) => {
        const request = latest.begin();
        if (!silent) setLoading(true);
        try {
            const token = await getTokenRef.current();
            const options = { skipCache, signal: request.signal };
            let response;
            if (mode === "events") response = await EventApi.list(token, null, options);
            else if (mode === "rounds") response = await RoundApi.listByEvent(target.id, token, options);
            else response = await AdminApi.apiRequest(`/debates/round/${target.id}`, "GET", null, token, options);
            if (!latest.isCurrent(request.id)) return;
            if (response.success) {
                if (mode === "events") setEvents(response.events || []);
                else if (mode === "rounds") setRounds(response.rounds || []);
                else setDebates(response.debates || []);
            }
            setLoadError(null);
        } catch (error) {
            if (!latest.isCurrent(request.id)) return;
            console.error(`Failed to fetch ${mode}:`, error);
            setLoadError({ mode, silent, message: error?.message || "Request failed" });
        } finally {
            if (latest.isCurrent(request.id)) setLoading(false);
        }
    }, [latest]);

    // --- 1. Fetch Events (Initial Load) ---
    useEffect(() => {
        if (viewMode === "events") loadView("events");
    }, [viewMode, loadView]);

    // --- 2. Fetch Rounds (When Event Selected) ---
    const handleSelectEvent = (event) => {
        setSelectedEvent(event);
        setRounds([]);
        setViewMode("rounds");
        loadView("rounds", event);
    };

    // --- 3. Fetch Results (When Round Selected) ---
    const handleSelectRound = (round) => {
        setSelectedRound(round);
        setDebates([]);
        setViewMode("results");
        loadView("results", round);
    };

    const currentTarget = viewMode === "rounds" ? selectedEvent : viewMode === "results" ? selectedRound : null;
    const retryCurrent = () => loadView(viewMode, currentTarget, { skipCache: true });

    // Live refresh of whichever level is on screen; bursts collapse into one read.
    const refreshCurrent = useDebouncedCallback(() => {
        if (activeTab !== "results") return;
        loadView(viewMode, currentTarget, { silent: true, skipCache: true });
    }, 500);
    useSocketRefresh(
        [SocketEvents.EVENT_CREATED, SocketEvents.EVENT_UPDATED_GLOBAL, SocketEvents.EVENT_DELETED_GLOBAL],
        refreshCurrent,
        { delay: 0, enabled: viewMode === "events" },
    );
    const roundsCallbacks = {
        onRoundCreated: refreshCurrent,
        onRoundUpdated: refreshCurrent,
        onRoundDeleted: refreshCurrent,
        onRoundStatusChange: refreshCurrent,
        onResultsPublished: refreshCurrent,
        onPairingsPublished: refreshCurrent,
    };
    useEventSocket(viewMode === "rounds" ? selectedEvent?.id : null, roundsCallbacks);
    const resultsCallbacks = {
        onDebateResult: refreshCurrent,
        onDebateCreated: refreshCurrent,
        onDebateUpdated: refreshCurrent,
        onDebateDeleted: refreshCurrent,
        onPairingsGenerated: refreshCurrent,
        onRoomsAllocated: refreshCurrent,
        onResultsPublished: refreshCurrent,
    };
    useRoundSocket(viewMode === "results" ? selectedRound?.id : null, resultsCallbacks);
    useLiveRefresh(refreshCurrent, {
        eventId: viewMode === "rounds" ? selectedEvent?.id : undefined,
        roundId: viewMode === "results" ? selectedRound?.id : undefined,
        jitterMs: 3000,
        invalidateCache: false,
    });

    // Back Navigation
    const handleBack = () => {
        setSearchQuery("");
        // Drop any in-flight load for the level being left.
        latest.begin();
        setLoading(false);
        setLoadError(null);
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

    const renderEvents = () => filteredEvents.length === 0 ? (
        <EmptyState
            compact
            icon={Trophy}
            title={searchQuery ? "Nothing matched" : "No tournaments yet"}
            description={searchQuery ? "No tournaments matched your search." : "Tournaments appear here once created."}
        />
    ) : (
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
                                ? 'ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35'
                                : event.status === 'COMPLETED'
                                ? 'ax-signal-info bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 border-indigo-500/35'
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
                                    ? 'ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35'
                                    : round.status === 'ONGOING'
                                    ? 'ax-signal-info bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 border-indigo-500/35'
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
                <div className="overflow-x-auto">
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
                                                <span className={
                                                    debate.winnerId
                                                        ? debate.winnerId === debate.debater1Id
                                                            ? "ax-chip--win px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 font-bold border border-emerald-500/40"
                                                            : "ax-chip--loss px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-200 font-semibold border border-rose-500/35"
                                                        : ""
                                                }>
                                                    {debate.debater1.firstName} {debate.debater1.lastName}
                                                </span>
                                                <span className="text-muted-foreground text-xs font-normal">vs</span>
                                                <span className={
                                                    debate.winnerId
                                                        ? debate.winnerId === debate.debater2Id
                                                            ? "ax-chip--win px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 font-bold border border-emerald-500/40"
                                                            : "ax-chip--loss px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-200 font-semibold border border-rose-500/35"
                                                        : ""
                                                }>
                                                    {debate.debater2.firstName} {debate.debater2.lastName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            {debate.status === 'COMPLETED' ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/50 border border-border/70 text-xs font-mono">
                                                    <span className={debate.winnerId === debate.debater1Id ? "text-emerald-600 dark:text-emerald-300 font-bold" : ""}>
                                                        {debate.debater1Score}
                                                    </span>
                                                    <span className="text-muted-foreground">-</span>
                                                    <span className={debate.winnerId === debate.debater2Id ? "text-emerald-600 dark:text-emerald-300 font-bold" : ""}>
                                                        {debate.debater2Score}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="ax-signal-warn inline-flex px-2 py-0.5 rounded border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 text-[10px] font-sans font-semibold">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {debate.winnerId ? (
                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border border-emerald-500/35 text-xs font-heading font-bold">
                                                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                                                    <span>{debate.winnerId === debate.debater1Id ? debate.debater1.firstName : debate.debater2.firstName}</span>
                                                </div>
                                            ) : <span className="text-xs text-muted-foreground font-sans">-</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/admin/results/${debate.id}`)}
                                                className="min-h-11 px-3 py-2 text-xs font-sans font-semibold text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
                                        ? 'ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35'
                                        : 'ax-signal-warn bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/40'
                                }`}>
                                    {debate.status}
                                </span>
                            </div>

                            <div className="flex justify-between items-center font-sans gap-2">
                                <div className={`flex-1 text-center p-2 rounded-lg transition-colors ${
                                    debate.winnerId
                                        ? debate.winnerId === debate.debater1Id
                                            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-200 font-bold"
                                            : "bg-rose-500/15 border border-rose-500/35 text-rose-700 dark:text-rose-200 font-medium"
                                        : "text-foreground"
                                }`}>
                                    <p className="text-xs truncate font-medium">
                                        {debate.debater1.firstName} {debate.winnerId && (debate.winnerId === debate.debater1Id ? "✓" : "✗")}
                                    </p>
                                    {debate.status === 'COMPLETED' && (
                                        <p className="text-base font-mono font-bold mt-0.5">{debate.debater1Score}</p>
                                    )}
                                </div>
                                <div className="px-1 text-[10px] text-muted-foreground font-bold italic shrink-0">VS</div>
                                <div className={`flex-1 text-center p-2 rounded-lg transition-colors ${
                                    debate.winnerId
                                        ? debate.winnerId === debate.debater2Id
                                            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-200 font-bold"
                                            : "bg-rose-500/15 border border-rose-500/35 text-rose-700 dark:text-rose-200 font-medium"
                                        : "text-foreground"
                                }`}>
                                    <p className="text-xs truncate font-medium">
                                        {debate.debater2.firstName} {debate.winnerId && (debate.winnerId === debate.debater2Id ? "✓" : "✗")}
                                    </p>
                                    {debate.status === 'COMPLETED' && (
                                        <p className="text-base font-mono font-bold mt-0.5">{debate.debater2Score}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate(`/admin/results/${debate.id}`)}
                                className="w-full min-h-11 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-sans font-semibold transition-colors"
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
        <div className="mx-auto max-w-[1180px] space-y-4 font-sans">
            <AreaHeader
                eyebrow={activeTab === "standings"
                    ? "Standings"
                    : viewMode === "events"
                    ? "All events"
                    : viewMode === "rounds"
                    ? selectedEvent?.name
                    : `${selectedEvent?.name} · Round ${selectedRound?.roundNumber}`}
                title="Results"
                description={activeTab === "standings"
                    ? "Debater rankings across the event."
                    : viewMode === "events"
                    ? "Pick an event, then a round, to check or correct ballots."
                    : viewMode === "rounds"
                    ? "Pick a round to see its ballots."
                    : `${selectedRound?.name || "Round"}: check ballots and correct scores.`}
                className="!mb-3"
            />
            <div className="flex flex-wrap items-center gap-2">
                {activeTab === "results" && viewMode !== "events" && (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="ax-ghost-btn mb-4 !min-h-11"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
                    </button>
                )}
                <AreaTabs tabs={RESULTS_TABS} active={activeTab} onChange={setActiveTab} label="Results sections" />
            </div>

            {activeTab === "standings" ? (
                <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh]"><LoadingIndicator label="Loading standings leaderboard" /></div>}>
                    <AdminLeaderboard embedded />
                </Suspense>
            ) : (
                <>
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder={`Search ${viewMode}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label={`Search ${viewMode}`}
                            className="w-full min-h-11 pl-9 pr-4 py-2 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
                        />
                    </div>

                    {/* Dynamic Content */}
                    {loading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <LoadingIndicator label="Loading tournament results" />
                        </div>
                    ) : loadError && loadError.mode === viewMode && !loadError.silent ? (
                        <LoadError
                            message={
                                viewMode === "events"
                                    ? "Could not load tournaments."
                                    : viewMode === "rounds"
                                    ? "Could not load rounds for this tournament."
                                    : "Could not load results for this round."
                            }
                            detail={loadError.message}
                            onRetry={retryCurrent}
                        />
                    ) : (
                        <>
                            {loadError && loadError.mode === viewMode && loadError.silent && (
                                <LoadError compact message="Could not refresh. Showing the last loaded data." onRetry={retryCurrent} />
                            )}
                            {viewMode === "events" && renderEvents()}
                            {viewMode === "rounds" && renderRounds()}
                            {viewMode === "results" && renderResults()}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
