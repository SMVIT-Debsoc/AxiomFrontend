import DashboardLink from "../../components/dashboard/DashboardLink";
import {useState} from "react";
import {useParams} from "react-router-dom";
import {
  Users,
  ArrowLeft,
} from "lucide-react";
import {usePageRequests} from "../../hooks/usePageRequests";
import {EventApi} from "../../services/api";
import {useEventSocket, useLiveRefresh} from "../../hooks/useSocket";
import {ParticipantsListSkeleton} from "../../components/ui/Skeleton";

const PARTICIPANT_FIELDS = ["event"];

export default function Participants() {
  const {eventId} = useParams();
  return <ParticipantsPage key={eventId} eventId={eventId} />;
}

function ParticipantsPage({eventId}) {
  const [event, setEvent] = useState(null);
  const [participantCount, setParticipantCount] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = usePageRequests(PARTICIPANT_FIELDS, async (_field, token, options, isCurrent) => {
    try {
      const response = await EventApi.getOverview(eventId, token, options);
      if (!isCurrent()) return;
      setEvent(response.event);
      setEventLoading(false);
      const count = response.event?._count?.participants;
      if (Number.isInteger(count)) {
        setParticipantCount(count);
      } else {
        const roster = await EventApi.getParticipants(eventId, token, options);
        if (isCurrent() && roster?.success) setParticipantCount(roster.total ?? roster.participants?.length ?? 0);
      }
      if (isCurrent()) setError(null);
    } catch (error) {
      if (isCurrent() && !options.skipCache) setError(error.message);
    } finally {
      if (isCurrent()) setEventLoading(false);
    }
  }, "event");

  useEventSocket(eventId, {
    onEventEnrollment: () => refresh("event"),
  });
  useLiveRefresh(() => refresh("event"), {eventId, jitterMs: 3000, invalidateCache: false});

  if (eventLoading) {
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
        <DashboardLink
          to={`/dashboard/events/${eventId}`}
          className="inline-flex items-center text-xs font-sans text-muted-foreground hover:text-primary mb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Back to Tournament
        </DashboardLink>

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
              {participantCount ?? "…"}
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
