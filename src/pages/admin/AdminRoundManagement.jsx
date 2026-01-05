import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Users,
    Activity,
    MapPin,
    Play,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    Clock,
    UserPlus,
    XCircle,
    Dice5,
    Zap,
    Home,
    Search
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";

export default function AdminRoundManagement() {
    const { id: roundId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();

    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("checkins");

    useEffect(() => {
        fetchRoundData();
    }, [roundId]);

    const fetchRoundData = async () => {
        try {
            const token = await getToken();
            const [roundRes, checkInsRes, debatesRes, roomsRes] = await Promise.all([
                AdminApi.apiRequest(`/rounds/${roundId}`, "GET", null, token),
                AdminApi.apiRequest(`/check-in/round/${roundId}`, "GET", null, token),
                AdminApi.apiRequest(`/debates/round/${roundId}`, "GET", null, token),
                AdminApi.apiRequest(`/rooms`, "GET", null, token)
            ]);

            if (roundRes.success) setRound(roundRes.round);
            if (checkInsRes.success) setCheckIns(checkInsRes.checkIns || []);
            if (debatesRes.success) setDebates(debatesRes.debates || []);
            if (roomsRes.success) setRooms(roomsRes.rooms || []);
        } catch (error) {
            console.error("Failed to fetch round data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePairings = async (type) => {
        if (!confirm(`Generate ${type} pairings? This will end the check-in period.`)) return;
        setLoading(true);
        try {
            const token = await getToken();
            const endpoint = type === 'round1' ? `/pairing/${roundId}/round1` : `/pairing/${roundId}/power-match`;
            const response = await AdminApi.apiRequest(endpoint, "POST", null, token);
            if (response.success) {
                alert(`Successfully generated ${response.data.pairingsCreated} pairings!`);
                await fetchRoundData();
                setActiveTab("debates");
            } else {
                alert(response.error || "Failed to generate pairings");
            }
        } catch (error) {
            alert("Error generating pairings");
        } finally {
            setLoading(false);
        }
    };

    const handleAllocateRooms = async () => {
        const timeInput = prompt("Enter debate start time (e.g. 2026-03-01T16:00:00Z)", new Date().toISOString());
        if (!timeInput) return;

        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(`/pairing/${roundId}/allocate-rooms`, "POST", {
                timeSlots: [{ startTime: timeInput, endTime: new Date(new Date(timeInput).getTime() + 3600000).toISOString() }]
            }, token);

            if (response.success) {
                alert(`Allocated rooms for ${response.data.debatesAllocated} debates!`);
                await fetchRoundData();
            } else {
                alert(response.error || "Failed to allocate rooms");
            }
        } catch (error) {
            alert("Error allocating rooms");
        } finally {
            setLoading(false);
        }
    };

    const handleManualCheckIn = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(`/check-in/round/${roundId}/user/${userId}`, "PUT", { status: newStatus }, token);
            if (response.success) {
                setCheckIns(checkIns.map(ci => ci.userId === userId ? { ...ci, status: newStatus } : ci));
            }
        } catch (error) {
            alert("Failed to update check-in status");
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/admin/events/${round.eventId}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">{round.name}</h1>
                        <p className="text-muted-foreground">Round {round.roundNumber} Management</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {debates.length === 0 ? (
                        <>
                            <button
                                onClick={() => handleGeneratePairings(round.roundNumber === 1 ? 'round1' : 'power-match')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors"
                            >
                                {round.roundNumber === 1 ? <Dice5 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                Generate Pairings
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleAllocateRooms}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Allocate Rooms
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab("checkins")}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'checkins' ? 'border-purple-500 text-purple-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Check-ins ({checkIns.length})
                </button>
                <button
                    onClick={() => setActiveTab("debates")}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'debates' ? 'border-purple-500 text-purple-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Debates ({debates.length})
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === "checkins" ? (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 text-left">Participant</th>
                                <th className="px-6 py-4 text-left">College</th>
                                <th className="px-6 py-4 text-left">Internal ID</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {checkIns.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground">
                                        No check-ins recorded for this round yet.
                                    </td>
                                </tr>
                            ) : (
                                checkIns.map((ci) => (
                                    <tr key={ci.id}>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-sm">{ci.user.firstName} {ci.user.lastName}</p>
                                            <p className="text-xs text-muted-foreground">{ci.user.email}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{ci.user.college}</td>
                                        <td className="px-6 py-4 text-xs font-mono">{ci.userId.substring(0, 8)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${ci.status === 'PRESENT' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {ci.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleManualCheckIn(ci.userId, ci.status)}
                                                className="text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors"
                                            >
                                                Mark {ci.status === 'PRESENT' ? 'Absent' : 'Present'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}

                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debates.length === 0 ? (
                        <div className="md:col-span-2 p-12 text-center border-2 border-dashed border-border rounded-3xl">
                            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                            <h3 className="font-bold text-lg">No Debates Scheduled</h3>
                            <p className="text-muted-foreground">Generate pairings to create debates for this round.</p>
                        </div>
                    ) : (
                        debates.map((debate) => (
                            <div key={debate.id} className="bg-card border border-border rounded-2xl p-5 hover:border-purple-500/30 transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Debate #{debate.id.substring(0, 4)}</span>
                                    {debate.room ? (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium">
                                            <MapPin className="w-3 h-3" />
                                            {debate.room.name}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-amber-500 font-medium">No Room Allocated</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="flex-1 text-center">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2 text-blue-500 font-bold">
                                            {debate.debater1.firstName[0]}
                                        </div>
                                        <p className="font-bold text-sm truncate">{debate.debater1.firstName}</p>
                                    </div>
                                    <div className="font-black text-2xl text-muted-foreground/20 italic">VS</div>
                                    <div className="flex-1 text-center">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2 text-purple-500 font-bold">
                                            {debate.debater2.firstName[0]}
                                        </div>
                                        <p className="font-bold text-sm truncate">{debate.debater2.firstName}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="w-3" />
                                        {debate.startTime ? new Date(debate.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD"}
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
        </div>
    );
}
