import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Calendar,
    Users,
    Trophy,
    TrendingUp,
    Activity,
    Plus,
    ShieldCheck,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { AdminApi } from "../../services/api";

export default function AdminDashboard() {
    const { getToken } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentEvents, setRecentEvents] = useState([]);
    const [recentDebates, setRecentDebates] = useState([]);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = await getToken();

                // Fetch admin dashboard stats
                const response = await AdminApi.getDashboard(token);
                if (response.success && response.data) {
                    setStats(response.data.overview);
                    setRecentEvents(response.data.recentEvents || []);
                    setRecentDebates(response.data.recentDebates || []);
                }
            } catch (error) {
                console.error("Failed to fetch admin dashboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [getToken]);

    const statCards = [
        {
            label: "Total Events",
            value: stats?.totalEvents || 0,
            icon: Calendar,
            color: "bg-blue-500",
            change: `${stats?.activeEvents || 0} active currently`,
        },
        {
            label: "Active Participants",
            value: stats?.totalUsers || 0,
            icon: Users,
            color: "bg-green-500",
            change: "Across all events",
        },
        {
            label: "Debates Completed",
            value: stats?.completedDebates || 0,
            icon: Trophy,
            color: "bg-amber-500",
            change: `${stats?.completionRate || 0}% completion rate`,
        },
        {
            label: "Total Rooms",
            value: stats?.totalRooms || 0,
            icon: Activity,
            color: "bg-purple-500",
            change: "Setup for events",
        },
    ];

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your debate platform
                    </p>
                </div>
                <Link
                    to="/admin/events"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Event
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-card border border-border rounded-2xl p-6"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className={`w-12 h-12 rounded-xl ${stat.color}/10 flex items-center justify-center`}
                                >
                                    <Icon
                                        className={`w-6 h-6 ${stat.color.replace(
                                            "bg-",
                                            "text-"
                                        )}`}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {stat.change}
                                </span>
                            </div>
                            <div className="text-3xl font-bold mb-1">
                                {stat.value}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {stat.label}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Quick Actions & Recent Events Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-1">
                    <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            to="/admin/events"
                            className="p-4 rounded-xl border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-center"
                        >
                            <Calendar className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                            <span className="text-sm font-medium">Events</span>
                        </Link>
                        <Link
                            to="/admin/rounds"
                            className="p-4 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-center"
                        >
                            <Activity className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                            <span className="text-sm font-medium">Rounds</span>
                        </Link>
                        <Link
                            to="/admin/participants"
                            className="p-4 rounded-xl border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all text-center"
                        >
                            <Users className="w-6 h-6 mx-auto mb-2 text-green-500" />
                            <span className="text-sm font-medium">Users</span>
                        </Link>
                        <Link
                            to="/admin/results"
                            className="p-4 rounded-xl border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-center"
                        >
                            <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                            <span className="text-sm font-medium">Results</span>
                        </Link>
                    </div>
                </div>

                {/* Recent Events */}
                <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Recent Events</h3>
                        <Link
                            to="/admin/events"
                            className="text-sm text-purple-500 hover:underline"
                        >
                            View all
                        </Link>
                    </div>
                    {recentEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No events yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentEvents.map((event) => (
                                <Link
                                    key={event.id}
                                    to={`/admin/events/${event.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{event.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(event.startDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${event.status === "ONGOING"
                                        ? "bg-green-500/10 text-green-500"
                                        : event.status === "UPCOMING"
                                            ? "bg-blue-500/10 text-blue-500"
                                            : "bg-gray-500/10 text-gray-500"
                                        }`}>
                                        {event.status}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Debates */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Recent Debates</h3>
                    <Link
                        to="/admin/results"
                        className="text-sm text-purple-500 hover:underline"
                    >
                        View all results
                    </Link>
                </div>
                {recentDebates.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No debates recorded recently</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                                    <th className="pb-3 font-semibold">Debaters</th>
                                    <th className="pb-3 font-semibold">Round</th>
                                    <th className="pb-3 font-semibold">Status</th>
                                    <th className="pb-3 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentDebates.slice(0, 5).map((debate) => (
                                    <tr key={debate.id} className="group">
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex -space-x-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-blue-500">
                                                        {debate.debater1.firstName?.[0] || "U"}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-purple-500">
                                                        {debate.debater2.firstName?.[0] || "U"}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-medium">
                                                    {debate.debater1.firstName} vs {debate.debater2.firstName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className="text-sm text-muted-foreground">
                                                Round {debate.round.roundNumber}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${debate.status === 'COMPLETED'
                                                ? 'bg-green-500/10 text-green-500'
                                                : debate.status === 'ONGOING'
                                                    ? 'bg-amber-500/10 text-amber-500'
                                                    : 'bg-blue-500/10 text-blue-500'
                                                }`}>
                                                {debate.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <Link
                                                to={`/admin/results/${debate.id}`}
                                                className="text-xs font-semibold text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Manage
                                            </Link>

                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
