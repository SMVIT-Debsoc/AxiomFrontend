import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Trophy,
    Search,
    Filter,
    Calendar,
    ChevronRight,
    Loader2,
    CheckCircle2
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { AdminApi } from "../../services/api";

export default function AdminResults() {
    const { getToken } = useAuth();
    const [debates, setDebates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    useEffect(() => {
        const fetchDebates = async () => {
            try {
                const token = await getToken();
                // We'll fetch from dashboard which has recent debates, or use a general list if available
                const response = await AdminApi.getDashboard(token);
                if (response.success) {
                    // For now using recent debates from dashboard, in production we'd want a dedicated endpoint
                    setDebates(response.data.recentDebates || []);
                }
            } catch (error) {
                console.error("Failed to fetch debates:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDebates();
    }, []);

    const filteredDebates = debates.filter((d) => {
        const matchesSearch =
            d.debater1.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.debater2.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.round.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Results & Scores</h1>
                <p className="text-muted-foreground mt-1">Monitor and manage debate outcomes</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by debater or round..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none"
                    >
                        <option value="ALL">All Status</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="ONGOING">Ongoing</option>
                        <option value="SCHEDULED">Scheduled</option>
                    </select>
                </div>
            </div>

            {filteredDebates.length === 0 ? (
                <div className="text-center py-20 bg-card border border-border rounded-2xl">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-xl font-bold mb-2">No Debates Found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 text-left">Matchup</th>
                                    <th className="px-6 py-4 text-left">Round</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-left">Winner</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredDebates.map((d, index) => (
                                    <motion.tr
                                        key={d.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-muted/20 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-sm">
                                                    {d.debater1.firstName} vs {d.debater2.firstName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                <p className="font-medium">{d.round.name}</p>
                                                <p className="text-xs text-muted-foreground">Event ID: {d.round.eventId.substring(0, 8)}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${d.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' :
                                                    d.status === 'ONGOING' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
                                                }`}>
                                                {d.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {d.winnerId ? (
                                                <div className="flex items-center gap-2 text-sm font-bold text-purple-500">
                                                    <Trophy className="w-3.5 h-3.5" />
                                                    {d.winnerId === d.debater1Id ? d.debater1.firstName : d.debater2.firstName}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground italic">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/admin/results/${d.id}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-500 hover:text-purple-600"
                                            >
                                                {d.status === 'COMPLETED' ? 'Edit Result' : 'Enter Result'}
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
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
