import {useState, useEffect, useCallback} from "react";
import {motion} from "framer-motion";
import {
  Calendar,
  Users,
  Trophy,
  TrendingUp,
  Activity,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {Link} from "react-router-dom";
import {AdminApi} from "../../services/api";
import {useSocket, SocketEvents} from "../../hooks/useSocket";

export default function AdminDashboard() {
  const {getToken} = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentDebates, setRecentDebates] = useState([]);

  const fetchDashboard = useCallback(async () => {
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
  }, [getToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time updates
  const {subscribe} = useSocket();
  useEffect(() => {
    const unsubs = [
      subscribe(SocketEvents.EVENT_CREATED, fetchDashboard),
      subscribe(SocketEvents.EVENT_UPDATED_GLOBAL, fetchDashboard),
      subscribe(SocketEvents.EVENT_DELETED_GLOBAL, fetchDashboard),
      subscribe(SocketEvents.USER_UPDATED, fetchDashboard),
      subscribe(SocketEvents.USER_DELETED, fetchDashboard),
      subscribe(SocketEvents.DEBATE_RESULT, fetchDashboard),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe, fetchDashboard]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your debate platform
          </p>
        </div>
        <Link
          to="/admin/events"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors w-full md:w-auto"
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
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: index * 0.1}}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl ${stat.color}/10 flex items-center justify-center`}
                >
                  <Icon
                    className={`w-6 h-6 ${stat.color.replace("bg-", "text-")}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {stat.change}
                </span>
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
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
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="px-4 pb-3 font-semibold">Event</th>
                      <th className="px-4 pb-3 font-semibold text-right whitespace-nowrap">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="group hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-5 h-5 text-purple-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {event.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(event.startDate).toLocaleDateString()}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link to={`/admin/events/${event.id}`}>
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded ${
                                event.status === "ONGOING"
                                  ? "bg-green-500/10 text-green-500"
                                  : event.status === "UPCOMING"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-gray-500/10 text-gray-500"
                              }`}
                            >
                              {event.status}
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/admin/events/${event.id}`}
                    className="block p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-purple-500" />
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            event.status === "ONGOING"
                              ? "bg-green-500/10 text-green-500"
                              : event.status === "UPCOMING"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-gray-500/10 text-gray-500"
                          }`}
                        >
                          {event.status}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate">
                        {event.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
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
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Debaters
                    </th>
                    <th className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Round
                    </th>
                    <th className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 pb-3 font-semibold text-right whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentDebates.slice(0, 5).map((debate) => (
                    <tr
                      key={debate.id}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {debate.debater1.imageUrl ? (
                              <img
                                src={debate.debater1.imageUrl}
                                alt={debate.debater1.firstName}
                                className="w-8 h-8 rounded-full border-2 border-card object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-blue-500">
                                {debate.debater1.firstName?.[0] || "U"}
                              </div>
                            )}
                            {debate.debater2.imageUrl ? (
                              <img
                                src={debate.debater2.imageUrl}
                                alt={debate.debater2.firstName}
                                className="w-8 h-8 rounded-full border-2 border-card object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-purple-500">
                                {debate.debater2.firstName?.[0] || "U"}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {debate.debater1.firstName} vs{" "}
                            {debate.debater2.firstName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          Round {debate.round.roundNumber}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            debate.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-500"
                              : debate.status === "ONGOING"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {debate.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/results/${debate.id}`}
                          className="text-xs font-semibold text-purple-500 hover:text-purple-600 transition-colors"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {recentDebates.slice(0, 5).map((debate) => (
                <div
                  key={debate.id}
                  className="p-4 rounded-xl bg-muted/30 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          debate.status === "COMPLETED"
                            ? "bg-green-500/10 text-green-500"
                            : debate.status === "ONGOING"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {debate.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Round {debate.round.roundNumber}
                      </span>
                    </div>
                    <Link
                      to={`/admin/results/${debate.id}`}
                      className="text-xs font-bold text-purple-500"
                    >
                      Manage
                    </Link>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2 flex-shrink-0">
                      {debate.debater1.imageUrl ? (
                        <img
                          src={debate.debater1.imageUrl}
                          alt={debate.debater1.firstName}
                          className="w-10 h-10 rounded-full border-2 border-card object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center text-xs font-bold text-blue-500">
                          {debate.debater1.firstName?.[0] || "U"}
                        </div>
                      )}
                      {debate.debater2.imageUrl ? (
                        <img
                          src={debate.debater2.imageUrl}
                          alt={debate.debater2.firstName}
                          className="w-10 h-10 rounded-full border-2 border-card object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 border-2 border-card flex items-center justify-center text-xs font-bold text-purple-500">
                          {debate.debater2.firstName?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {debate.debater1.firstName}{" "}
                        <span className="text-muted-foreground font-normal text-xs">
                          vs
                        </span>{" "}
                        {debate.debater2.firstName}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
