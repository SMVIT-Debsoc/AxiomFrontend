import ModalSurface from "../../components/ui/ModalSurface";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion as Motion } from "framer-motion";
import {Search, Mail, Trash2, RotateCcw, UserPlus, X} from "lucide-react";
import { cn } from "../../lib/utils";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import { useAuth } from "@clerk/clerk-react";
import { UserApi, EventApi } from "../../services/api";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminParticipants() {
  const { getToken } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [enrollingUser, setEnrollingUser] = useState(null);
  const [showEventSelect, setShowEventSelect] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchParticipants = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const response = await UserApi.list(token);
      if (response.success) {
        setParticipants(response.users || []);
      }

      const eventResponse = await EventApi.list(token);
      if (eventResponse.success) {
        setEvents(eventResponse.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // Real-time updates
  const { subscribe } = useSocket();
  useEffect(() => {
    const unsubs = [
      subscribe(SocketEvents.USER_UPDATED, () => {
        fetchParticipants();
      }),
      subscribe(SocketEvents.USER_DELETED, () => {
        fetchParticipants();
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe, fetchParticipants]);


  const filteredParticipants = participants.filter((p) => {
    const name = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
    const college = (p.college || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const email = (p.email || "").toLowerCase();
    return name.includes(query) || college.includes(query) || email.includes(query);
  });

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete participant: ${name}?`))
      return;
    try {
      const token = await getToken();
      const response = await UserApi.deleteParticipant(id, token);
      if (response.success) {
        setParticipants(participants.filter((p) => p.id !== id));
      } else {
        alert(response.error || "Failed to delete participant");
      }
    } catch {
      alert("Error deleting participant");
    }
  };

  const handleEnroll = async (eventId, userId) => {
    try {
      const token = await getToken();
      const response = await EventApi.enrollUserManual(eventId, userId, token);
      if (response.success) {
        alert("User enrolled successfully");
        setShowEventSelect(false);
        setEnrollingUser(null);
        fetchParticipants();
      } else {
        alert(response.error || "Failed to enroll user");
      }
    } catch {
      alert("Error during manual enrollment");
    }
  };

  if (loading && participants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingIndicator label="Loading debater roster" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
              AXIOM 4.0
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Registry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Participants Registry
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5 font-sans">
            Manage all debaters, institutional affiliations, and profile completion states
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => fetchParticipants()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Refresh Data"
            aria-label="Refresh participants list"
          >
            <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by debater name, institution, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search participants"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      {filteredParticipants.length === 0 && !loading ? (
        <EmptyState
          title={searchQuery ? "Nobody matched" : "No participants yet"}
          description={searchQuery ? "Try a different search query." : "Wait for debaters to register or add them manually."}
        />
      ) : (
        <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label="Participant list">
              <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Debater</th>
                  <th scope="col" className="px-5 py-3.5 hidden md:table-cell">Contact</th>
                  <th scope="col" className="px-5 py-3.5 hidden md:table-cell">Institution</th>
                  <th scope="col" className="px-5 py-3.5 hidden lg:table-cell">Registered</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredParticipants.map((p, index) => {
                  const isUnenrolled = !p.participatingEvents || !p.participatingEvents.some(e => e.status !== 'COMPLETED');

                  return (
                    <Motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.02, 0.5) }}
                      className={cn(
                        "hover:bg-muted/30 transition-colors group",
                        isUnenrolled && "bg-destructive/[0.015] border-l-2 border-l-destructive/30"
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={p} size="sm" />
                          <div>
                            <p className="font-heading font-semibold text-sm text-foreground">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              ID: {p.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{p.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-xs text-muted-foreground font-sans">
                        {p.college || "Not provided"}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground font-sans">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : "N/A"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              "text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded border w-fit",
                              p.isProfileComplete
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            {p.isProfileComplete ? "Complete" : "Incomplete"}
                          </span>
                          {isUnenrolled && (
                            <span className="text-[9px] font-sans uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border w-fit">
                              Unenrolled
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEnrollingUser(p);
                              setShowEventSelect(true);
                            }}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Enroll in Tournament"
                            aria-label={`Enroll ${p.firstName} ${p.lastName} in tournament`}
                          >
                            <UserPlus className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, `${p.firstName} ${p.lastName}`)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Delete Participant"
                            aria-label={`Delete participant ${p.firstName} ${p.lastName}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </Motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Enrollment Event Selector */}
      {showEventSelect && enrollingUser && (
        <ModalSurface onDismiss={() => { setShowEventSelect(false); setEnrollingUser(null); }}
          aria-label={`Enroll ${enrollingUser.firstName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground">
                  Enroll {enrollingUser.firstName} {enrollingUser.lastName}
                </h2>
                <p className="text-xs text-muted-foreground font-sans">
                  Select tournament to assign this participant
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEventSelect(false);
                  setEnrollingUser(null);
                }}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto mb-5 pr-1">
              {events.filter(e => e.status !== 'COMPLETED').map(event => (
                <button
                  key={event.id}
                  onClick={() => handleEnroll(event.id, enrollingUser.id)}
                  className="w-full text-left p-3.5 rounded-lg border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <h4 className="font-heading font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {event.name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-sans capitalize mt-0.5">
                      {event.status.toLowerCase()}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                </button>
              ))}
              {events.filter(e => e.status !== 'COMPLETED').length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground italic font-sans">
                  No active tournaments found.
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowEventSelect(false);
                setEnrollingUser(null);
              }}
              className="w-full py-2 rounded-lg border border-border/70 text-xs font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </Motion.div>
        </ModalSurface>
      )}
    </div>
  );
}
