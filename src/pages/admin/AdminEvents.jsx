import {useState, useEffect} from "react";
import {motion} from "framer-motion";
import {
  Calendar,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {useNavigate, Link} from "react-router-dom";
import {AdminApi, EventApi} from "../../services/api";
import {useToast} from "../../components/ui/Toast";
import {EventCardSkeleton} from "../../components/ui/Skeleton";
import {useSocket, SocketEvents} from "../../hooks/useSocket";

export default function AdminEvents() {
  const {getToken} = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await EventApi.list(token);
      setEvents(response.events || response.data || []);
    } catch (err) {
      console.error("Failed to fetch events", err);
      toast.error("Error", "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [getToken, toast]);

  // Real-time updates
  const {subscribe} = useSocket();
  useEffect(() => {
    const unsubs = [
      subscribe(SocketEvents.EVENT_CREATED, (data) => {
        fetchEvents();
        toast.success(
          "New Event",
          `Event "${data.event.name}" has been created.`
        );
      }),
      subscribe(SocketEvents.EVENT_UPDATED_GLOBAL, (data) => {
        fetchEvents();
        // Optional: toast.info("Event Updated", `Event "${data.event.name}" updated.`);
      }),
      subscribe(SocketEvents.EVENT_DELETED_GLOBAL, (data) => {
        fetchEvents();
        toast.info("Event Deleted", "An event has been deleted.");
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [subscribe]);

  const handleCreateEvent = () => {
    navigate("/admin/events/create");
  };

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
      } else {
        alert(response.error || "Failed to delete event");
      }
    } catch (error) {
      alert("Error deleting event");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage your debate tournaments
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:border-purple-500 outline-none transition-colors"
        />
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">No Events Found</h3>
          <p className="text-muted-foreground mb-6">
            Create your first event to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full">
                <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-4 text-left">Event</th>
                    <th className="px-4 py-4 text-left whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 py-4 text-left whitespace-nowrap">
                      Rounds
                    </th>
                    <th className="px-4 py-4 text-left whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-4 text-right whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEvents.map((event, index) => (
                    <motion.tr
                      key={event.id}
                      initial={{opacity: 0}}
                      animate={{opacity: 1}}
                      transition={{delay: index * 0.05}}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-purple-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {event.name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {event.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(event.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                        {event.rounds?.length || 0} rounds
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Link>
                          <button
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Edit"
                            onClick={() => setEditingEvent(event)}
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-4">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: index * 0.05}}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate pr-2">
                        {event.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded flex-shrink-0 ${
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

                {event.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                  <span className="text-xs text-muted-foreground font-medium">
                    {event.rounds?.length || 0} rounds
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/events/${event.id}`}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </Link>
                    <button
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      onClick={() => setEditingEvent(event)}
                    >
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </motion.div>
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

function CreateEventModal({onClose, onCreated}) {
  const {getToken} = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getToken();
      const response = await AdminApi.createEvent(formData, token);

      if (response.success) {
        onCreated();
      } else {
        alert(response.error || "Failed to create event");
      }
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4"
      >
        <h2 className="text-xl font-bold mb-4">Create New Event</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Event Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
              placeholder="Axiom 2026"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none resize-none"
              rows={3}
              placeholder="Annual debate competition..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Start Date
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startDate: e.target.value,
                  })
                }
                style={{colorScheme: "dark"}}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endDate: e.target.value,
                  })
                }
                style={{colorScheme: "dark"}}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
              />
            </div>
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
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditEventModal({event, onClose, onUpdated}) {
  const {getToken} = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: event.name || "",
    description: event.description || "",
    startDate: event.startDate
      ? new Date(event.startDate).toISOString().slice(0, 16)
      : "",
    endDate: event.endDate
      ? new Date(event.endDate).toISOString().slice(0, 16)
      : "",
    status: event.status || "UPCOMING",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const response = await AdminApi.updateEvent(event.id, formData, token);
      if (response.success) {
        onUpdated();
      } else {
        alert(response.error || "Failed to update event");
      }
    } catch (error) {
      alert("Error updating event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{opacity: 0, scale: 0.95}}
        animate={{opacity: 1, scale: 1}}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Event</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5 text-muted-foreground rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Event Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({...formData, description: e.target.value})
              }
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none resize-none"
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Start Date
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({...formData, startDate: e.target.value})
                }
                style={{colorScheme: "dark"}}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <input
                type="datetime-local"
                required
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({...formData, endDate: e.target.value})
                }
                style={{colorScheme: "dark"}}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({...formData, status: e.target.value})
              }
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-purple-500 outline-none"
            >
              <option value="UPCOMING">Upcoming</option>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-2 px-8 py-2.5 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
