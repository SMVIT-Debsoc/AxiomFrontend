import {useState, useEffect, useRef} from "react";
import {useParams, Link} from "react-router-dom";
import {motion as Motion} from "framer-motion";
import {
  Users,
  ArrowLeft,
  Search,
  School,
  CheckCircle,
} from "lucide-react";
import {useAuth} from "@clerk/clerk-react";
import {EventApi} from "../../services/api";
import {useEventSocket} from "../../hooks/useSocket";
import {UserAvatar} from "../../components/ui/UserAvatar";
import {ParticipantsListSkeleton} from "../../components/ui/Skeleton";

export default function Participants() {
  const {eventId} = useParams();
  const {getToken} = useAuth();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getTokenRef.current();

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
  }, [eventId]); // getToken via ref; eventId is the real trigger

  // Real-time updates
  useEventSocket(eventId, {
    onEventEnrollment: () => {
      const fetchPars = async () => {
        try {
          const token = await getToken();
          const participantsResponse = await EventApi.getParticipants(
            eventId,
            token
          );
          if (participantsResponse.success) {
            setParticipants(participantsResponse.participants || []);
          }
        } catch {
          // Socket refresh failed
        }
      };
      fetchPars();
    },
  });

  // Filter participants by search
  const filteredParticipants = participants.filter((p) => {
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
    const college = (p.college || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || college.includes(query);
  });

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="axiom-page-header">
          <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
            Registry
          </span>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
            Registered Debaters
          </h1>
          <p className="text-muted-foreground font-sans mt-0.5 text-sm">
            All registered participants for this tournament.
          </p>
        </div>
        <ParticipantsListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-xs font-sans text-muted-foreground hover:text-primary mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournament
        </Link>

        <div className="axiom-page-header">
          <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
            Registry
          </span>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
            Registered Debaters
          </h1>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            {event?.name || "Tournament"}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl font-sans">
          <p className="font-semibold text-sm">Failed to load participants</p>
          <p className="text-xs opacity-90 mt-0.5">{error}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search debaters by name or institution..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search debaters by name or institution"
          className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm font-sans focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        />
      </div>

      {/* Participants Count */}
      <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">
            {filteredParticipants.length}
          </span>{" "}
          registered debaters
        </p>
      </div>

      {/* Participants List */}
      <div className="space-y-2.5">
        {filteredParticipants.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" aria-hidden="true" />
            <p className="text-muted-foreground font-sans text-sm">
              {searchQuery
                ? "No debaters found matching your query."
                : "No debaters registered yet."}
            </p>
          </div>
        ) : (
          filteredParticipants.map((participant, index) => (
            <Motion.div
              key={participant.id}
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: index * 0.02}}
              className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                {/* Avatar */}
                <UserAvatar user={participant} size="md" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-semibold text-sm text-foreground truncate">
                      {participant.firstName} {participant.lastName}
                    </p>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans mt-0.5">
                    <School className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="truncate">
                      {participant.college || "No institution specified"}
                    </span>
                  </div>
                </div>
              </div>
            </Motion.div>
          ))
        )}
      </div>
    </div>
  );
}
