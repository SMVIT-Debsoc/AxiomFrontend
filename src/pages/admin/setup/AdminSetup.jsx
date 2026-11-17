import { lazy, Suspense, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DoorOpen, Flag, ListOrdered } from "lucide-react";
import { useAdminEvent } from "../../../contexts/adminEvent";
import { AreaHeader, AreaTabs } from "../../../components/ops/AreaHeader";
import { useAreaTab } from "../../../components/ops/useAreaTab";
import SetupSummary from "./SetupSummary";

const AdminEvents = lazy(() => import("../AdminEvents"));
const AdminEventDetails = lazy(() => import("../AdminEventDetails"));
const AdminRooms = lazy(() => import("../AdminRooms"));

const TABS = [
  { key: "events", label: "Events", icon: Flag },
  { key: "rounds", label: "Rounds", icon: ListOrdered },
  { key: "rooms", label: "Rooms", icon: DoorOpen },
];

function PanelFallback() {
  return <div role="status" aria-label="Loading" className="ax-card h-48 animate-pulse bg-muted/50" />;
}

/**
 * Setup: Events · Rounds · Rooms in one place (replaces /admin/events,
 * /admin/events/:id, /admin/rounds, /admin/rooms and /admin/overview).
 * /admin/setup/:id opens the Rounds tab for that event and makes it current.
 */
export default function AdminSetup() {
  const { id: routeEventId } = useParams();
  const { event, eventId, setEventId } = useAdminEvent();
  const [tab, setTab] = useAreaTab(TABS);
  const active = routeEventId && tab === "events" ? "rounds" : tab;

  const navigate = useNavigate();
  // /admin/setup/:id makes that event current once; after that the event
  // switcher wins, and switching away leaves the deep link.
  const adopted = useRef(null);
  useEffect(() => {
    if (!routeEventId) return;
    if (adopted.current !== routeEventId) {
      adopted.current = routeEventId;
      if (routeEventId !== eventId) setEventId(routeEventId);
      return;
    }
    if (eventId && eventId !== routeEventId) {
      navigate({ pathname: "/admin/setup", search: `?tab=rounds&event=${encodeURIComponent(eventId)}` }, { replace: true });
    }
  }, [routeEventId, eventId, setEventId, navigate]);

  const roundsEventId = eventId || routeEventId;

  return (
    <div className="mx-auto max-w-[1180px] font-sans">
      <AreaHeader eyebrow={event?.name || "No event selected"} title="Setup" description="Events, round settings and rooms. Running a round happens in Live." />
      <SetupSummary />
      <AreaTabs tabs={TABS} active={active} onChange={setTab} label="Setup sections" />
      <div role="tabpanel" aria-labelledby={`area-tab-${active}`}>
        <Suspense fallback={<PanelFallback />}>
          {active === "events" && <AdminEvents />}
          {active === "rounds" && <AdminEventDetails eventId={roundsEventId} />}
          {active === "rooms" && <AdminRooms embedded />}
        </Suspense>
      </div>
    </div>
  );
}
