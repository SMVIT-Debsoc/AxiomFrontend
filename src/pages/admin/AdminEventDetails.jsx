import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Calendar,
    Clock,
    Plus,
    ChevronRight,
    Settings,
    Users,
    Activity,
    Trophy,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Info
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi, EventApi } from "../../services/api";

export default function AdminEventDetails() {
    const { id: eventId } = useParams();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [stats, setStats] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateRound, setShowCreateRound] = useState(false);
    const [showEditEvent, setShowEditEvent] = useState(false);
    const [editingRound, setEditingRound] = useState(null);
    const [activeTab, setActiveTab] = useState("rounds");

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        try {
            const token = await getToken();
            const results = await Promise.allSettled([
                EventApi.getById(eventId, token),
                AdminApi.apiRequest(`/rounds/event/${eventId}`, "GET", null, token),
                AdminApi.apiRequest(`/stats/event/${eventId}`, "GET", null, token),
                EventApi.getParticipants(eventId, token)
            ]);

            const [eventRes, roundsRes, statsRes, participantsRes] = results;

            if (eventRes.status === "fulfilled" && eventRes.value.success) {
                setEvent(eventRes.value.event);
            } else {
                console.error("Event fetch failed:", eventRes);
            }

            if (roundsRes.status === "fulfilled" && roundsRes.value.success) {
                setRounds(roundsRes.value.rounds || []);
            }

            if (statsRes.status === "fulfilled" && statsRes.value.success) {
                setStats(statsRes.value.data);
            }

            if (participantsRes.status === "fulfilled" && participantsRes.value.success) {
                setParticipants(participantsRes.value.participants || []);
            }
        } catch (error) {
            console.error("Failed to fetch event data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRound = async (id) => {
        if (!confirm("Are you sure you want to delete this round? All pairings and results will be lost.")) return;
        try {
            const token = await getToken();
            const response = await AdminApi.deleteRound(id, token);
            if (response.success) {
                fetchData();
            } else {
                alert(response.error || "Failed to delete round");
            }
        } catch (error) {
            alert("Error deleting round");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!event) return <div>Event not found</div>;

    const statsCards = [
        { label: "Check-ins", value: stats?.checkIns?.present || 0, total: stats?.checkIns?.total, icon: Users, color: "text-blue-500" },
        { label: "Rounds", value: rounds.length, icon: Activity, color: "text-purple-500" },
        { label: "Debates", value: stats?.debates?.completed || 0, total: stats?.debates?.total, icon: CheckCircle2, color: "text-green-500" },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/admin/events")} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">{event.name}</h1>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${event.status === 'ONGOING' ? 'bg-green-500/10 text-green-500' :
                                event.status === 'UPCOMING' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
                                }`}>
                                {event.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{event.description || "No description provided"}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowEditEvent(true)}
                        className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        title="Edit Event Settings"
                    >
                        <Settings className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => setShowCreateRound(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Round {rounds.length + 1}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statsCards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm text-muted-foreground font-medium mb-1">{card.label}</p>
                            <h3 className="text-2xl font-bold">
                                {card.value}{card.total ? <span className="text-base text-muted-foreground font-normal"> / {card.total}</span> : ""}
                            </h3>
                        </div>
                        <card.icon className={`w-8 h-8 ${card.color} opacity-20`} />
                    </motion.div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-6 border-b border-border mb-6">
                <button
                    onClick={() => setActiveTab("rounds")}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "rounds"
                        ? "border-purple-500 text-purple-500"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Rounds
                </button>
                <button
                    onClick={() => setActiveTab("participants")}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "participants"
                        ? "border-purple-500 text-purple-500"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Participants ({participants.length})
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === "rounds" ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Tournament Rounds</h2>
                            </div>

                            {rounds.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20">
                                    <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                                    <h3 className="font-bold text-lg">No Rounds Created</h3>
                                    <p className="text-muted-foreground mb-6">Start your tournament by creating the first round.</p>
                                    <button
                                        onClick={() => setShowCreateRound(true)}
                                        className="px-4 py-2 rounded-lg bg-muted border border-border hover:bg-muted/80 font-medium transition-all"
                                    >
                                        Create Round 1
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {rounds.map((round) => (
                                        <Link
                                            key={round.id}
                                            to={`/admin/rounds/${round.id}`}
                                            className="block group bg-card border border-border rounded-2xl p-4 hover:border-purple-500/50 transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center font-bold text-purple-500">
                                                        {round.roundNumber}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold">{round.name}</h4>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(round.checkInStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className={`w-1 h-1 rounded-full bg-border`} />
                                                            <span className={`capitalize ${round.status === 'ONGOING' ? 'text-green-500' :
                                                                round.status === 'COMPLETED' ? 'text-blue-500' : 'text-muted-foreground'
                                                                }`}>
                                                                {round.status.toLowerCase()}
                                                            </span>
                                                            {round.pairingsPublished && (
                                                                <>
                                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                                    <span className="text-[10px] font-bold uppercase text-green-500">Public</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setEditingRound(round);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleDeleteRound(round.id);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                                                </div>
                                            </div>
                                            {round.motion && (
                                                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm italic text-muted-foreground border-l-2 border-purple-500/30">
                                                    "{round.motion}"
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Enrolled Participants</h2>
                            </div>

                            {participants.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20">
                                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                                    <h3 className="font-bold text-lg">No Participants Yet</h3>
                                    <p className="text-muted-foreground">Share the event code or link to get debaters to enroll.</p>
                                </div>
                            ) : (
                                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                                                <tr>
                                                    <th className="px-6 py-4 text-left">Debater</th>
                                                    <th className="px-6 py-4 text-left">College</th>
                                                    <th className="px-6 py-4 text-left">Email</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {participants.map((p) => (
                                                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center font-bold text-purple-500 text-xs">
                                                                    {p.firstName?.[0]}{p.lastName?.[0]}
                                                                </div>
                                                                <span className="font-medium">{p.firstName} {p.lastName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                                            {p.college || "N/A"}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                                            {p.email}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4 text-purple-500" />
                            Event Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Start Date</p>
                                <p className="text-sm font-medium">{new Date(event.startDate).toLocaleDateString()} at {new Date(event.startDate).toLocaleTimeString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">End Date</p>
                                <p className="text-sm font-medium">{new Date(event.endDate).toLocaleDateString()} at {new Date(event.endDate).toLocaleTimeString()}</p>
                            </div>
                            <hr className="border-border" />
                            <div className="pt-2">
                                <Link to={`/dashboard/events/${eventId}`} className="text-sm text-purple-500 hover:underline flex items-center gap-1">
                                    View public page <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-900/10 border border-purple-500/20 rounded-2xl p-6">
                        <h3 className="font-bold text-purple-600 mb-2">Admin Notice</h3>
                        <p className="text-xs text-purple-600/80 leading-relaxed">
                            Generating pairings for a round will automatically close the check-in window and mark absent users as eliminated for single-elimination events.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal Components */}
            {showCreateRound && (
                <CreateRoundModal
                    eventId={eventId}
                    roundNumber={rounds.length + 1}
                    onClose={() => setShowCreateRound(false)}
                    onCreated={() => {
                        setShowCreateRound(false);
                        fetchData();
                    }}
                />
            )}

            {showEditEvent && (
                <EditEventModal
                    event={event}
                    onClose={() => setShowEditEvent(false)}
                    onUpdated={() => {
                        setShowEditEvent(false);
                        fetchData();
                    }}
                />
            )}

            {editingRound && (
                <EditRoundModal
                    round={editingRound}
                    onClose={() => setEditingRound(null)}
                    onUpdated={() => {
                        setEditingRound(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}

function CreateRoundModal({ eventId, roundNumber, onClose, onCreated }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);

    // Helper to get local datetime string
    const toLocalDateTimeString = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };
    const [formData, setFormData] = useState({
        eventId,
        roundNumber,
        name: `Preliminary Round ${roundNumber}`,
        motion: "",
        checkInStartTime: toLocalDateTimeString(new Date()),
        checkInEndTime: toLocalDateTimeString(new Date(Date.now() + 3600000)),
        status: "UPCOMING"
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.createRound(formData, token);
            if (response.success) {
                onCreated();
            } else {
                alert(response.error || "Failed to create round");
            }
        } catch (error) {
            alert("Error creating round");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
                <h2 className="text-xl font-bold mb-6">Create Round {roundNumber}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium mb-1 block">Round Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium mb-1 block">Debate Motion (Optional)</label>
                            <textarea
                                value={formData.motion}
                                onChange={(e) => setFormData({ ...formData, motion: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none resize-none"
                                rows={3}
                                placeholder="This house believes that..."
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Check-in Start</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.checkInStartTime}
                                onChange={(e) => setFormData({ ...formData, checkInStartTime: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Check-in End</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.checkInEndTime}
                                onChange={(e) => setFormData({ ...formData, checkInEndTime: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors opacity-70"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-2 px-8 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Round"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
function EditEventModal({ event, onClose, onUpdated }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: event.name || "",
        description: event.description || "",
        startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : "",
        endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "",
        status: event.status || "UPCOMING"
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.updateEvent(event.id, formData, token);
            if (response.success) {
                onUpdated();
            } else {
                alert(response.error || "Failed to update event");
            }
        } catch (error) {
            alert("Error updating event");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-foreground">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Edit Event Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Event Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Start Date</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">End Date</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                        >
                            <option value="UPCOMING">Upcoming</option>
                            <option value="ONGOING">Ongoing</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-border mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors opacity-70"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-2 px-8 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Updating..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function EditRoundModal({ round, onClose, onUpdated }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    // Helper function to convert UTC to local datetime-local format
    const toLocalDateTimeString = (utcDate) => {
        if (!utcDate) return "";
        const date = new Date(utcDate);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const [formData, setFormData] = useState({
        name: round.name || "",
        motion: round.motion || "",
        checkInStartTime: toLocalDateTimeString(round.checkInStartTime),
        checkInEndTime: toLocalDateTimeString(round.checkInEndTime),
        status: round.status || "UPCOMING",
        pairingsPublished: round.pairingsPublished || false
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.updateRound(round.id, formData, token);
            if (response.success) {
                onUpdated();
            } else {
                alert(response.error || "Failed to update round");
            }
        } catch (error) {
            alert("Error updating round");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-foreground">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Edit Round</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Round Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Debate Motion</label>
                        <textarea
                            value={formData.motion}
                            onChange={(e) => setFormData({ ...formData, motion: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Check-in Start</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.checkInStartTime}
                                onChange={(e) => setFormData({ ...formData, checkInStartTime: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Check-in End</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.checkInEndTime}
                                onChange={(e) => setFormData({ ...formData, checkInEndTime: e.target.value })}
                                style={{ colorScheme: "dark" }}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                        >
                            <option value="UPCOMING">Upcoming</option>
                            <option value="ONGOING">Ongoing</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-border text-purple-600 focus:ring-purple-500"
                            id="pairingsPublished"
                            checked={formData.pairingsPublished}
                            onChange={(e) => setFormData({ ...formData, pairingsPublished: e.target.checked })}
                        />
                        <label htmlFor="pairingsPublished" className="text-sm font-medium cursor-pointer">
                            Publish Draw (Makes pairings visible to debaters)
                        </label>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-border mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors opacity-70"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-2 px-8 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Updating..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
