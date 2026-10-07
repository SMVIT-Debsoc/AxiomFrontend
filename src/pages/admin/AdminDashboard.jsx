import { useState, useEffect, useCallback, useRef } from "react";
import { motion as Motion } from "framer-motion";
import {
  Calendar,
  Users,
  Trophy,
  Activity,
  Plus,
  ArrowUpRight,
  Shield,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { AdminApi } from "../../services/api";
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import Sculpture from "../../components/brand/Sculpture";

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentDebates, setRecentDebates] = useState([]);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = await getTokenRef.current();

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
  }, []); // stable - getToken is accessed via ref

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time updates
  const { subscribe } = useSocket();
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
      accentColor: "text-blue-500",
      accentBg: "bg-blue-500/10",
      change: `${stats?.activeEvents || 0} active currently`,
    },
    {
      label: "Active Participants",
      value: stats?.totalUsers || 0,
      icon: Users,
      accentColor: "text-emerald-500",
      accentBg: "bg-emerald-500/10",
      change: "Across all tournaments",
    },
    {
      label: "Debates Completed",
      value: stats?.completedDebates || 0,
      icon: Trophy,
      accentColor: "text-amber-500",
      accentBg: "bg-amber-500/10",
      change: `${stats?.completionRate || 0}% completion rate`,
    },
    {
      label: "Configured Rooms",
      value: stats?.totalRooms || 0,
      icon: Activity,
      accentColor: "text-primary",
      accentBg: "bg-primary/10",
      change: "Setup for competition",
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Editorial Overview Banner with Quiet Sculpture Accent */}
      <div className="axiom-page-header relative rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-6 md:p-8 overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
              AXIOM 4.0
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Admin Command
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">
            Tournament Dashboard
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1.5 font-sans leading-relaxed">
            Live overview of ongoing debate competitions, room allocations, participant registers, and automated pairing cycles.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/admin/events"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-sans font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Event</span>
            </Link>
            <Link
              to="/admin/rounds"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border/70 bg-background/50 hover:bg-muted text-foreground font-sans font-medium transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Manage Rounds</span>
            </Link>
          </div>
        </div>

        {/* Quiet editorial sculpture overview accent */}
        <div className="absolute right-0 top-0 bottom-0 w-36 md:w-56 opacity-15 pointer-events-none overflow-hidden select-none">
          <Sculpture
            variant="portrait"
            className="w-full h-full object-cover object-top grayscale contrast-125"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card/70 border border-border/70 rounded-xl p-5 backdrop-blur-sm flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-lg ${stat.accentBg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${stat.accentColor}`} aria-hidden="true" />
                </div>
                <span className="text-[11px] font-sans text-muted-foreground text-right">
                  {stat.change}
                </span>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-0.5">
                  {stat.value}
                </div>
                <div className="text-xs font-sans text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            </Motion.div>
          );
        })}
      </div>

      {/* Quick Actions & Recent Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="min-w-0 bg-card/70 border border-border/70 rounded-xl p-5 md:p-6 lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-heading font-bold text-foreground">
              Quick Operations
            </h3>
            <span className="text-xs font-sans text-muted-foreground">Admin routes</span>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <Link
              to="/admin/events"
              className="p-4 rounded-lg border border-border/70 bg-background/40 hover:bg-muted/70 hover:border-border transition-all text-center flex flex-col items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Calendar className="w-5 h-5 mb-2 text-primary group-hover:scale-105 transition-transform" aria-hidden="true" />
              <span className="text-xs font-sans font-medium text-foreground">Events</span>
            </Link>
            <Link
              to="/admin/rounds"
              className="p-4 rounded-lg border border-border/70 bg-background/40 hover:bg-muted/70 hover:border-border transition-all text-center flex flex-col items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Activity className="w-5 h-5 mb-2 text-emerald-500 group-hover:scale-105 transition-transform" aria-hidden="true" />
              <span className="text-xs font-sans font-medium text-foreground">Rounds</span>
            </Link>
            <Link
              to="/admin/participants"
              className="p-4 rounded-lg border border-border/70 bg-background/40 hover:bg-muted/70 hover:border-border transition-all text-center flex flex-col items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Users className="w-5 h-5 mb-2 text-blue-500 group-hover:scale-105 transition-transform" aria-hidden="true" />
              <span className="text-xs font-sans font-medium text-foreground">Debaters</span>
            </Link>
            <Link
              to="/admin/results"
              className="p-4 rounded-lg border border-border/70 bg-background/40 hover:bg-muted/70 hover:border-border transition-all text-center flex flex-col items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trophy className="w-5 h-5 mb-2 text-amber-500 group-hover:scale-105 transition-transform" aria-hidden="true" />
              <span className="text-xs font-sans font-medium text-foreground">Results</span>
            </Link>
          </div>
        </div>

        {/* Recent Events */}
        <div className="min-w-0 bg-card/70 border border-border/70 rounded-xl p-5 md:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-foreground">
                Recent Tournaments
              </h3>
              <p className="text-xs text-muted-foreground font-sans">Active and scheduled events</p>
            </div>
            <Link
              to="/admin/events"
              className="text-xs font-sans font-medium text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-sans">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
              <p className="text-xs">No tournaments recorded yet</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left" aria-label="Recent tournaments">
                  <thead>
                    <tr className="text-xs text-muted-foreground font-sans uppercase tracking-wider border-b border-border/70">
                      <th scope="col" className="px-3 pb-2.5 font-semibold">Tournament</th>
                      <th scope="col" className="px-3 pb-2.5 font-semibold text-right whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="group hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-3 py-3">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                          >
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-heading font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                                {event.name}
                              </p>
                              <p className="text-xs text-muted-foreground font-sans">
                                {new Date(event.startDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            <span
                              className={`text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                event.status === "ONGOING"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : event.status === "UPCOMING"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : "bg-muted text-muted-foreground border-border"
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
              <div className="md:hidden space-y-2.5">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/admin/events/${event.id}`}
                    className="block p-3 rounded-lg bg-background/50 border border-border/70 hover:bg-muted/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        </div>
                        <span className="font-heading font-semibold text-sm truncate text-foreground">
                          {event.name}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                          event.status === "ONGOING"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : event.status === "UPCOMING"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-sans pl-9">
                      {new Date(event.startDate).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Debates */}
      <div className="bg-card/70 border border-border/70 rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-heading font-bold text-foreground">
              Recent Debate Pairings
            </h3>
            <p className="text-xs text-muted-foreground font-sans">Latest matchups across rounds</p>
          </div>
          <Link
            to="/admin/results"
            className="text-xs font-sans font-medium text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span>All results</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        {recentDebates.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground font-sans">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
            <p className="text-xs">No debates recorded recently</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left" aria-label="Recent debates">
                <thead>
                  <tr className="text-xs text-muted-foreground font-sans uppercase tracking-wider border-b border-border/70">
                    <th scope="col" className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Debaters
                    </th>
                    <th scope="col" className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Round
                    </th>
                    <th scope="col" className="px-4 pb-3 font-semibold whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="px-4 pb-3 font-semibold text-right whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentDebates.slice(0, 5).map((debate) => (
                    <tr
                      key={debate.id}
                      className="group hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {debate.debater1.imageUrl ? (
                              <img
                                src={debate.debater1.imageUrl}
                                alt=""
                                className="w-7 h-7 rounded-full border-2 border-card object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-blue-500">
                                {debate.debater1.firstName?.[0] || "U"}
                              </div>
                            )}
                            {debate.debater2.imageUrl ? (
                              <img
                                src={debate.debater2.imageUrl}
                                alt=""
                                className="w-7 h-7 rounded-full border-2 border-card object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-emerald-500">
                                {debate.debater2.firstName?.[0] || "U"}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-sans font-medium text-foreground">
                            {debate.debater1.firstName} vs {debate.debater2.firstName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-sans text-muted-foreground">
                          Round {debate.round.roundNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            debate.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : debate.status === "ONGOING"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          }`}
                        >
                          {debate.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/results/${debate.id}`}
                          className="text-xs font-sans font-semibold text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5"
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
            <div className="md:hidden space-y-3">
              {recentDebates.slice(0, 5).map((debate) => (
                <div
                  key={debate.id}
                  className="p-3.5 rounded-lg bg-background/50 border border-border/70 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                          debate.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : debate.status === "ONGOING"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {debate.status}
                      </span>
                      <span className="text-xs font-sans text-muted-foreground">
                        Round {debate.round.roundNumber}
                      </span>
                    </div>
                    <Link
                      to={`/admin/results/${debate.id}`}
                      className="text-xs font-sans font-semibold text-primary hover:underline"
                    >
                      Manage
                    </Link>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-1.5 shrink-0">
                      {debate.debater1.imageUrl ? (
                        <img
                          src={debate.debater1.imageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full border-2 border-card object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-blue-500">
                          {debate.debater1.firstName?.[0] || "U"}
                        </div>
                      )}
                      {debate.debater2.imageUrl ? (
                        <img
                          src={debate.debater2.imageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full border-2 border-card object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-emerald-500">
                          {debate.debater2.firstName?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-sans font-medium text-xs truncate text-foreground">
                        {debate.debater1.firstName}{" "}
                        <span className="text-muted-foreground font-normal">vs</span>{" "}
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
