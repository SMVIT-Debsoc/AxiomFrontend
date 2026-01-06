import {useState, useEffect} from "react";
import {useParams, Link, useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import {
    Users,
    ArrowLeft,
    Loader2,
    Search,
    School,
    User,
    CheckCircle,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {EventApi} from "../../services/api";
import {cn} from "../../lib/utils";

export default function Participants() {
    const {eventId} = useParams();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const token = await getToken();

                // Fetch event details
                const eventResponse = await EventApi.get(eventId, token);
                if (eventResponse.success && eventResponse.event) {
                    setEvent(eventResponse.event);
                }

                // Fetch event participants (users who have checked in)
                const participantsResponse = await EventApi.getParticipants(
                    eventId,
                    token
                );
                if (participantsResponse.success) {
                    setParticipants(participantsResponse.participants || []);
                }
            } catch (err) {
                console.error("Failed to fetch participants", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [eventId, getToken]);

    // Filter participants by search
    const filteredParticipants = participants.filter((p) => {
        const fullName = `${p.firstName || ""} ${
            p.lastName || ""
        }`.toLowerCase();
        const college = (p.college || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || college.includes(query);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-4">
            {/* Header */}
            <div>
                <Link
                    to={`/dashboard/events/${eventId}`}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Event
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Participants</h1>
                        <p className="text-sm text-muted-foreground">
                            {event?.name || "Event"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by name or college..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
            </div>

            {/* Participants Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                        {filteredParticipants.length}
                    </span>{" "}
                    registered debaters
                </p>
            </div>

            {/* Participants List */}
            <div className="space-y-3">
                {filteredParticipants.length === 0 ? (
                    <div className="text-center py-12 bg-card border border-border rounded-xl">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                            {searchQuery
                                ? "No participants found matching your search."
                                : "No participants registered yet."}
                        </p>
                    </div>
                ) : (
                    filteredParticipants.map((participant, index) => (
                        <motion.div
                            key={participant.id}
                            initial={{opacity: 0, y: 10}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: index * 0.03}}
                            className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {(participant.firstName?.[0] || "") +
                                        (participant.lastName?.[0] || "")}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold truncate">
                                            {participant.firstName}{" "}
                                            {participant.lastName}
                                        </p>
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <School className="w-4 h-4" />
                                        <span className="truncate">
                                            {participant.college ||
                                                "No college"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
