import ModalSurface from "../../components/ui/ModalSurface";
import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import {
    MapPin,
    Plus,
    Search,
    Trash2,
    Edit,
    Loader2,
    Building2,
    Users,
    X,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";

export default function AdminRooms() {
    const { getToken } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState(null);
    const [, setUsers] = useState([]);

    useEffect(() => {
        fetchRooms();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchRooms = async () => {
        try {
            const token = await getToken();
            const results = await Promise.allSettled([
                AdminApi.apiRequest("/rooms", "GET", null, token),
                AdminApi.apiRequest("/users", "GET", null, token)
            ]);

            const [roomsRes, usersRes] = results;

            if (roomsRes.status === "fulfilled" && roomsRes.value.success) {
                setRooms(roomsRes.value.rooms || []);
            }

            if (usersRes.status === "fulfilled" && usersRes.value.success) {
                setUsers(usersRes.value.users || []);
            }
        } catch (error) {
            console.error("Failed to fetch rooms/users:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRooms = rooms.filter((room) =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this room?")) return;
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(`/rooms/${id}`, "DELETE", null, token);
            if (response.success) {
                setRooms(rooms.filter(r => r.id !== id));
            }
        } catch {
            alert("Failed to delete room");
        }
    };

    const handleAssignJudge = async (debateId, judgeName) => {
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(`/debates/${debateId}`, "PUT", { judgeName }, token);
            if (response.success) {
                fetchRooms();
            } else {
                alert(response.error || "Failed to assign judge");
            }
        } catch {
            alert("Error assigning judge");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading rooms" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
                            AXIOM 4.0
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                            Venues
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                        Room Management
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-0.5 font-sans">
                        Configure competition venues, hall capacities, and active adjudicator allocations
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Add Room</span>
                </button>
            </div>

            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                    type="text"
                    placeholder="Search rooms by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search rooms"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
                />
            </div>

            {filteredRooms.length === 0 ? (
                <div className="text-center py-16 bg-card/60 border border-border/70 rounded-xl">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" aria-hidden="true" />
                    <h3 className="text-lg font-heading font-bold mb-1 text-foreground">No Rooms Configured</h3>
                    <p className="text-sm text-muted-foreground mb-5 font-sans">
                        {searchQuery ? "No rooms matched your search." : "Add rooms to start allocating debate matchups."}
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-sans font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Add First Room</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredRooms.map((room, index) => (
                        <Motion.div
                            key={room.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className="bg-card/70 border border-border/70 rounded-xl p-5 group hover:border-primary/40 transition-all backdrop-blur-sm flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                                    </div>
                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingRoom(room)}
                                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label={`Edit ${room.name}`}
                                            title="Edit Room"
                                        >
                                            <Edit className="w-4 h-4" aria-hidden="true" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(room.id)}
                                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label={`Delete ${room.name}`}
                                            title="Delete Room"
                                        >
                                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-base font-heading font-bold text-foreground mb-1">{room.name}</h3>
                                <div className="space-y-3 font-sans">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Capacity: {room.capacity} participants</span>
                                    </div>

                                    <div className="pt-2.5 border-t border-border/60">
                                        <label htmlFor={`room-judge-${room.id}`} className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
                                            Active Adjudicator
                                        </label>
                                        {room.debates?.[0] ? (
                                            <input
                                                id={`room-judge-${room.id}`}
                                                type="text"
                                                defaultValue={room.debates[0].judgeName || (room.debates[0].adjudicator ? `${room.debates[0].adjudicator.firstName} ${room.debates[0].adjudicator.lastName}` : "")}
                                                onBlur={(e) => handleAssignJudge(room.debates[0].id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="w-full text-xs bg-background border border-border/70 rounded-md px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                                                placeholder="Enter judge name"
                                            />
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">No active debate assigned</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Motion.div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreateRoomModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        fetchRooms();
                    }}
                />
            )}

            {editingRoom && (
                <EditRoomModal
                    room={editingRoom}
                    onClose={() => setEditingRoom(null)}
                    onUpdated={() => {
                        setEditingRoom(null);
                        fetchRooms();
                    }}
                />
            )}
        </div>
    );
}

function CreateRoomModal({ onClose, onCreated }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        capacity: 2
    });


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.createRoom(formData, token);
            if (response.success) {
                onCreated();
            } else {
                alert(response.error || "Failed to create room");
            }
        } catch {
            alert("Error creating room");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalSurface onDismiss={onClose}
            aria-label="Add New Room"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-md shadow-xl"
            >
                <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                    <h2 className="text-lg font-heading font-bold text-foreground">Add New Room</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
                    <label ><span className="text-xs font-semibold mb-1 block text-foreground">Room Name</span><input type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="Hall A, Room 204, etc." /></label>
                    <label ><span className="text-xs font-semibold mb-1 block text-foreground">Capacity</span><input type="number"
                    required
                    min="2"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
                    <div className="flex gap-2.5 pt-3 border-t border-border/60">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
                        >
                            {loading ? "Creating..." : "Create Room"}
                        </button>
                    </div>
                </form>
            </Motion.div>
        </ModalSurface>
    );
}

function EditRoomModal({ room, onClose, onUpdated }) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: room.name || "",
        capacity: room.capacity || 2
    });


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest(`/rooms/${room.id}`, "PUT", formData, token);
            if (response.success) {
                onUpdated();
            } else {
                alert(response.error || "Failed to update room");
            }
        } catch {
            alert("Error updating room");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalSurface onDismiss={onClose}
            aria-label="Edit Room"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-md shadow-xl"
            >
                <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                    <h2 className="text-lg font-heading font-bold text-foreground">Edit Room</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
                    <label ><span className="text-xs font-semibold mb-1 block text-foreground">Room Name</span><input type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
                    <label ><span className="text-xs font-semibold mb-1 block text-foreground">Capacity</span><input type="number"
                    required
                    min="2"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
                    <div className="flex gap-2.5 pt-3 border-t border-border/60">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
                        >
                            {loading ? "Updating..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </Motion.div>
        </ModalSurface>
    );
}
