import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  MoreVertical,
  Mail,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "@clerk/clerk-react";
import { UserApi } from "../../services/api";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useSocket, SocketEvents } from "../../hooks/useSocket";

export default function AdminParticipants() {
  const { getToken } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchParticipants = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const response = await UserApi.list(token);
      if (response.success) {
        setParticipants(response.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch participants", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error) {
      alert("Error deleting participant");
    }
  };

  if (loading && participants.length === 0) {
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
        <div className="flex gap-3">
             <button
                onClick={() => fetchParticipants()}
                disabled={loading}
                className="p-2.5 rounded-xl border border-border bg-card/50 hover:bg-muted text-muted-foreground transition-all"
                title="Refresh Data"
            >
                <RotateCcw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, college or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
        />
      </div>

      {filteredParticipants.length === 0 && !loading ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-xl font-bold mb-2">No Participants Found</h3>
          <p className="text-muted-foreground">
            Try a different search query or wait for users to register.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4 hidden md:table-cell">Contact</th>
                  <th className="px-6 py-4 hidden md:table-cell">College</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Joined At</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredParticipants.map((p, index) => {
                  const isUnenrolled = !p.participatingEvents || !p.participatingEvents.some(e => e.status !== 'COMPLETED');
                  
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.03, 1) }}
                      className={cn(
                        "hover:bg-muted/20 transition-colors group",
                        isUnenrolled && "bg-red-500/[0.02] border-l-2 border-l-red-500/30"
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={p} size="md" />
                          <div>
                            <p className="font-semibold text-sm">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              ID: {p.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" />
                            {p.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-sm text-muted-foreground">
                        {p.college || "Not provided"}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-xs text-muted-foreground font-medium">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }) : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={cn(
                              "text-[10px] uppercase font-bold px-2.5 py-1 rounded-full w-fit",
                              p.isProfileComplete 
                                ? "bg-green-500/10 text-green-500" 
                                : "bg-amber-500/10 text-amber-500"
                            )}
                          >
                            {p.isProfileComplete ? "Complete" : "Incomplete"}
                          </span>
                          {isUnenrolled && (
                            <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 w-fit">
                              Unenrolled
                            </span>
                          )}
                        </div>
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
                            className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
