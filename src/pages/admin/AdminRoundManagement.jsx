import ModalSurface from "../../components/ui/ModalSurface";
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
    Users,
    Activity,
    MapPin,
    Loader2,
    ArrowLeft,
    Clock,
    Dice5,
    Zap,
    Home,
    Search,
    Trophy,
    RotateCcw,
    ShieldCheck,
    CheckCircle2,
    X,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { cn } from "../../lib/utils";
import { AdminApi, EventApi } from "../../services/api";
import { useRoundSocket } from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast";
import { UserAvatar } from "../../components/ui/UserAvatar";
import {toLocalDateTime} from "../../lib/datetime";

export default function AdminRoundManagement() {
    const { id: roundId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [pendingFetch, setLoading] = useState(true);
    const [loadedRoundId, setLoadedRoundId] = useState(null);
    const loading = pendingFetch || loadedRoundId !== roundId;
    const [actionLoading, setActionLoading] = useState({
        publishing: false,
        generating: false,
        allocating: false,
    });
    const [activeTab, setActiveTab] = useState("checkins");
    const [allocationRoundId, setAllocationRoundId] = useState(null);
    const showAllocateModal = allocationRoundId === roundId;
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState(null);
    const debounceTimers = useRef({});

    // Store getToken in a ref so it never triggers re-renders or re-memos
    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

    const fetchGeneration = useRef(0);
    const activeRoundId = useRef(roundId);

    useLayoutEffect(() => {
        activeRoundId.current = roundId;
    }, [roundId]);

    // fetchRoundData uses a ref for getToken so it's never a dependency
    const fetchRoundData = useCallback(async (isBackground = false) => {
        if (activeRoundId.current !== roundId) return;
        const generation = ++fetchGeneration.current;
        if (!isBackground) setLoading(true);
        try {
            const token = await getTokenRef.current();
            if (generation !== fetchGeneration.current) return;
            const roundRes = await AdminApi.apiRequest(`/rounds/${roundId}`, "GET", null, token);
            if (generation !== fetchGeneration.current) return;
            if (roundRes.success) {
                const fetchedRound = roundRes.round;
                const [roomsRes, participantsRes] = await Promise.all([
                    AdminApi.apiRequest("/rooms", "GET", null, token),
                    EventApi.getParticipants(fetchedRound.eventId, token),
                ]);
                if (generation !== fetchGeneration.current) return;
                setRound(fetchedRound);
                setCheckIns(fetchedRound.checkIns || []);
                setDebates(fetchedRound.debates || []);
                setRooms(roomsRes.success ? roomsRes.rooms || [] : []);
                setUsers(participantsRes.success ? participantsRes.participants || [] : []);
            }
        } catch {
            if (generation === fetchGeneration.current) toast.error("Error", "Failed to load round data");
        } finally {
            if (generation === fetchGeneration.current) {
                setLoadedRoundId(roundId);
                setLoading(false);
            }
        }
    }, [roundId, toast]);

    useEffect(() => {
        const generationRef = fetchGeneration;
        const timeoutRef = fetchTimeoutRef;
        fetchRoundData();
        return () => {
            ++generationRef.current;
            clearTimeout(timeoutRef.current);
        };
    }, [fetchRoundData]);

    // Debounced fetch for socket updates to prevent spam
    const fetchTimeoutRef = useRef(null);
    const debouncedFetch = useCallback(() => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
            fetchRoundData(true);
        }, 300);
    }, [fetchRoundData]);

    // Real-time updates via WebSocket
    useRoundSocket(roundId, {
        onCheckInUpdate: (data) => {
            setCheckIns((prev) => {
                const existing = prev.find((ci) => ci.userId === data.userId);
                if (existing) {
                    return prev.map((ci) =>
                        ci.userId === data.userId ? { ...ci, status: data.status } : ci
                    );
                }
                debouncedFetch();
                return prev;
            });
        },
        onPairingsGenerated: (data) => {
            if (data.debates) {
                setDebates(data.debates);
            } else {
                debouncedFetch();
            }
        },
        onRoomsAllocated: () => {
            debouncedFetch();
        },
        onDebateResult: (data) => {
            setDebates((prev) =>
                prev.map((d) =>
                    d.id === data.debateId
                        ? {
                            ...d,
                            winnerId: data.winnerId,
                            debater1Score: data.debater1Score,
                            debater2Score: data.debater2Score,
                            status: "COMPLETED",
                        }
                        : d
                )
            );
        },
        onRoundStatusChange: (data) => {
            setRound((prev) =>
                prev ? { ...prev, status: data.status, ...data } : prev
            );
        },
        onPairingsPublished: (data) => {
            setRound((prev) =>
                prev ? { ...prev, pairingsPublished: data.published } : prev
            );
        },
        onRoundUpdated: (data) => {
            if (data.round) {
                setRound((prev) => ({ ...prev, ...data.round }));
            }
        },
    });

    const handleGeneratePairings = async (type) => {
        const confirmMessage =
            debates.length > 0
                ? "Regenerate pairings? This will DELETE all existing pairings/debates found in this round (except completed ones). This action cannot be undone."
                : `Generate ${type} pairings? This will end the check-in period.`;

        if (!confirm(confirmMessage)) return;

        setActionLoading(prev => ({ ...prev, generating: true }));
        try {
            const token = await getToken();
            const endpoint =
                type === "round1"
                    ? `/pairing/${roundId}/round1`
                    : `/pairing/${roundId}/power-match`;
            const response = await AdminApi.apiRequest(endpoint, "POST", null, token);
            if (activeRoundId.current !== roundId) return;
            if (response.success) {
                const eliminatedMsg = response.data.eliminated
                    ? ` (${response.data.eliminated} users eliminated based on losses)`
                    : "";
                toast.success(
                    "Pairings Generated",
                    `Successfully generated ${response.data.pairingsCreated} pairings!${eliminatedMsg}`
                );
                await fetchRoundData();
                setActiveTab("debates");
            } else {
                toast.error(
                    "Generation Failed",
                    response.error || "Failed to generate pairings"
                );
            }
        } catch {
            toast.error("Error", "Error generating pairings");
        } finally {
            setActionLoading(prev => ({ ...prev, generating: false }));
        }
    };

    const handleAllocateRooms = async (formData) => {
        setActionLoading(prev => ({ ...prev, allocating: true }));
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/pairing/${roundId}/allocate-rooms`,
                "POST",
                formData,
                token
            );
            if (activeRoundId.current !== roundId) return;

            if (response.success) {
                toast.success(
                    "Rooms Allocated",
                    `Allocated rooms for ${response.data?.debatesAllocated || 0} debates.`
                );

                if (response.data?.debates) {
                    setDebates(response.data.debates);
                } else {
                    fetchRoundData(true);
                }

                setAllocationRoundId(null);
            } else {
                toast.error(
                    "Allocation Failed",
                    response.error || "Failed to allocate rooms"
                );
            }
        } catch {
            toast.error("Error", "Error allocating rooms");
        } finally {
            setActionLoading(prev => ({ ...prev, allocating: false }));
        }
    };

    const handleManualCheckIn = async (userId, currentStatus) => {
        if (processingId) return;
        setProcessingId(userId);
        const newStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/check-in/round/${roundId}/user/${userId}`,
                "PUT",
                { status: newStatus },
                token
            );
            if (activeRoundId.current !== roundId) return;
            if (response.success) {
                setCheckIns((prev) => {
                    const exists = prev.find((ci) => ci.userId === userId);
                    if (exists) {
                        return prev.map((ci) =>
                            ci.userId === userId ? { ...ci, status: newStatus } : ci
                        );
                    } else {
                        return [...prev, { userId, status: newStatus }];
                    }
                });
                toast.success("Check-in Updated", `User marked as ${newStatus}`);
            }
        } catch {
            toast.error("Error", "Failed to update check-in status");
        } finally {
            setProcessingId(null);
        }
    };

    const handleAssignJudge = (debateId, judgeName) => {
        setDebates((prev) =>
            prev.map((d) =>
                d.id === debateId
                    ? {
                        ...d,
                        judgeName,
                        adjudicatorId: null,
                        adjudicator: null,
                    }
                    : d
            )
        );

        if (debounceTimers.current[debateId]) {
            clearTimeout(debounceTimers.current[debateId]);
        }

        debounceTimers.current[debateId] = setTimeout(async () => {
            try {
                const token = await getToken();
                const response = await AdminApi.apiRequest(
                    `/debates/${debateId}`,
                    "PUT",
                    { judgeName },
                    token
                );

                if (!response.success) {
                    toast.error(
                        "Assignment Failed",
                        response.error || "Failed to save judge name"
                    );
                }
            } catch {
                toast.error("Error", "Error assigning judge");
            }
        }, 500);
    };

    const handleTogglePublish = async () => {
        setActionLoading(prev => ({ ...prev, publishing: true }));
        try {
            const token = await getToken();
            const newStatus = !round.pairingsPublished;
            const response = await AdminApi.apiRequest(
                `/rounds/${roundId}`,
                "PUT",
                { pairingsPublished: newStatus },
                token
            );
            if (activeRoundId.current !== roundId) return;
            if (response.success) {
                setRound({ ...round, pairingsPublished: newStatus });
                toast.success(
                    "Visibility Updated",
                    newStatus
                        ? "Pairings are now visible to debaters!"
                        : "Pairings are now hidden from debaters."
                );
            }
        } catch {
            toast.error("Error", "Failed to toggle publish status");
        } finally {
            setActionLoading(prev => ({ ...prev, publishing: false }));
        }
    };

    const allParticipants = useMemo(() => {
        const merged = [...users];
        checkIns.forEach(ci => {
            if (ci.user && !merged.find(u => u.id === ci.userId)) {
                merged.push(ci.user);
            }
        });
        return merged;
    }, [users, checkIns]);

    const filteredParticipants = useMemo(() => {
        return allParticipants.filter((user) =>
            !searchTerm ||
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.college?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allParticipants, searchTerm]);

    if (loading && (!round || round.id !== roundId)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading round management" />
            </div>
        );
    }

    if (!round || round.id !== roundId) return <div className="text-center py-20 font-sans text-muted-foreground">Round not found</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="axiom-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border/60 pb-5">
                <div className="flex items-start gap-3.5">
                    <button
                        onClick={() => navigate(`/admin/events/${round.eventId}`)}
                        className="p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 mt-0.5"
                        title="Back to Tournament"
                        aria-label="Back to tournament"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
                                AXIOM 4.0
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                                Round {round.roundNumber}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">{round.name}</h1>
                        <p className="text-xs md:text-sm text-muted-foreground font-sans mt-0.5">
                            Tournament Round {round.roundNumber} Orchestration
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => fetchRoundData()}
                        disabled={loading}
                        className="p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Refresh Data"
                        aria-label="Refresh round data"
                    >
                        <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} aria-hidden="true" />
                    </button>
                    {debates.length > 0 && (
                        <button
                            onClick={handleTogglePublish}
                            disabled={loading || actionLoading.publishing}
                            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg font-sans font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${round.pairingsPublished
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : "bg-amber-500 text-primary-foreground hover:bg-amber-600 shadow-sm"
                                }`}
                        >
                            {actionLoading.publishing ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Users className="w-4 h-4" aria-hidden="true" />
                            )}
                            <span>{round.pairingsPublished ? "Draw Public" : "Publish Draw"}</span>
                        </button>
                    )}

                    {debates.length === 0 ? (
                        <button
                            onClick={() =>
                                handleGeneratePairings(
                                    round.roundNumber === 1 ? "round1" : "power-match"
                                )
                            }
                            disabled={loading || actionLoading.generating}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {actionLoading.generating ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : round.roundNumber === 1 ? (
                                <Dice5 className="w-4 h-4" aria-hidden="true" />
                            ) : (
                                <Zap className="w-4 h-4" aria-hidden="true" />
                            )}
                            <span>Generate Pairings</span>
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setAllocationRoundId(roundId)}
                                disabled={loading || actionLoading.allocating}
                                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {actionLoading.allocating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Home className="w-4 h-4" aria-hidden="true" />
                                )}
                                <span>Allocate Rooms</span>
                            </button>
                            <button
                                onClick={() => navigate(`/admin/rounds/${roundId}/promotion`)}
                                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-card text-foreground border border-border font-sans font-medium text-xs hover:bg-muted transition-colors w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                                <span>Review & Promote</span>
                            </button>
                            <button
                                onClick={() =>
                                    handleGeneratePairings(
                                        round.roundNumber === 1 ? "round1" : "power-match"
                                    )
                                }
                                disabled={loading || actionLoading.generating}
                                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-sans font-medium text-xs hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {actionLoading.generating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                                )}
                                <span>Regenerate</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showAllocateModal && (
                <AllocateRoomsModal
                    onClose={() => setAllocationRoundId(null)}
                    onConfirm={handleAllocateRooms}
                    totalDebates={debates.length}
                    rooms={rooms}
                    loading={loading}
                />
            )}

            {/* Round Details Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 bg-card/70 border border-border/70 rounded-xl p-5 md:p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        <Activity className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        <span>Debate Motion</span>
                    </div>
                    {round.motion ? (
                        <p className="text-base md:text-lg font-serif italic border-l-2 border-primary pl-4 py-1 text-foreground leading-relaxed">
                            "{round.motion}"
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground italic font-sans">
                            No motion assigned for this round yet.
                        </p>
                    )}
                </div>

                <div className="bg-card/70 border border-border/70 rounded-xl p-5 md:p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        <span>Check-in Window</span>
                    </div>
                    <div className="space-y-3 font-sans">
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                                Starts
                            </p>
                            <p className="text-xs font-medium text-foreground">
                                {new Date(round.checkInStartTime).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                })}{" "}
                                IST
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                                Ends
                            </p>
                            <p className="text-xs font-medium text-foreground">
                                {new Date(round.checkInEndTime).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                })}{" "}
                                IST
                            </p>
                        </div>
                        <div className="pt-1">
                            <span
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${new Date() > new Date(round.checkInEndTime)
                                        ? "bg-destructive/10 text-destructive border-destructive/20"
                                        : new Date() < new Date(round.checkInStartTime)
                                            ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    }`}
                            >
                                {new Date() > new Date(round.checkInEndTime)
                                    ? "Window Closed"
                                    : new Date() < new Date(round.checkInStartTime)
                                        ? "Window Not Open"
                                        : "Window Open"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/70 gap-3 pb-0" role="group" aria-label="Round views and search">
                <div className="flex overflow-x-auto pb-1 md:pb-0 no-scrollbar gap-1">
                    <button
                        aria-pressed={activeTab === "checkins"}
                        onClick={() => setActiveTab("checkins")}
                        className={cn(
                            "px-4 py-3 font-sans text-xs font-semibold transition-all border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activeTab === "checkins"
                                ? "border-primary text-primary bg-primary/5"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Check-ins ({checkIns.length})
                    </button>
                    <button
                        aria-pressed={activeTab === "debates"}
                        onClick={() => setActiveTab("debates")}
                        className={cn(
                            "px-4 py-3 font-sans text-xs font-semibold transition-all border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activeTab === "debates"
                                ? "border-primary text-primary bg-primary/5"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Debates ({debates.length})
                    </button>
                    <button
                        aria-pressed={activeTab === "results"}
                        onClick={() => setActiveTab("results")}
                        className={cn(
                            "px-4 py-3 font-sans text-xs font-semibold transition-all border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activeTab === "results"
                                ? "border-primary text-primary bg-primary/5"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Results
                    </button>
                </div>
                <div className="relative group px-1 pb-2 md:pb-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab === "checkins"
                                ? "participants"
                                : activeTab === "results"
                                    ? "results"
                                    : "debates"
                            }...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-3 py-1.5 bg-card/70 border border-border/70 rounded-lg text-xs font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all w-full md:w-60 placeholder:text-muted-foreground/60"
                    />
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === "checkins" && (
                <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="p-3.5 bg-muted/30 border-b border-border/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-4 text-xs font-sans font-semibold text-muted-foreground">
                            <span>Total Debaters: {Math.max(users.length, checkIns.length)}</span>
                            <span className="text-emerald-500">
                                Present: {checkIns.filter((c) => c.status === "PRESENT").length}
                            </span>
                            <span className="text-destructive">
                                Absent:{" "}
                                {Math.max(users.length, checkIns.length) -
                                    checkIns.filter((c) => c.status === "PRESENT").length}
                            </span>
                        </div>
                    </div>
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                        <table className="w-full text-left" aria-label="Participant check-ins">
                            <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Participant</th>
                                    <th scope="col" className="px-5 py-3 whitespace-nowrap">Institution</th>
                                    <th scope="col" className="px-5 py-3 whitespace-nowrap">Check-in Status</th>
                                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredParticipants.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-10 text-center text-xs text-muted-foreground font-sans">
                                            {loading ? "Loading participants..." : "No matching participants found."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredParticipants.slice(0, 500).map((user) => {
                                        const checkIn = checkIns.find((ci) => ci.userId === user.id);
                                        const status = checkIn?.status || "ABSENT";

                                        return (
                                            <tr key={user.id} className={status === "ABSENT" ? "bg-destructive/[0.02]" : ""}>
                                                <td className="px-5 py-3.5">
                                                    <p className="font-sans font-semibold text-sm text-foreground">
                                                        {user.firstName} {user.lastName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-sans">
                                                        {user.email}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-muted-foreground font-sans">
                                                    {user.college || "N/A"}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${status === "PRESENT"
                                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                                                }`}
                                                        >
                                                            {status}
                                                        </span>
                                                        {!checkIn && (
                                                            <span className="text-[10px] text-muted-foreground font-sans italic">
                                                                (Pending)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <button
                                                        onClick={() =>
                                                            handleManualCheckIn(user.id, status)
                                                        }
                                                        disabled={processingId === user.id}
                                                        className="text-xs font-sans font-semibold text-primary hover:underline transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                    >
                                                        {processingId === user.id && (
                                                            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                                                        )}
                                                        Mark {status === "PRESENT" ? "Absent" : "Present"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View (Cards) */}
                    <div className="md:hidden space-y-3 p-3.5">
                        {filteredParticipants.slice(0, 100).map((user) => {
                            const checkIn = checkIns.find((ci) => ci.userId === user.id);
                            const status = checkIn?.status || "ABSENT";

                            return (
                                <div
                                    key={user.id}
                                    className={`bg-card/70 border border-border/70 rounded-xl p-3.5 flex flex-col gap-2.5 ${status === "ABSENT"
                                            ? "border-l-4 border-l-destructive/50"
                                            : "border-l-4 border-l-emerald-500/60"
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-heading font-semibold text-sm truncate text-foreground">
                                                {user.firstName} {user.lastName}
                                            </h4>
                                            <p className="text-xs text-muted-foreground font-sans truncate">
                                                {user.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-sans mt-0.5 truncate">
                                                {user.college || "N/A"}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${status === "PRESENT"
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                                }`}
                                        >
                                            {status}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleManualCheckIn(user.id, status)}
                                        disabled={processingId === user.id}
                                        className="w-full py-2 rounded-lg text-xs font-sans font-medium bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-1.5"
                                    >
                                        {processingId === user.id && (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        )}
                                        <span>Mark {status === "PRESENT" ? "Absent" : "Present"}</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === "debates" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debates.length === 0 ? (
                        <div className="md:col-span-2 p-10 text-center border-2 border-dashed border-border/80 rounded-xl bg-card/40">
                            <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" aria-hidden="true" />
                            <h3 className="font-heading font-bold text-base text-foreground mb-1">No Debates Scheduled</h3>
                            <p className="text-xs text-muted-foreground font-sans">
                                Generate pairings to create debate matchups for this round.
                            </p>
                        </div>
                    ) : (
                        debates
                            .filter(
                                (debate) =>
                                    !searchTerm ||
                                    `${debate.debater1.firstName} ${debate.debater1.lastName}`
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase()) ||
                                    `${debate.debater2.firstName} ${debate.debater2.lastName}`
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase()) ||
                                    debate.room?.name
                                        ?.toLowerCase()
                                        .includes(searchTerm.toLowerCase())
                            )
                            .slice(0, 50)
                            .map((debate) => (
                                <div
                                    key={debate.id}
                                    className="bg-card/70 border border-border/70 rounded-xl p-4 md:p-5 hover:border-primary/40 transition-all flex flex-col justify-between backdrop-blur-sm"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-sans">
                                            Matchup #{debate.id.substring(0, 4)}
                                        </span>
                                        {debate.status === "COMPLETED" ? (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider font-sans">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Submitted</span>
                                            </div>
                                        ) : debate.room ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-sans font-medium">
                                                <MapPin className="w-3 h-3" />
                                                <span>{debate.room.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-amber-500 font-sans font-medium">
                                                Room Unallocated
                                            </span>
                                        )}
                                    </div>

                                    {debate.startTime && (
                                        <div className="flex items-center justify-center gap-1.5 mb-3 text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/10 py-1 rounded-md font-sans">
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {new Date(debate.startTime).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}{" "}
                                                -{" "}
                                                {new Date(debate.endTime).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-3 mb-4">
                                        <div className="flex-1 text-center min-w-0">
                                            <span className="inline-block mb-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-500 uppercase tracking-widest font-sans">
                                                GOV
                                            </span>
                                            <div className="mx-auto mb-1 flex justify-center">
                                                <UserAvatar
                                                    user={debate.debater1}
                                                    imageUrl={debate.debater1.imageUrl}
                                                    size="md"
                                                />
                                            </div>
                                            <p className="font-heading font-semibold text-xs truncate text-foreground">
                                                {debate.debater1.firstName} {debate.debater1.lastName}
                                            </p>
                                        </div>
                                        <div className="font-heading font-bold text-lg text-muted-foreground/30 italic pt-4 shrink-0">
                                            VS
                                        </div>
                                        <div className="flex-1 text-center min-w-0">
                                            <span className="inline-block mb-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-widest font-sans">
                                                OPP
                                            </span>
                                            <div className="mx-auto mb-1 flex justify-center">
                                                <UserAvatar
                                                    user={debate.debater2}
                                                    imageUrl={debate.debater2.imageUrl}
                                                    size="md"
                                                />
                                            </div>
                                            <p className="font-heading font-semibold text-xs truncate text-foreground">
                                                {debate.debater2.firstName} {debate.debater2.lastName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-3 border-t border-border/60">
                                        <label htmlFor={`adjudicator-${debate.id}`} className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1 font-sans">
                                            <Users className="w-3 h-3" /> Adjudicator (Judge)
                                        </label>
                                        <input
                                            id={`adjudicator-${debate.id}`}
                                            type="text"
                                            value={debate.judgeName || ""}
                                            onChange={(e) =>
                                                handleAssignJudge(debate.id, e.target.value)
                                            }
                                            placeholder="Enter judge name..."
                                            className="w-full bg-background border border-border/70 rounded-md px-2.5 py-1.5 text-xs font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {debate.startTime
                                                    ? new Date(debate.startTime).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                    : "Time TBD"}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/admin/results/${debate.id}`)}
                                            className={cn(
                                                "text-xs font-sans font-semibold transition-all px-3 py-1.5 rounded-lg flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                debate.status === "COMPLETED"
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                            )}
                                        >
                                            {debate.status === "COMPLETED" ? (
                                                <>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Edit Result</span>
                                                </>
                                            ) : (
                                                <span>Enter Result</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            )}

            {activeTab === "results" && (
                <>
                    {/* Desktop View */}
                    <div className="hidden md:block bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left" aria-label="Debate results">
                                <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                                    <tr>
                                        <th scope="col" className="px-5 py-3">Matchup</th>
                                        <th scope="col" className="px-5 py-3 text-center">Scores</th>
                                        <th scope="col" className="px-5 py-3">Winner</th>
                                        <th scope="col" className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {debates.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="4"
                                                className="px-5 py-10 text-center text-xs text-muted-foreground font-sans"
                                            >
                                                No debate results recorded.
                                            </td>
                                        </tr>
                                    ) : (
                                        debates
                                            .filter(
                                                (debate) =>
                                                    !searchTerm ||
                                                    `${debate.debater1.firstName} ${debate.debater1.lastName}`
                                                        .toLowerCase()
                                                        .includes(searchTerm.toLowerCase()) ||
                                                    `${debate.debater2.firstName} ${debate.debater2.lastName}`
                                                        .toLowerCase()
                                                        .includes(searchTerm.toLowerCase())
                                            )
                                            .map((debate) => (
                                                <tr
                                                    key={debate.id}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="px-5 py-3.5">
                                                        <div className="text-sm font-sans font-medium text-foreground">
                                                            <span
                                                                className={
                                                                    debate.winnerId === debate.debater1Id
                                                                        ? "text-emerald-500 font-bold"
                                                                        : ""
                                                                }
                                                            >
                                                                {debate.debater1.firstName}
                                                            </span>
                                                            <span className="text-muted-foreground mx-1.5 font-normal text-xs">
                                                                vs
                                                            </span>
                                                            <span
                                                                className={
                                                                    debate.winnerId === debate.debater2Id
                                                                        ? "text-emerald-500 font-bold"
                                                                        : ""
                                                                }
                                                            >
                                                                {debate.debater2.firstName}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        {debate.status === "COMPLETED" ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/50 border border-border/70 text-xs font-mono">
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater1Id
                                                                            ? "text-emerald-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater1Score}
                                                                </span>
                                                                <span className="text-muted-foreground">-</span>
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater2Id
                                                                            ? "text-emerald-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater2Score}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground font-sans italic">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        {debate.status === "COMPLETED" ? (
                                                            <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-emerald-500">
                                                                <Trophy className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {debate.winnerId === debate.debater1Id
                                                                        ? debate.debater1.firstName
                                                                        : debate.debater2.firstName}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground font-sans">
                                                                -
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        <button
                                                            onClick={() =>
                                                                navigate(`/admin/results/${debate.id}`)
                                                            }
                                                            className="text-xs font-sans font-semibold text-primary hover:underline transition-colors"
                                                        >
                                                            {debate.status === "COMPLETED"
                                                                ? "Edit"
                                                                : "Enter Result"}
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
                        {debates
                            .filter(
                                (debate) =>
                                    !searchTerm ||
                                    `${debate.debater1.firstName} ${debate.debater1.lastName}`
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase()) ||
                                    `${debate.debater2.firstName} ${debate.debater2.lastName}`
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase())
                            )
                            .map((debate) => (
                                <div
                                    key={debate.id}
                                    className="bg-card/70 border border-border/70 rounded-xl p-3.5 flex flex-col gap-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground font-sans tracking-wider">
                                            Matchup #{debate.id.substring(0, 4)}
                                        </span>
                                        {debate.status === "COMPLETED" ? (
                                            <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                                                Completed
                                            </span>
                                        ) : (
                                            <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                                                Pending
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div
                                            className={`flex-1 text-center ${debate.winnerId === debate.debater1Id
                                                    ? "text-emerald-500 font-bold"
                                                    : "text-foreground"
                                                }`}
                                        >
                                            <p className="text-xs font-sans truncate font-medium">
                                                {debate.debater1.firstName}
                                            </p>
                                            {debate.status === "COMPLETED" && (
                                                <p className="text-base font-mono font-bold mt-0.5">
                                                    {debate.debater1Score}
                                                </p>
                                            )}
                                        </div>

                                        <div className="px-3 text-muted-foreground text-xs font-bold italic">
                                            VS
                                        </div>

                                        <div
                                            className={`flex-1 text-center ${debate.winnerId === debate.debater2Id
                                                    ? "text-emerald-500 font-bold"
                                                    : "text-foreground"
                                                }`}
                                        >
                                            <p className="text-xs font-sans truncate font-medium">
                                                {debate.debater2.firstName}
                                            </p>
                                            {debate.status === "COMPLETED" && (
                                                <p className="text-base font-mono font-bold mt-0.5">
                                                    {debate.debater2Score}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate(`/admin/results/${debate.id}`)}
                                        className="w-full py-2 rounded-lg text-xs font-sans font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    >
                                        {debate.status === "COMPLETED"
                                            ? "Edit Result"
                                            : "Enter Result"}
                                    </button>
                                </div>
                            ))}
                    </div>
                </>
            )}
        </div>
    );
}

function AllocateRoomsModal({
    onClose,
    onConfirm,
    totalDebates,
    rooms,
    loading,
}) {
    const toast = useToast();
    const [selectedRoomIds, setSelectedRoomIds] = useState(
        rooms.map((r) => r.id)
    );
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        startTime: toLocalDateTime(Date.now()),
        speakingTime: 5,
        bufferTime: 4,
        gap: 1,
    });


    const activeRoomsCount = selectedRoomIds.length || 1;
    const debatesPerRoom = Math.ceil(totalDebates / activeRoomsCount) || 0;
    const debateDuration =
        Number(formData.speakingTime) * 2 + Number(formData.bufferTime);
    const totalInterval = debateDuration + Number(formData.gap);
    const totalTimeNeeded = debatesPerRoom * totalInterval;

    const toggleRoom = (id) => {
        setSelectedRoomIds((prev) =>
            prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || localSubmitting) return;

        if (selectedRoomIds.length === 0) {
            toast.error("Selection Required", "Please select at least one room.");
            return;
        }
        setLocalSubmitting(true);
        try {
            await onConfirm({
                ...formData,
                roomIds: selectedRoomIds,
                startTime: new Date(formData.startTime).toISOString(),
            });
        } finally {
            if (document.body.contains(e.target)) {
                setLocalSubmitting(false);
            }
        }
    };

    // Generate preview slots
    const previewSlots = [];
    const baseTime = new Date(formData.startTime).getTime();
    for (let i = 0; i < Math.min(debatesPerRoom, 3); i++) {
        const start = new Date(baseTime + i * totalInterval * 60000);
        const end = new Date(start.getTime() + debateDuration * 60000);
        previewSlots.push({ start, end });
    }

    return (
        <ModalSurface onDismiss={onClose}
            aria-label="Schedule and Room Allocation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-border/80 rounded-xl p-6 md:p-8 w-full max-w-2xl shadow-xl my-6"
            >
                <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
                    <div>
                        <h2 className="text-xl font-heading font-bold text-foreground">
                            Schedule & Room Allocation
                        </h2>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                            Distribute and time-slot {totalDebates} debates across rooms
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans text-sm"
                >
                    {/* Left Column: Configuration */}
                    <div className="space-y-5">
                        <div className="space-y-3.5">
                            <div>
                                <label htmlFor="allocation-start" className="text-xs font-semibold text-foreground mb-1 block">
                                    Round Start Time (local time)
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        id="allocation-start"
                                        type="datetime-local"
                                        required
                                        value={formData.startTime}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                startTime: e.target.value,
                                            })
                                        }
                                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label htmlFor="allocation-speaking" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                                        Speaking Time (Per Debater)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-speaking"
                                            aria-valuetext={`${formData.speakingTime} minutes per debater`}
                                            type="range"
                                            min="1"
                                            max="15"
                                            value={formData.speakingTime}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    speakingTime: e.target.value,
                                                })
                                            }
                                            className="flex-1 accent-primary"
                                        />
                                        <span className="w-10 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded">
                                            {formData.speakingTime}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="allocation-buffer" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                                        Buffer & Transition
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-buffer"
                                            aria-valuetext={`${formData.bufferTime} minutes`}
                                            type="range"
                                            min="0"
                                            max="10"
                                            value={formData.bufferTime}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    bufferTime: e.target.value,
                                                })
                                            }
                                            className="flex-1 accent-blue-500"
                                        />
                                        <span className="w-10 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded">
                                            {formData.bufferTime}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="allocation-gap" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                                        Gap Between Debates
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-gap"
                                            aria-valuetext={`${formData.gap} minutes`}
                                            type="range"
                                            min="0"
                                            max="10"
                                            value={formData.gap}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    gap: e.target.value,
                                                })
                                            }
                                            className="flex-1 accent-amber-500"
                                        />
                                        <span className="w-10 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded">
                                            {formData.gap}m
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                            <h4 className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Schedule Summary
                            </h4>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Debates per Room</span>
                                <span className="font-semibold text-foreground">
                                    {debatesPerRoom}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Time per Group</span>
                                <span className="font-semibold text-foreground">
                                    {debateDuration}m + {formData.gap}m gap
                                </span>
                            </div>
                            <div className="flex justify-between pt-1.5 border-t border-border/60">
                                <span className="font-semibold text-foreground">Estimated Total</span>
                                <span className="font-semibold text-primary">
                                    {Math.floor(totalTimeNeeded / 60)}h {totalTimeNeeded % 60}m
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Room Selection & Preview */}
                    <div className="space-y-5 flex flex-col">
                        <div>
                            <h3 className="text-xs font-semibold text-foreground mb-2 block">
                                Select Available Rooms ({selectedRoomIds.length}/{rooms.length})
                            </h3>
                            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                                {rooms.map((room) => (
                                    <button
                                        key={room.id}
                                        type="button"
                                        aria-pressed={selectedRoomIds.includes(room.id)}
                                        onClick={() => toggleRoom(room.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all text-left flex items-center gap-1.5 ${selectedRoomIds.includes(room.id)
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "bg-muted/30 border-border text-muted-foreground"
                                            }`}
                                    >
                                        <div
                                            className={`w-1.5 h-1.5 rounded-full ${selectedRoomIds.includes(room.id)
                                                    ? "bg-primary"
                                                    : "bg-muted-foreground/30"
                                                }`}
                                        />
                                        <span className="truncate">{room.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <span>Sequence Preview</span>
                            </h3>
                            <div className="space-y-1.5">
                                {previewSlots.map((slot, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/70 text-[11px]"
                                    >
                                        <span className="w-12 font-bold text-muted-foreground uppercase text-[10px]">
                                            Slot {idx + 1}
                                        </span>
                                        <div className="flex-1 flex items-center justify-between">
                                            <span className="font-medium text-foreground">
                                                {slot.start.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <div className="h-px flex-1 mx-2 bg-border/60" />
                                            <span className="font-medium text-foreground">
                                                {slot.end.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        <span className="text-primary font-semibold text-[10px]">
                                            {debateDuration}m
                                        </span>
                                    </div>
                                ))}
                                {debatesPerRoom > 3 && (
                                    <p className="text-[10px] text-center text-muted-foreground italic">
                                        ... and {debatesPerRoom - 3} more slots
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2.5 pt-3 mt-auto border-t border-border/60">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted font-medium transition-all text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || localSubmitting}
                                className="flex-[2] py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-sm"
                            >
                                {loading || localSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Start Allocation"
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </Motion.div>
        </ModalSurface>
    );
}
