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
    Check,
    Eye,
    AlertTriangle,
    X,
} from "lucide-react";
import { useAuth } from "../../auth/client.jsx";
import { cn } from "../../lib/utils";
import { AdminApi } from "../../services/api";
import { useRoundSocket, useSocket, SocketEvents, useLiveRefresh } from "../../hooks/useSocket";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {useToast} from "../../hooks/useToast";
import { UserAvatar } from "../../components/ui/UserAvatar";
import {toLocalDateTime} from "../../lib/datetime";
import InlineResultSheet from "../../components/admin/InlineResultSheet";

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
        previewing: false,
    });
    const [activeTab, setActiveTab] = useState("checkins");
    const [allocationRoundId, setAllocationRoundId] = useState(null);
    const showAllocateModal = allocationRoundId === roundId;
    const [previewData, setPreviewData] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [processingIds, setProcessingIds] = useState(() => new Set());
    const [scoringDebate, setScoringDebate] = useState(null);
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
            const opts = { skipCache: true };
            const roundRes = await AdminApi.apiRequest(`/rounds/${roundId}`, "GET", null, token, opts);
            if (generation !== fetchGeneration.current) return;
            if (roundRes.success) {
                const fetchedRound = roundRes.round;
                const [roomsRes, participantsRes] = await Promise.all([
                    AdminApi.apiRequest("/rooms", "GET", null, token, opts),
                    AdminApi.apiRequest(`/events/${fetchedRound.eventId}/participants`, "GET", null, token, opts),
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
        }, 60);
    }, [fetchRoundData]);

    // Real-time updates via WebSocket
    useRoundSocket(roundId, {
        onCheckInUpdate: (data) => {
            const targetUserId = data?.userId || data?.user?.id;
            if (!targetUserId) {
                debouncedFetch();
                return;
            }
            setCheckIns((prev) => {
                const existing = prev.find((ci) => ci.userId === targetUserId);
                if (existing) {
                    return prev.map((ci) =>
                        ci.userId === targetUserId
                            ? { ...ci, status: data.status, ...(data.user ? { user: data.user } : {}) }
                            : ci
                    );
                }
                if (data.user) {
                    return [...prev, { userId: targetUserId, status: data.status, user: data.user }];
                }
                debouncedFetch();
                return [...prev, { userId: targetUserId, status: data.status }];
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
        onDebateCreated: debouncedFetch,
        onDebateUpdated: debouncedFetch,
        onDebateDeleted: debouncedFetch,
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

    useLiveRefresh(debouncedFetch, { roundId, eventId: round?.eventId, jitterMs: 3000, invalidateCache: false });
    const { subscribe: subscribeRound } = useSocket({ eventId: round?.eventId });
    useEffect(() => {
        if (!roundId) return undefined;
        return subscribeRound(SocketEvents.ROUND_CHECKIN_WINDOW, (data) => {
            if (!data || (data.roundId && data.roundId !== roundId)) return;
            setRound((prev) =>
                prev
                    ? {
                        ...prev,
                        checkInStartTime: data.checkInStartTime ?? prev.checkInStartTime,
                        checkInEndTime: data.checkInEndTime ?? prev.checkInEndTime,
                    }
                    : prev
            );
            debouncedFetch();
        });
    }, [subscribeRound, roundId, debouncedFetch]);

    const handleSaveResult = async ({ debateId, debater1Score, debater2Score, winnerId, nextDebate }) => {
        const token = await getTokenRef.current();
        const res = await AdminApi.submitResult(debateId, { debater1Score, debater2Score, winnerId }, token, {summary: true});
        if (!res.success) {
            throw new Error(res.error || "Failed to submit result");
        }
        setDebates((prev) => prev.map((d) => d.id === debateId ? {
            ...d,
            debater1Score: res.debate?.debater1Score ?? debater1Score,
            debater2Score: res.debate?.debater2Score ?? debater2Score,
            winnerId: res.debate?.winnerId ?? winnerId,
            status: "COMPLETED"
        } : d));
        toast.success("Result Saved", "Ballot recorded with winner tag.");
        if (nextDebate) {
            setScoringDebate(nextDebate);
        } else {
            setScoringDebate(null);
        }
        debouncedFetch();
    };

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

    const handlePreviewPairings = async () => {
        setActionLoading((prev) => ({ ...prev, previewing: true }));
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/pairing/${roundId}/preview`,
                "GET",
                null,
                token,
                { skipCache: true }
            );
            if (activeRoundId.current !== roundId) return;
            if (response.success) {
                setPreviewData(response);
            } else {
                toast.error("Preview Failed", response.error || "Failed to preview pairings");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Failed to preview pairings");
        } finally {
            setActionLoading((prev) => ({ ...prev, previewing: false }));
        }
    };

    const handleManualCheckIn = async (userId, currentStatus) => {
        if (processingIds.has(userId)) return;
        const newStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";
        setProcessingIds((prev) => new Set(prev).add(userId));

        let rollbackSnapshot = null;
        setCheckIns((prev) => {
            rollbackSnapshot = prev;
            const exists = prev.find((ci) => ci.userId === userId);
            if (exists) {
                return prev.map((ci) =>
                    ci.userId === userId ? { ...ci, status: newStatus } : ci
                );
            }
            return [...prev, { userId, status: newStatus }];
        });

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
                toast.success("Check-in Updated", `Participant marked as ${newStatus}`);
                debouncedFetch();
            } else {
                if (rollbackSnapshot) setCheckIns(rollbackSnapshot);
                toast.error("Update Failed", response.error || "Failed to update check-in status");
            }
        } catch (err) {
            if (rollbackSnapshot) setCheckIns(rollbackSnapshot);
            toast.error("Error", err?.message || "Failed to update check-in status");
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
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
            user.mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.usn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.college?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allParticipants, searchTerm]);

    if (loading && (!round || round.id !== roundId)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingIndicator label="Loading round management" />
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
                    <button
                        type="button"
                        onClick={handlePreviewPairings}
                        disabled={loading || actionLoading.previewing}
                        className="min-h-11 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-border/70 bg-card hover:bg-muted text-foreground font-sans font-medium text-xs transition-colors disabled:opacity-50 w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {actionLoading.previewing ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span>Preview Pairings</span>
                    </button>
                    {debates.length > 0 && (
                        <button
                            type="button"
                            onClick={handleTogglePublish}
                            disabled={loading || actionLoading.publishing}
                            className={`min-h-11 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-sans font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${round.pairingsPublished
                                    ? "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border border-emerald-500/35"
                                    : "bg-orange-600 text-white hover:bg-orange-700 shadow-sm"
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
                            type="button"
                            onClick={() =>
                                handleGeneratePairings(
                                    round.roundNumber === 1 ? "round1" : "power-match"
                                )
                            }
                            disabled={loading || actionLoading.generating}
                            className="min-h-11 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                type="button"
                                onClick={() => setAllocationRoundId(roundId)}
                                disabled={loading || actionLoading.allocating}
                                className="min-h-11 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {actionLoading.allocating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Home className="w-4 h-4" aria-hidden="true" />
                                )}
                                <span>Allocate Rooms</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/admin/rounds/${roundId}/promotion`)}
                                className="min-h-11 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-card text-foreground border border-border font-sans font-medium text-xs hover:bg-muted transition-colors w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                                <span>Review &amp; Promote</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    handleGeneratePairings(
                                        round.roundNumber === 1 ? "round1" : "power-match"
                                    )
                                }
                                disabled={loading || actionLoading.generating}
                                className="min-h-11 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-200 border border-rose-500/35 font-sans font-medium text-xs hover:bg-rose-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {previewData && (
                <PairingPreviewModal
                    preview={previewData}
                    roundNumber={round.roundNumber}
                    onClose={() => setPreviewData(null)}
                    generating={actionLoading.generating}
                    onGenerate={async () => {
                        setPreviewData(null);
                        await handleGeneratePairings(
                            round.roundNumber === 1 ? "round1" : "power-match"
                        );
                    }}
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
                                {round.checkInStartTime
                                    ? `${new Date(round.checkInStartTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                                    : "Not configured"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                                Ends
                            </p>
                            <p className="text-xs font-medium text-foreground">
                                {round.checkInEndTime
                                    ? `${new Date(round.checkInEndTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                                    : "Not configured"}
                            </p>
                        </div>
                        <div className="pt-1">
                            {!round.checkInStartTime || !round.checkInEndTime ? (
                                <span className="ax-signal-loss text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200">
                                    Not Configured
                                </span>
                            ) : (
                                <span
                                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${new Date() > new Date(round.checkInEndTime)
                                            ? "ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/40"
                                            : new Date() < new Date(round.checkInStartTime)
                                                ? "ax-signal-warn bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/40"
                                                : "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/40"
                                        }`}
                                >
                                    {new Date() > new Date(round.checkInEndTime)
                                        ? "Window Closed"
                                        : new Date() < new Date(round.checkInStartTime)
                                            ? "Window Not Open"
                                            : "Window Open"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/70 gap-3 pb-0" role="group" aria-label="Round views and search">
                <div className="flex overflow-x-auto pb-1 md:pb-0 gap-1">
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
                    <div className="hidden md:block overflow-x-auto">
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
                                                    {user.mobile && (
                                                        <p className="text-xs text-foreground font-medium tabular-nums mt-0.5">
                                                            <a href={`tel:${user.mobile}`} className="hover:text-primary hover:underline">
                                                                {user.mobile}
                                                            </a>
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-muted-foreground font-sans">
                                                    <p className="text-foreground">{user.college || "N/A"}</p>
                                                    {(user.usn || user.gender) && (
                                                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                                            {[user.usn, user.gender].filter(Boolean).join(" · ")}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${status === "PRESENT"
                                                                    ? "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35"
                                                                    : "ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/35"
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
                                                        type="button"
                                                        onClick={() =>
                                                            handleManualCheckIn(user.id, status)
                                                        }
                                                        disabled={processingIds.has(user.id)}
                                                        className="min-h-11 px-3 py-2 rounded-lg text-xs font-sans font-semibold text-primary hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                    >
                                                        {processingIds.has(user.id) && (
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
                                            {user.mobile && (
                                                <p className="text-xs text-foreground font-medium tabular-nums truncate mt-0.5">
                                                    <a href={`tel:${user.mobile}`} className="hover:underline">{user.mobile}</a>
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground font-sans mt-0.5 truncate">
                                                {user.college || "N/A"}{user.usn ? ` · ${user.usn}` : ""}{user.gender ? ` · ${user.gender}` : ""}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${status === "PRESENT"
                                                    ? "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35"
                                                    : "ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/35"
                                                }`}
                                        >
                                            {status}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleManualCheckIn(user.id, status)}
                                        disabled={processingIds.has(user.id)}
                                        className="w-full min-h-11 py-2 rounded-lg text-xs font-sans font-medium bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-1.5"
                                    >
                                        {processingIds.has(user.id) && (
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
                                            <div className="ax-signal-win flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border border-emerald-500/35 text-[10px] font-bold uppercase tracking-wider font-sans">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Submitted</span>
                                            </div>
                                        ) : debate.room ? (
                                            <div className="ax-signal-info flex items-center gap-1.5 px-2 py-0.5 rounded border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 text-xs font-sans font-medium">
                                                <MapPin className="w-3 h-3" />
                                                <span>{debate.room.name}</span>
                                            </div>
                                        ) : (
                                            <span className="ax-signal-warn text-[11px] px-2 py-0.5 rounded border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 font-sans font-medium">
                                                Room Unallocated
                                            </span>
                                        )}
                                    </div>

                                    {debate.startTime && (
                                        <div className="ax-signal-info flex items-center justify-center gap-1.5 mb-3 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 py-1 rounded-md font-sans">
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
                                            <span className="ax-chip ax-chip--gov inline-block mb-1.5 text-[9px] font-bold uppercase tracking-widest font-sans">
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
                                            <span className="ax-chip ax-chip--opp inline-block mb-1.5 text-[9px] font-bold uppercase tracking-widest font-sans">
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
                                            onClick={() => setScoringDebate(debate)}
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
                        <div className="overflow-x-auto">
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
                                                                setScoringDebate(debate)
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
                                        onClick={() => setScoringDebate(debate)}
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

            {scoringDebate && (
                <InlineResultSheet
                    debate={scoringDebate}
                    debates={debates}
                    onSave={handleSaveResult}
                    onClose={() => setScoringDebate(null)}
                />
            )}
        </div>
    );
}

export function PairingPreviewModal({
    preview,
    roundNumber,
    onClose,
    onGenerate,
    generating = false,
}) {
    const payload = preview?.data || preview || {};
    const roundType =
        preview?.roundType ||
        payload.roundType ||
        (roundNumber === 1 ? "Random Draw" : "Power Matching (High vs High)");
    const usersList = Array.isArray(payload.users) ? payload.users : [];
    const eliminatedUsers = usersList.filter((u) => u.eliminated);
    const eligibleUsers = usersList.filter((u) => !u.eliminated);

    const presentCount = payload.presentUsers ?? usersList.length;
    const eligibleCount = payload.eligibleUsers ?? eligibleUsers.length;
    const eliminatedCount = payload.eliminatedUsers ?? eliminatedUsers.length;

    const proposedPairs = (() => {
        if (Array.isArray(payload.proposedPairings) && payload.proposedPairings.length > 0) {
            return payload.proposedPairings.map((pair, idx) => ({
                index: idx + 1,
                gov: pair.debater1 || pair.gov,
                opp: pair.debater2 || pair.opp,
                isSwing: Boolean(pair.isSwing || pair.debater2?.isSwing || pair.opp?.isSwing),
            }));
        }
        const pairs = [];
        for (let i = 0; i < eligibleUsers.length; i += 2) {
            const gov = eligibleUsers[i];
            const opp = eligibleUsers[i + 1];
            if (opp) {
                pairs.push({ index: Math.floor(i / 2) + 1, gov, opp, isSwing: false });
            } else if (eligibleUsers.length >= 2) {
                pairs.push({
                    index: Math.floor(i / 2) + 1,
                    gov,
                    opp: { firstName: "Swing", lastName: "Member", college: "Auto-assigned Bye / Swing", isSwing: true },
                    isSwing: true,
                });
            }
        }
        return pairs;
    })();

    const debatesToCreate =
        payload.possiblePairings ?? proposedPairs.filter((p) => !p.isSwing).length;
    const needsSwing = Boolean(
        payload.needsSwing ??
            payload.unpaired ??
            (eligibleCount >= 2 && eligibleCount % 2 === 1)
    );
    const insufficientEntrants = eligibleCount < 2;

    const labelOf = (u) => {
        if (!u) return "TBD";
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return full || u.email || "Unknown";
    };

    return (
        <ModalSurface
            onDismiss={onClose}
            aria-label="Pairing Preview"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-border/80 rounded-xl p-5 md:p-6 w-full max-w-2xl shadow-xl my-6 max-h-[90vh] flex flex-col"
            >
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3.5">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-lg font-heading font-bold text-foreground">
                                Pairing Preview · Round {roundNumber}
                            </h2>
                            <span className="ax-signal-info inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200">
                                {roundType}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                            Dry-run bracket computed from checked-in debaters before locking debates.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close preview"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Vivid Stat Pills */}
                <div className="flex flex-wrap gap-2 py-3 border-b border-border/60">
                    <span className="ax-signal-info inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 text-xs font-semibold tabular-nums">
                        Present: {presentCount}
                    </span>
                    <span className="ax-signal-info inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 text-xs font-semibold tabular-nums">
                        Eligible: {eligibleCount}
                    </span>
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums",
                            eliminatedCount > 0
                                ? "ax-signal-loss border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                                : "border-border bg-muted/40 text-muted-foreground"
                        )}
                    >
                        Eliminated Excluded: {eliminatedCount}
                    </span>
                    <span className="ax-signal-win inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 text-xs font-semibold tabular-nums">
                        Debates to Create: {debatesToCreate}
                    </span>
                    {needsSwing && (
                        <span className="ax-signal-warn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 text-xs font-semibold">
                            Swing Needed
                        </span>
                    )}
                </div>

                {insufficientEntrants && (
                    <div className="ax-signal-loss mt-3 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
                        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Need at least 2 present eligible debaters to generate pairings.</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                    {proposedPairs.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                            No matchups can be formed with {eligibleCount} eligible debater{eligibleCount === 1 ? "" : "s"}.
                        </div>
                    ) : (
                        proposedPairs.map((pair) => (
                            <div
                                key={pair.index}
                                className={cn(
                                    "rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs",
                                    pair.isSwing
                                        ? "ax-signal-warn border-orange-500/40 bg-orange-500/10"
                                        : "border-border/70 bg-muted/20"
                                )}
                            >
                                <span className="font-mono font-bold text-muted-foreground w-8 shrink-0">
                                    #{pair.index}
                                </span>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="ax-chip ax-chip--gov shrink-0 text-[10px] font-bold">
                                        GOV
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{labelOf(pair.gov)}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {pair.gov?.college || "—"}
                                            {typeof pair.gov?.avgScore === "number" ? ` · Avg ${pair.gov.avgScore.toFixed(1)}` : ""}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[11px] font-bold text-muted-foreground/70 shrink-0 px-1">vs</span>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className={cn(
                                        "shrink-0 text-[10px] font-bold ax-chip",
                                        pair.isSwing
                                            ? "ax-chip--warn"
                                            : "ax-chip--opp"
                                    )}>
                                        {pair.isSwing ? "SWING" : "OPP"}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{labelOf(pair.opp)}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {pair.opp?.college || "—"}
                                            {typeof pair.opp?.avgScore === "number" ? ` · Avg ${pair.opp.avgScore.toFixed(1)}` : ""}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {eliminatedUsers.length > 0 && (
                        <div className="ax-signal-loss rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs">
                            <p className="font-semibold text-rose-700 dark:text-rose-200 mb-1.5">
                                Eliminated Debaters Excluded ({eliminatedUsers.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {eliminatedUsers.map((u) => (
                                    <span
                                        key={u.id || u.email}
                                        className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-200 border border-rose-500/30 text-[11px]"
                                    >
                                        {labelOf(u)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3.5 border-t border-border/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 px-4 py-2 rounded-lg border border-border/70 hover:bg-muted text-foreground text-xs font-medium transition-colors"
                    >
                        Close
                    </button>
                    {onGenerate && (
                        <button
                            type="button"
                            onClick={onGenerate}
                            disabled={insufficientEntrants || generating}
                            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                            <span>Generate Pairings Now</span>
                        </button>
                    )}
                </div>
            </Motion.div>
        </ModalSurface>
    );
}

export function AllocateRoomsModal({
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
        speakingTime: 7,
        bufferTime: 11,
        gap: 5,
    });

    const speaking = Number(formData.speakingTime);
    const minBufferNeeded = Math.max(0, 25 - speaking * 2);
    const effectiveBuffer = Math.max(Number(formData.bufferTime), minBufferNeeded);
    const debateDuration = Math.max(25, speaking * 2 + effectiveBuffer);
    const totalInterval = debateDuration + Number(formData.gap);
    const activeRoomsCount = selectedRoomIds.length || 1;
    const debatesPerRoom = Math.ceil(totalDebates / activeRoomsCount) || 0;
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
                speakingTime: speaking,
                bufferTime: effectiveBuffer,
                gap: Number(formData.gap),
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
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                        className="w-full min-h-11 pl-9 pr-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"
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
                                            aria-valuetext={`${speaking} minutes per debater`}
                                            type="range"
                                            min="1"
                                            max="15"
                                            value={speaking}
                                            onChange={(e) => {
                                                const nextSpeaking = Number(e.target.value);
                                                const nextMinBuffer = Math.max(0, 25 - nextSpeaking * 2);
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    speakingTime: nextSpeaking,
                                                    bufferTime: Math.max(Number(prev.bufferTime), nextMinBuffer),
                                                }));
                                            }}
                                            className="flex-1 accent-primary"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
                                            {speaking}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label htmlFor="allocation-buffer" className="text-[11px] font-semibold text-muted-foreground">
                                            Prep, POIs &amp; Adjudication Buffer
                                        </label>
                                        <span className="ax-signal-info inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200">
                                            25m minimum enforced
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-buffer"
                                            aria-valuetext={`${effectiveBuffer} minutes`}
                                            type="range"
                                            min="0"
                                            max="25"
                                            value={effectiveBuffer}
                                            onChange={(e) => {
                                                const val = Math.max(minBufferNeeded, Number(e.target.value));
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    bufferTime: val,
                                                }));
                                            }}
                                            className="flex-1 accent-indigo-600"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
                                            {effectiveBuffer}m
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
                                                    gap: Number(e.target.value),
                                                })
                                            }
                                            className="flex-1 accent-orange-500"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
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
                            <p className="text-xs font-medium text-foreground pb-1.5 border-b border-border/60">
                                2 × {speaking}m speeches + {effectiveBuffer}m buffer = <span className="font-bold text-primary">{debateDuration}m</span> debate · +{formData.gap}m changeover
                            </p>
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
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <h3 className="text-xs font-semibold text-foreground">
                                    Select Available Rooms ({selectedRoomIds.length}/{rooms.length})
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoomIds(rooms.map((r) => r.id))}
                                        className="min-h-11 px-2.5 py-1 rounded-md border border-border/70 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoomIds([])}
                                        className="min-h-11 px-2.5 py-1 rounded-md border border-border/70 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                                {rooms.map((room) => {
                                    const selected = selectedRoomIds.includes(room.id);
                                    return (
                                        <button
                                            key={room.id}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleRoom(room.id)}
                                            className={cn(
                                                "min-h-11 px-3 py-2 rounded-lg text-xs border-2 transition-all text-left flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                selected
                                                    ? "ax-room-selected ax-signal-win font-bold shadow-sm"
                                                    : "border-dashed border-border bg-muted/20 text-muted-foreground font-medium hover:bg-muted/40 hover:text-foreground"
                                            )}
                                        >
                                            <span className="truncate">{room.name}</span>
                                            {selected && (
                                                <Check className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
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
                                className="flex-1 min-h-11 py-2 rounded-lg border border-border/70 hover:bg-muted font-medium transition-all text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || localSubmitting}
                                className="flex-[2] min-h-11 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-sm"
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
