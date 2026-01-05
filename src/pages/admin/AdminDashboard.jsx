import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Trophy, TrendingUp, Activity, Plus } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { AdminApi, EventApi } from '../../services/api';

export default function AdminDashboard() {
    const { getToken } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentEvents, setRecentEvents] = useState([]);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = await getToken();
                
                // Fetch admin dashboard stats
                const dashboardResponse = await AdminApi.getDashboard(token);
                if (dashboardResponse.success) {
                    setStats(dashboardResponse.stats);
                }

                // Fetch recent events
                const eventsResponse = await EventApi.list(token);
                if (eventsResponse.success) {
                    setRecentEvents(eventsResponse.events?.slice(0, 5) || []);
                }
            } catch (error) {
                console.error('Failed to fetch admin dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [getToken]);

    const statCards = [
        { 
            label: 'Total Events', 
            value: stats?.totalEvents || 0, 
            icon: Calendar, 
            color: 'bg-blue-500',
            change: '+2 this month'
        },
        { 
            label: 'Active Participants', 
            value: stats?.totalUsers || 0, 
            icon: Users, 
            color: 'bg-green-500',
            change: '+15 this week'
        },
        { 
            label: 'Debates Completed', 
            value: stats?.completedDebates || 0, 
            icon: Trophy, 
            color: 'bg-amber-500',
            change: '85% completion rate'
        },
        { 
            label: 'Ongoing Rounds', 
            value: stats?.ongoingRounds || 0, 
            icon: Activity, 
            color: 'bg-purple-500',
            change: 'Live now'
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Manage your debate platform</p>
                </div>
                <Link
                    to="/admin/events/new"
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
                                <div className={`w-12 h-12 rounded-xl ${stat.color}/10 flex items-center justify-center`}>
                                    <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                                </div>
                                <span className="text-xs text-muted-foreground">{stat.change}</span>
                            </div>
                            <div className="text-3xl font-bold mb-1">{stat.value}</div>
                            <div className="text-sm text-muted-foreground">{stat.label}</div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Quick Actions & Recent Events */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            to="/admin/events/new"
                            className="p-4 rounded-xl border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-center"
                        >
                            <Calendar className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                            <span className="text-sm font-medium">New Event</span>
                        </Link>
                        <Link
                            to="/admin/rounds"
                            className="p-4 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-center"
                        >
                            <Activity className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                            <span className="text-sm font-medium">Manage Rounds</span>
                        </Link>
                        <Link
                            to="/admin/participants"
                            className="p-4 rounded-xl border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all text-center"
                        >
                            <Users className="w-6 h-6 mx-auto mb-2 text-green-500" />
                            <span className="text-sm font-medium">Participants</span>
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
                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Recent Events</h3>
                        <Link to="/admin/events" className="text-sm text-purple-500 hover:underline">
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
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                        event.status === 'ONGOING' ? 'bg-green-500/10 text-green-500' :
                                        event.status === 'UPCOMING' ? 'bg-blue-500/10 text-blue-500' :
                                        'bg-gray-500/10 text-gray-500'
                                    }`}>
                                        {event.status}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
