import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    MapPin,
    Plus,
    Search,
    Trash2,
    Edit,
    Loader2,
    Building2,
    Users
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";

export default function AdminRooms() {
    const { getToken } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const token = await getToken();
            const response = await AdminApi.apiRequest("/rooms", "GET", null, token);
            if (response.success) {
                setRooms(response.rooms || []);
            }
        } catch (error) {
            console.error("Failed to fetch rooms:", error);
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
            const response = await AdminApi.deleteRoom(id, token);
            if (response.success) {
                setRooms(rooms.filter(r => r.id !== id));
            }
        } catch (error) {
            alert("Failed to delete room");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Room Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure venues and halls for debates
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Room
                </button>
            </div>

            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
                />
            </div>

            {filteredRooms.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border rounded-2xl">
                    <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-xl font-bold mb-2">No Rooms Found</h3>
                    <p className="text-muted-foreground mb-6">
                        Add rooms to start allocating debates
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Add First Room
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRooms.map((room, index) => (
                        <motion.div
                            key={room.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-card border border-border rounded-2xl p-6 group hover:border-purple-500/50 transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-purple-500" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(room.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold mb-1">{room.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>Capacity: {room.capacity} people</span>
                            </div>
                        </motion.div>
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
        } catch (error) {
            alert("Error creating room");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4"
            >
                <h2 className="text-xl font-bold mb-4">Add New Room</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Room Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                            placeholder="Room 101, Hall A, etc."
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Capacity</label>
                        <input
                            type="number"
                            required
                            min="2"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Room"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
