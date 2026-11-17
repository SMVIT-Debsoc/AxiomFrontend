import {useState} from "react";
import {useParams, Link} from "react-router-dom";
import {
  Users,
  ArrowLeft,
} from "lucide-react";
import {usePageRequests} from "../../hooks/usePageRequests";
import {EventApi} from "../../services/api";
import {useEventSocket} from "../../hooks/useSocket";
import {ParticipantsListSkeleton} from "../../components/ui/Skeleton";

const PARTICIPANT_FIELDS = ["event", "roster"];

export default function Participants() {
  const {eventId} = useParams();
  return <ParticipantsPage key={eventId} eventId={eventId} />;
}

function ParticipantsPage({eventId}) {
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = usePageRequests(PARTICIPANT_FIELDS, async (field, token, options, isCurrent) => {
    try {
      if (field === "event") {
        const response = await EventApi.getOverview(eventId, token, options);
        if (isCurrent() && response?.event) setEvent(response.event);
      } else {
        const response = await EventApi.getParticipants(eventId, token, options);
        if (isCurrent() && response?.success) {
          setParticipants(response.participants || []);
        }
      }
    } catch (error) {
      if (isCurrent() && !options.skipCache) setError(error.message);
    } finally {
      if (isCurrent()) {
        if (field === "event") setEventLoading(false);
        else setRosterLoading(false);
      }
    }
  });

  useEventSocket(eventId, {
    onEventEnrollment: () => refresh("roster"),
  });

  if (eventLoading || rosterLoading) {
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

      {/* Registered Count Summary */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground">
              Total Registered Debaters
            </p>
            <p className="text-2xl font-heading font-bold text-foreground tabular-nums">
              {participants.length}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-sans leading-relaxed">
          Individual participant rosters are hidden during the competition. Your opponent and room assignment will appear in your round draw once published.
        </p>
      </div>
    </div>
  );
}
