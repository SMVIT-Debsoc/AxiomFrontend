import ModalSurface from "../../components/ui/ModalSurface";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion as Motion } from "framer-motion";
import {
  Calendar,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MessageCircle,
  RotateCcw,
  X,
} from "lucide-react";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import { cn } from "../../lib/utils";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { AdminApi, EventApi } from "../../services/api";
import {useToast} from "../../hooks/useToast"
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import {serializeEventDates, toLocalDateTime} from "../../lib/datetime";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminEvents() {
  const { getToken } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const response = await EventApi.list(token);
      setEvents(response.events || response.data || []);
    } catch (err) {
      console.error("Failed to fetch events", err);
      toast.error("Error", "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Real-time updates
  const { subscribe } = useSocket();
  useEffect(() => {
    const unsubs = [
      subscribe(SocketEvents.EVENT_CREATED, (data) => {
        fetchEvents();
        toast.success(
          "New Event",
          `Event "${data.event?.name || "Tournament"}" has been created.`
        );
      }),
      subscribe(SocketEvents.EVENT_UPDATED_GLOBAL, () => {
        fetchEvents();
      }),
      subscribe(SocketEvents.EVENT_DELETED_GLOBAL, () => {
        fetchEvents();
        toast.info("Event Deleted", "An event has been deleted.");
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe, toast, fetchEvents]);

  const filteredEvents = events.filter((event) =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteEvent = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this event? All associated rounds and debates will be lost."
      )
    )
      return;
    try {
      const token = await getToken();
      const response = await AdminApi.deleteEvent(id, token);
      if (response.success) {
        setEvents(events.filter((e) => e.id !== id));
        toast.success("Deleted", "Event deleted successfully");
      } else {
        alert(response.error || "Failed to delete event");
      }
    } catch {
      alert("Error deleting event");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingIndicator label="Loading tournament events" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="axiom-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="max-w-full">
          <div className="flex items-center gap-2 mb-1">
            <span className="axiom-eyebrow text-xs uppercase font-heading font-semibold tracking-widest text-emerald-500">
              AXIOM 4.0
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Tournaments
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground break-words">
            Events Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5 max-w-xl font-sans">
            Oversee parliamentary tournaments, round sequencing, and participant enrollment
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Refresh Data"
            aria-label="Refresh events list"
          >
            <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setEditingEvent(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-sans font-medium text-sm hover:bg-primary/90 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search tournaments by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search tournaments"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/70 border border-border/70 text-sm font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          title={searchQuery ? "Nothing matched" : "No tournaments yet"}
          description={searchQuery ? "No events matched your search query." : "Create your first tournament to get started."}
          action={
            <button onClick={() => setShowCreateModal(true)} className="axiom-button axiom-button--green axiom-press axiom-sheen">
              <Plus size={16} aria-hidden="true" />
              <span>Create event</span>
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-card/70 border border-border/70 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left" aria-label="Tournament events">
                <thead className="bg-muted/40 text-xs font-heading font-semibold uppercase text-muted-foreground border-b border-border/70">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Tournament</th>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Date</th>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Rounds</th>
                    <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEvents.map((event, index) => (
                    <Motion.tr
                      key={event.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/admin/events/${event.id}`}
                              className="font-heading font-semibold text-sm truncate text-foreground hover:text-primary transition-colors block"
                            >
                              {event.name}
                            </Link>
                            <p className="text-xs text-muted-foreground font-sans line-clamp-1">
                              {event.description || "No description provided"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-sans text-muted-foreground whitespace-nowrap">
                        {new Date(event.startDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 text-xs font-sans text-muted-foreground whitespace-nowrap">
                        <span className="font-medium text-foreground">{event.rounds?.length || 0}</span> rounds
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
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
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="View Tournament"
                            aria-label={`View tournament ${event.name}`}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Link>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Edit Tournament"
                            aria-label={`Edit tournament ${event.name}`}
                            onClick={() => setEditingEvent(event)}
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Delete Tournament"
                            aria-label={`Delete tournament ${event.name}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </Motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredEvents.map((event, index) => (
              <Motion.div
                key={event.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-card/70 border border-border/70 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-sm truncate text-foreground">
                        {event.name}
                      </h3>
                      <p className="text-xs text-muted-foreground font-sans">
                        {new Date(event.startDate).toLocaleDateString()}
                      </p>
                    </div>
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

                {event.description && (
                  <p className="text-xs text-muted-foreground font-sans line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-auto text-xs">
                  <span className="text-muted-foreground font-sans">
                    <span className="font-semibold text-foreground">{event.rounds?.length || 0}</span> rounds
                  </span>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/events/${event.id}`}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View tournament details"
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <button
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setEditingEvent(event)}
                      aria-label="Edit tournament"
                    >
                      <Edit className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete tournament"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </Motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchEvents();
          }}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdated={() => {
            setEditingEvent(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}

function CreateEventModal({ onClose, onCreated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    whatsappLink: "",
  });


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getToken();
      const response = await AdminApi.createEvent(serializeEventDates(formData), token);

      if (response.success) {
        onCreated();
      } else {
        alert(response.error || "Failed to create event");
      }
    } catch {
      alert("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSurface onDismiss={onClose} aria-label="Create New Event"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-md shadow-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Create New Tournament</h2>
          <p className="text-xs text-muted-foreground font-sans">Set up basic schedule and details</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Tournament Name</span><input type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
        placeholder="Axiom 4.0 Parliamentary" /></label>
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">
          Description
        </span><textarea value={formData.description}
        onChange={(e) =>
          setFormData({
            ...formData,
            description: e.target.value,
          })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
        rows={3}
        placeholder="Annual national debate tournament format..." /></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">
            Start Date (local time)
          </span><input type="datetime-local"
          required
          value={formData.startDate}
          onChange={(e) =>
            setFormData({
              ...formData,
              startDate: e.target.value,
            })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">End Date (local time)</span><input type="datetime-local"
          value={formData.endDate}
          onChange={(e) =>
            setFormData({
              ...formData,
              endDate: e.target.value,
            })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>
        <label ><span className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
        WhatsApp Group Link
        <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span></span><input type="url"
        value={formData.whatsappLink}
        onChange={(e) =>
          setFormData({
            ...formData,
            whatsappLink: e.target.value,
          })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
        placeholder="https://chat.whatsapp.com/..." /></label>
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
            {loading ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}

function EditEventModal({ event, onClose, onUpdated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: event.name || "",
    description: event.description || "",
    startDate: event.startDate
      ? toLocalDateTime(event.startDate)
      : "",
    endDate: event.endDate
      ? toLocalDateTime(event.endDate)
      : "",
    status: event.status || "UPCOMING",
    whatsappLink: event.whatsappLink || "",
  });


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const response = await AdminApi.updateEvent(event.id, serializeEventDates(formData, event), token);
      if (response.success) {
        onUpdated();
      } else {
        alert(response.error || "Failed to update event");
      }
    } catch {
      alert("Error updating event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSurface onDismiss={onClose} aria-label="Edit Event"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Edit Tournament</h2>
          <p className="text-xs text-muted-foreground font-sans">Modify parameters and status</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Tournament Name</span><input type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">
          Description
        </span><textarea value={formData.description}
        onChange={(e) =>
          setFormData({ ...formData, description: e.target.value })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
        rows={3} /></label>
    
        <div className="grid md:grid-cols-2 gap-3">
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">
            Start Date (local time)
          </span><input type="datetime-local"
          required
          value={formData.startDate}
          onChange={(e) =>
            setFormData({ ...formData, startDate: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">End Date (local time)</span><input type="datetime-local"
          required
          value={formData.endDate}
          onChange={(e) =>
            setFormData({ ...formData, endDate: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Status</span><select value={formData.status}
        onChange={(e) =>
          setFormData({ ...formData, status: e.target.value })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"><option value="UPCOMING">Upcoming</option>
        <option value="ONGOING">Ongoing</option>
        <option value="COMPLETED">Completed</option></select></label>
    
        <label ><span className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
        WhatsApp Group Link
        <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span></span><input type="url"
        value={formData.whatsappLink}
        onChange={(e) =>
          setFormData({
            ...formData,
            whatsappLink: e.target.value,
          })
        }
        className="w-full px-3 py-2 rounded-lg bg-background border border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
        placeholder="https://chat.whatsapp.com/..." /></label>
    
        <div className="flex gap-2.5 pt-4 border-t border-border/60 mt-5">
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
    </Motion.div></ModalSurface>
  );
}
