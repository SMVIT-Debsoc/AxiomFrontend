import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users,
    Search,
    UserPlus,
    MoreVertical,
    Mail,
    Shield,
    Trash2,
    Loader2
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { UserApi } from "../../services/api";
import { UserAvatar } from "../../components/ui/UserAvatar";

export default function AdminParticipants() {
    const { getToken } = useAuth();
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchParticipants = async () => {
            try {
                const token = await getToken();
                // We'll use the user list endpoint for admins
                const response = await UserApi.list(token);
                if (response.success) {
                    setParticipants(response.users || []);
                }
            } catch (error) {
                console.error("Failed to fetch participants:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchParticipants();
    }, [getToken]);

    const filteredParticipants = participants.filter((p) =>
        (p.firstName + " " + p.lastName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete participant: ${name}?`)) return;
        try {
            const token = await getToken();
            const response = await UserApi.deleteParticipant(id, token);
            if (response.success) {
                setParticipants(participants.filter(p => p.id !== id));
            } else {
                alert(response.error || "Failed to delete participant");
            }
        } catch (error) {
            alert("Error deleting participant");
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
                    <h1 className="text-3xl font-bold">Participants</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage all debaters registered on the platform
                    </p>
                </div>
            </div>

            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
                />
            </div>

            {filteredParticipants.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border rounded-2xl">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-xl font-bold mb-2">No Participants Found</h3>
                    <p className="text-muted-foreground">
                        Try a different search query or wait for users to register.
                    </p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 text-left">User</th>
                                    <th className="px-6 py-4 text-left hidden md:table-cell">Contact</th>
                                    <th className="px-6 py-4 text-left hidden md:table-cell">College</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredParticipants.map((p, index) => (
                                    <motion.tr
                                        key={p.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-muted/20 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={p} size="md" />
                                                <div>
                                                    <p className="font-semibold text-sm">
                                                        {p.firstName} {p.lastName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        ID: {p.id.substring(0, 8)}...
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Mail className="w-3 h-3" />
                                                    {p.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell text-sm text-muted-foreground">
                                            {p.college || "Not provided"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${p.isProfileComplete
                                                ? 'bg-green-500/10 text-green-500'
                                                : 'bg-amber-500/10 text-amber-500'
                                                }`}>
                                                {p.isProfileComplete ? 'Complete' : 'Incomplete'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDelete(p.id, `${p.firstName} ${p.lastName}`)}
                                                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Participant"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => alert(`More actions for ${p.firstName} coming soon (Edit, Role Change).`)}
                                                    className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
