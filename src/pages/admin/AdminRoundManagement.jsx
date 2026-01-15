import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Users,
    Activity,
    MapPin,
    Loader2,
    ArrowLeft,
    Clock,
    UserPlus,
    XCircle,
    Dice5,
    Zap,
    Home,
    Search,
    Trophy,
    RotateCcw,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi } from "../../services/api";
import { useRoundSocket } from "../../hooks/useSocket";
import { useToast } from "../../components/ui/Toast";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { CardSkeleton } from "../../components/ui/Skeleton";

export default function AdminRoundManagement() {
    const { id: roundId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("checkins");
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState(null);
    const debounceTimers = useRef({});

    // Memoize fetchRoundData for useEffect dependency
    const fetchRoundData = useCallback(async () => {
        try {
            const token = await getToken();

            // 1. Fetch Round Details first to get eventId
            const roundRes = await AdminApi.apiRequest(`/rounds/${roundId}`, "GET", null, token);

            if (roundRes.success) {
                setRound(roundRes.round);
                const eventId = roundRes.round.eventId;

                // 2. Fetch related data in parallel, now knowing the eventId
                const [checkInsRes, debatesRes, roomsRes, usersRes] =
                    await Promise.all([
                        AdminApi.apiRequest(`/check-in/round/${roundId}`, "GET", null, token),
                        AdminApi.apiRequest(`/debates/round/${roundId}`, "GET", null, token),
                        AdminApi.apiRequest(`/rooms`, "GET", null, token),
                        // Fetch only participants for this event
                        EventApi.getParticipants(eventId, token),
                    ]);

                if (checkInsRes.success) setCheckIns(checkInsRes.checkIns || []);
                if (debatesRes.success) setDebates(debatesRes.debates || []);
                if (roomsRes.success) setRooms(roomsRes.rooms || []);
                if (usersRes.success) setUsers(usersRes.participants || []);
            }
        } catch (error) {
            toast.error("Error", "Failed to load round data");
            console.error("Failed to fetch round data:", error);
        } finally {
            setLoading(false);
        }
    }, [roundId, getToken]);

    useEffect(() => {
        fetchRoundData();
    }, [fetchRoundData]);

    // Real-time updates via WebSocket
    useRoundSocket(roundId, {
        onCheckInUpdate: (data) => {
            console.log("[Socket] Check-in update:", data);
            // Update the specific check-in in state
            setCheckIns((prev) => {
                const existing = prev.find((ci) => ci.userId === data.userId);
                if (existing) {
                    return prev.map((ci) =>
                        ci.userId === data.userId ? { ...ci, status: data.status } : ci
                    );
                }
                // If new check-in, refresh the list
                fetchRoundData();
                return prev;
            });
        },
        onPairingsGenerated: (data) => {
            console.log("[Socket] Pairings generated:", data);
            // Refresh debates
            if (data.debates) {
                setDebates(data.debates);
            } else {
                fetchRoundData();
            }
        },
        onRoomsAllocated: (data) => {
            console.log("[Socket] Rooms allocated:", data);
            fetchRoundData();
        },
        onDebateResult: (data) => {
            console.log("[Socket] Debate result:", data);
            // Update the specific debate
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
    });

    const handleGeneratePairings = async (type) => {
        if (loading) return;
        const confirmMessage =
            debates.length > 0
                ? "Regenerate pairings? This will DELETE all existing pairings/debates found in this round (except completed ones). This action cannot be undone."
                : `Generate ${type} pairings? This will end the check-in period.`;

        if (!confirm(confirmMessage)) return;
        setLoading(true);
        try {
            const token = await getToken();
            const endpoint =
                type === "round1"
                    ? `/pairing/${roundId}/round1`
                    : `/pairing/${roundId}/power-match`;
            const response = await AdminApi.apiRequest(endpoint, "POST", null, token);
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
        } catch (error) {
            toast.error("Error", "Error generating pairings");
        } finally {
            setLoading(false);
        }
    };

    const handleAllocateRooms = async (formData) => {
        if (loading) return;
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/pairing/${roundId}/allocate-rooms`,
                "POST",
                formData,
                token
            );

            if (response.success) {
                toast.success(
                    "Rooms Allocated",
                    "Allocated rooms and time slots successfully!"
                );
                setShowAllocateModal(false);
                await fetchRoundData();
            } else {
                toast.error(
                    "Allocation Failed",
                    response.error || "Failed to allocate rooms"
                );
            }
        } catch (error) {
            toast.error("Error", "Error allocating rooms");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        if (loading) return;
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(
                `/rounds/${roundId}`,
                "PUT",
                { status: newStatus },
                token
            );
            if (response.success) {
                setRound({ ...round, status: newStatus });
                toast.success("Status Updated", `Round status updated to ${newStatus}`);
            }
        } catch (error) {
            toast.error("Error", "Failed to update round status");
        }
    };

    const handleManualCheckIn = async (userId, currentStatus) => {
        if (processingId) return; // Block if any action is in progress
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
            if (response.success) {
                setCheckIns((prev) => {
                    const exists = prev.find((ci) => ci.userId === userId);
                    if (exists) {
                        return prev.map((ci) =>
                            ci.userId === userId ? { ...ci, status: newStatus } : ci
                        );
                    } else {
                        // Add new check-in record purely for UI state
                        return [...prev, { userId, status: newStatus }];
                    }
                });
                toast.success("Check-in Updated", `User marked as ${newStatus}`);
            }
        } catch (error) {
            toast.error("Error", "Failed to update check-in status");
        } finally {
            setProcessingId(null);
        }
    };

    const handleAssignJudge = (debateId, judgeName) => {
        // Optimistic Update
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

        // Debounce API Call
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
            } catch (error) {
                console.error("Error assigning judge", error);
                toast.error("Error", "Error assigning judge");
            }
        }, 500);
    };

    const handleTogglePublish = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const token = await getToken();
            const newStatus = !round.pairingsPublished;
            const response = await AdminApi.apiRequest(
                `/rounds/${roundId}`,
                "PUT",
                { pairingsPublished: newStatus },
                token
            );
            if (response.success) {
                setRound({ ...round, pairingsPublished: newStatus });
                toast.success(
                    "Visibility Updated",
                    newStatus
                        ? "Pairings are now visible to debaters!"
                        : "Pairings are now hidden from debaters."
                );
            }
        } catch (error) {
            toast.error("Error", "Failed to toggle publish status");
        } finally {
            setLoading(false);
        }
    };

    if (loading && !round) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!round) return <div>Round not found</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate(`/admin/events/${round.eventId}`)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">{round.name}</h1>
                        <p className="text-muted-foreground">
                            Round {round.roundNumber} Management
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {debates.length > 0 && (
                        <button
                            onClick={handleTogglePublish}
                            disabled={loading}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto ${round.pairingsPublished
                                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                : "bg-amber-500 text-white hover:bg-amber-600"
                                }`}
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Users className="w-4 h-4" />
                            )}
                            {round.pairingsPublished ? "Draw Public" : "Publish Draw"}
                        </button>
                    )}

                    {debates.length === 0 ? (
                        <>
                            <button
                                onClick={() =>
                                    handleGeneratePairings(
                                        round.roundNumber === 1 ? "round1" : "power-match"
                                    )
                                }
                                disabled={loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : round.roundNumber === 1 ? (
                                    <Dice5 className="w-4 h-4" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                Generate Pairings
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowAllocateModal(true)}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                            >
                                <Home className="w-4 h-4" />
                                Allocate Rooms
                            </button>
                            <button
                                onClick={() =>
                                    handleGeneratePairings(
                                        round.roundNumber === 1 ? "round1" : "power-match"
                                    )
                                }
                                disabled={loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="w-4 h-4" />
                                )}
                                Regenerate
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showAllocateModal && (
                <AllocateRoomsModal
                    onClose={() => setShowAllocateModal(false)}
                    onConfirm={handleAllocateRooms}
                    totalDebates={debates.length}
                    rooms={rooms}
                    loading={loading}
                />
            )}

            {/* Round Details Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase mb-3">
                        <Activity className="w-4 h-4 text-purple-500" />
                        Motion
                    </div>
                    {round.motion ? (
                        <p className="text-xl font-medium italic border-l-4 border-purple-500 pl-4 py-2">
                            "{round.motion}"
                        </p>
                    ) : (
                        <p className="text-muted-foreground italic">
                            No motion assigned for this round yet.
                        </p>
                    )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase mb-4">
                        <Clock className="w-4 h-4 text-purple-500" />
                        Check-in Window
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                Starts
                            </p>
                            <p className="text-sm font-medium">
                                {new Date(round.checkInStartTime).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                })}{" "}
                                IST
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                Ends
                            </p>
                            <p className="text-sm font-medium">
                                {new Date(round.checkInEndTime).toLocaleString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                })}{" "}
                                IST
                            </p>
                        </div>
                        <div className="pt-2">
                            <span
                                className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${new Date() > new Date(round.checkInEndTime)
                                    ? "bg-red-500/10 text-red-500"
                                    : new Date() < new Date(round.checkInStartTime)
                                        ? "bg-blue-500/10 text-blue-500"
                                        : "bg-green-500/10 text-green-500"
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
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border gap-4 pb-0">
                <div className="flex overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <button
                        onClick={() => setActiveTab("checkins")}
                        className={`px-3 md:px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === "checkins"
                            ? "border-purple-500 text-purple-500 bg-purple-500/5"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Check-ins ({checkIns.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("debates")}
                        className={`px-3 md:px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === "debates"
                            ? "border-purple-500 text-purple-500 bg-purple-500/5"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Debates ({debates.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("results")}
                        className={`px-3 md:px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === "results"
                            ? "border-purple-500 text-purple-500 bg-purple-500/5"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Results
                    </button>
                </div>
                <div className="relative group px-1 md:px-4 pb-2 md:pb-0">
                    <Search className="absolute left-4 md:left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
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
                        className="pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-xs focus:border-purple-500 outline-none transition-all w-full md:w-64"
                    />
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === "checkins" && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="p-4 bg-muted/20 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-4 text-xs font-bold uppercase text-muted-foreground">
                            <span>Total Participants: {users.length}</span>
                            <span className="text-green-500">
                                Present: {checkIns.filter((c) => c.status === "PRESENT").length}
                            </span>
                            <span className="text-red-500">
                                Absent:{" "}
                                {users.length -
                                    checkIns.filter((c) => c.status === "PRESENT").length}
                            </span>
                        </div>
                    </div>
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                        <table className="w-full">
                            <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 text-left">Participant</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">
                                        College
                                    </th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-6 py-12 text-center text-muted-foreground"
                                        >
                                            No participants registered in the system.
                                        </td>
                                    </tr>
                                ) : (
                                    users
                                        .filter(
                                            (user) =>
                                                !searchTerm ||
                                                `${user.firstName} ${user.lastName}`
                                                    .toLowerCase()
                                                    .includes(searchTerm.toLowerCase()) ||
                                                user.email
                                                    .toLowerCase()
                                                    .includes(searchTerm.toLowerCase()) ||
                                                user.college
                                                    ?.toLowerCase()
                                                    .includes(searchTerm.toLowerCase())
                                        )
                                        .slice(0, 100)
                                        .map((user) => {
                                            const checkIn = checkIns.find(
                                                (ci) => ci.userId === user.id
                                            );
                                            const status = checkIn?.status || "ABSENT";

                                            return (
                                                <tr
                                                    key={user.id}
                                                    className={status === "ABSENT" ? "bg-red-500/5" : ""}
                                                >
                                                    <td className="px-6 py-4">
                                                        <p className="font-semibold text-sm">
                                                            {user.firstName} {user.lastName}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {user.email}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm">
                                                        {user.college || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${status === "PRESENT"
                                                                    ? "bg-green-500/10 text-green-500"
                                                                    : "bg-red-500/10 text-red-500"
                                                                    }`}
                                                            >
                                                                {status}
                                                            </span>
                                                            {!checkIn && (
                                                                <span className="text-[9px] text-muted-foreground italic">
                                                                    (No Record)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() =>
                                                                handleManualCheckIn(user.id, status)
                                                            }
                                                            disabled={processingId === user.id}
                                                            className="text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
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
                        {users.length > 100 && !searchTerm && (
                            <div className="p-4 text-center bg-muted/5 text-xs text-muted-foreground border-t border-border">
                                Showing first 100 of {users.length} participants. Use search to
                                find specific users.
                            </div>
                        )}
                    </div>

                    {/* Mobile View (Cards) */}
                    <div className="md:hidden space-y-4 p-4">
                        {users
                            .filter(
                                (user) =>
                                    !searchTerm ||
                                    `${user.firstName} ${user.lastName}`
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase()) ||
                                    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    user.college?.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .slice(0, 100)
                            .map((user) => {
                                const checkIn = checkIns.find((ci) => ci.userId === user.id);
                                const status = checkIn?.status || "ABSENT";

                                return (
                                    <div
                                        key={user.id}
                                        className={`bg-card border border-border rounded-xl p-4 flex flex-col gap-3 ${status === "ABSENT"
                                            ? "border-l-4 border-l-red-500/20 bg-red-500/5"
                                            : "border-l-4 border-l-green-500/20"
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0 flex-1 mr-2">
                                                <h4 className="font-semibold text-sm truncate">
                                                    {user.firstName} {user.lastName}
                                                </h4>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {user.email}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                                    {user.college || "N/A"}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[10px] uppercase font-bold px-2 py-1 rounded flex-shrink-0 ${status === "PRESENT"
                                                    ? "bg-green-500/10 text-green-500"
                                                    : "bg-red-500/10 text-red-500"
                                                    }`}
                                            >
                                                {status}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleManualCheckIn(user.id, status)}
                                            disabled={processingId === user.id}
                                            className="w-full py-2.5 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                                        >
                                            {processingId === user.id && (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            )}
                                            Mark {status === "PRESENT" ? "Absent" : "Present"}
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
                        <div className="md:col-span-2 p-12 text-center border-2 border-dashed border-border rounded-3xl">
                            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                            <h3 className="font-bold text-lg">No Debates Scheduled</h3>
                            <p className="text-muted-foreground">
                                Generate pairings to create debates for this round.
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
                                    className="bg-card border border-border rounded-2xl p-5 hover:border-purple-500/30 transition-all flex flex-col justify-between"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                            Debate #{debate.id.substring(0, 4)}
                                        </span>
                                        {debate.room ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium">
                                                <MapPin className="w-3 h-3" />
                                                {debate.room.name}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-amber-500 font-medium">
                                                No Room Allocated
                                            </span>
                                        )}
                                    </div>

                                    {debate.startTime && (
                                        <div className="flex items-center justify-center gap-2 mb-4 text-[11px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 py-1 rounded-lg">
                                            <Clock className="w-3 h-3" />
                                            {new Date(debate.startTime).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            <span>-</span>
                                            {new Date(debate.endTime).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-4 mb-6">
                                        <div className="flex-1 text-center">
                                            <span className="inline-block mb-2 px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-500 uppercase tracking-widest">
                                                GOV
                                            </span>
                                            <div className="mx-auto mb-2 flex justify-center">
                                                <UserAvatar
                                                    user={debate.debater1}
                                                    imageUrl={debate.debater1.imageUrl}
                                                    size="lg"
                                                />
                                            </div>
                                            <p className="font-bold text-sm truncate">
                                                {debate.debater1.firstName} {debate.debater1.lastName}
                                            </p>
                                        </div>
                                        <div className="font-black text-2xl text-muted-foreground/20 italic pt-6">
                                            VS
                                        </div>
                                        <div className="flex-1 text-center">
                                            <span className="inline-block mb-2 px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-500 uppercase tracking-widest">
                                                OPP
                                            </span>
                                            <div className="mx-auto mb-2 flex justify-center">
                                                <UserAvatar
                                                    user={debate.debater2}
                                                    imageUrl={debate.debater2.imageUrl}
                                                    size="lg"
                                                />
                                            </div>
                                            <p className="font-bold text-sm truncate">
                                                {debate.debater2.firstName} {debate.debater2.lastName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-border">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                            <Users className="w-3 h-3" /> Adjudicator (Judge)
                                        </label>
                                        <input
                                            type="text"
                                            value={debate.judgeName || ""}
                                            onChange={(e) =>
                                                handleAssignJudge(debate.id, e.target.value)
                                            }
                                            placeholder="Enter Judge Name"
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:border-purple-500 outline-none transition-all placeholder:text-muted-foreground/50"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="w-3" />
                                            {debate.startTime
                                                ? new Date(debate.startTime).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })
                                                : "TBD"}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/admin/results/${debate.id}`)}
                                            className="text-xs font-bold text-purple-500 hover:text-purple-600 transition-colors px-3 py-1 rounded bg-purple-500/5"
                                        >
                                            Enter Result
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
                    <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto no-scrollbar">
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
                                    {debates.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="4"
                                                className="px-6 py-12 text-center text-muted-foreground"
                                            >
                                                No results available.
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
                                                    className="hover:bg-muted/20 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-sm font-medium">
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater1Id
                                                                            ? "text-green-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater1.firstName}
                                                                </span>
                                                                <span className="text-muted-foreground mx-2">
                                                                    vs
                                                                </span>
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater2Id
                                                                            ? "text-green-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater2.firstName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {debate.status === "COMPLETED" ? (
                                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50 border border-border text-xs font-mono">
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater1Id
                                                                            ? "text-green-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater1Score}
                                                                </span>
                                                                <span className="text-muted-foreground">-</span>
                                                                <span
                                                                    className={
                                                                        debate.winnerId === debate.debater2Id
                                                                            ? "text-green-500 font-bold"
                                                                            : ""
                                                                    }
                                                                >
                                                                    {debate.debater2Score}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {debate.status === "COMPLETED" ? (
                                                            <div className="flex items-center gap-2 text-sm font-bold text-purple-500">
                                                                <Trophy className="w-3.5 h-3.5" />
                                                                {debate.winnerId === debate.debater1Id
                                                                    ? debate.debater1.firstName
                                                                    : debate.debater2.firstName}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                -
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() =>
                                                                navigate(`/admin/results/${debate.id}`)
                                                            }
                                                            className="text-xs font-bold text-purple-500 hover:text-purple-600 transition-colors"
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
                    <div className="md:hidden space-y-4">
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
                                    className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                            Matchup
                                        </span>
                                        {debate.status === "COMPLETED" ? (
                                            <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold">
                                                COMPLETED
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold">
                                                PENDING
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div
                                            className={`flex-1 text-center ${debate.winnerId === debate.debater1Id
                                                ? "text-green-500 font-bold"
                                                : ""
                                                }`}
                                        >
                                            <p className="text-sm truncate font-medium">
                                                {debate.debater1.firstName}
                                            </p>
                                            {debate.status === "COMPLETED" && (
                                                <p className="text-lg font-mono font-bold mt-1">
                                                    {debate.debater1Score}
                                                </p>
                                            )}
                                        </div>

                                        <div className="px-4 text-muted-foreground text-xs font-black">
                                            VS
                                        </div>

                                        <div
                                            className={`flex-1 text-center ${debate.winnerId === debate.debater2Id
                                                ? "text-green-500 font-bold"
                                                : ""
                                                }`}
                                        >
                                            <p className="text-sm truncate font-medium">
                                                {debate.debater2.firstName}
                                            </p>
                                            {debate.status === "COMPLETED" && (
                                                <p className="text-lg font-mono font-bold mt-1">
                                                    {debate.debater2Score}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate(`/admin/results/${debate.id}`)}
                                        className="w-full py-2.5 rounded-lg text-sm font-bold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors"
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
    const { toast } = useToast();
    const [selectedRoomIds, setSelectedRoomIds] = useState(
        rooms.map((r) => r.id)
    );
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        startTime: new Date().toISOString().slice(0, 16),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-border rounded-3xl p-8 w-full max-w-2xl shadow-2xl my-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            Schedule & Room Allocation
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure individual time spans for {totalDebates} debates.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                    {/* Left Column: Configuration */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                    Round Start Time
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.startTime}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                startTime: e.target.value,
                                            })
                                        }
                                        style={{ colorScheme: "dark" }}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-purple-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                        Speaking Time (Per Debater)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
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
                                            className="flex-1 accent-purple-500"
                                        />
                                        <span className="w-12 text-center font-bold text-purple-500 bg-purple-500/10 py-1 rounded-lg">
                                            {formData.speakingTime}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                        Buffer & Transition (min)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
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
                                        <span className="w-12 text-center font-bold text-blue-500 bg-blue-500/10 py-1 rounded-lg">
                                            {formData.bufferTime}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                        Gap Between Debates (min)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
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
                                        <span className="w-12 text-center font-bold text-amber-500 bg-amber-500/10 py-1 rounded-lg">
                                            {formData.gap}m
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                            <h4 className="text-[10px] font-bold uppercase text-purple-600 mb-2">
                                Schedule Summary
                            </h4>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Debates per Room</span>
                                <span className="font-bold text-purple-500">
                                    {debatesPerRoom}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Time per Group</span>
                                <span className="font-bold text-purple-500">
                                    {debateDuration}m + {formData.gap}m gap
                                </span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-purple-500/10">
                                <span className="font-bold">Estimated Total Time</span>
                                <span className="font-bold text-purple-600">
                                    {Math.floor(totalTimeNeeded / 60)}h {totalTimeNeeded % 60}m
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Room Selection & Preview */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                                Select Available Rooms ({selectedRoomIds.length}/{rooms.length})
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {rooms.map((room) => (
                                    <button
                                        key={room.id}
                                        type="button"
                                        onClick={() => toggleRoom(room.id)}
                                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left flex items-center gap-2 ${selectedRoomIds.includes(room.id)
                                            ? "bg-purple-500/10 border-purple-500 text-purple-500"
                                            : "bg-muted/30 border-border text-muted-foreground"
                                            }`}
                                    >
                                        <div
                                            className={`w-2 h-2 rounded-full ${selectedRoomIds.includes(room.id)
                                                ? "bg-purple-500"
                                                : "bg-muted-foreground/30"
                                                }`}
                                        />
                                        {room.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Schedule Sequence Preview
                            </label>
                            <div className="space-y-2">
                                {previewSlots.map((slot, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border text-[11px]"
                                    >
                                        <span className="w-14 font-bold text-muted-foreground uppercase">
                                            Slot {idx + 1}
                                        </span>
                                        <div className="flex-1 flex items-center justify-between">
                                            <span className="font-medium">
                                                {slot.start.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <div className="h-px flex-1 mx-2 bg-border" />
                                            <span className="font-medium">
                                                {slot.end.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        <span className="text-blue-500 font-bold">
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

                        <div className="flex gap-3 pt-4 mt-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-border hover:bg-muted font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || localSubmitting}
                                className="flex-[2] py-3 rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-600 shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            </motion.div>
        </div>
    );
}
