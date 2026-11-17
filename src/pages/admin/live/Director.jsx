import {lazy, Suspense, useDeferredValue, useEffect, useMemo, useState} from "react";
import {Search, X} from "lucide-react";
import ActivityFeed from "../../../components/ops/ActivityFeed";
import {cn} from "../../../lib/utils";
import {debateMatches, judgeOf, pipelineStep, roundCounters, sortDebates} from "../../../lib/liveStations";
import CheckInWindowStrip from "./CheckInWindowStrip";
import {RoomGrid, RoomTable} from "./RoomGrid";
import {RoundStatusStrip} from "./RoundStatus";
import {nextStep} from "../../../lib/roundNextStep";
import {QuickRoomModal} from "./QuickModals";
import {Segmented} from "./ui";

const DrawPanel = lazy(() => import("./panels/DrawPanel"));
const RoomsPanel = lazy(() => import("./panels/RoomsPanel"));
const PublishPanel = lazy(() => import("./panels/PublishPanel"));
const MotionPanel = lazy(() => import("./panels/MotionPanel"));
const BallotLinksPanel = lazy(() => import("./panels/BallotLinksPanel"));
const AdvancePanel = lazy(() => import("./panels/AdvancePanel"));
const AllocateRoomsModal = lazy(() => import("./modals/AllocateRoomsModal"));
const PairingPreviewModal = lazy(() => import("./modals/PairingPreviewModal"));

const PANEL_BUTTONS = [
    ["draw", "Draw"], ["rooms", "Rooms"], ["publish", "Publish"], ["motion", "Motion"], ["ballot-links", "Ballot links"], ["advance", "Advance"],
];
const STEP_PANELS = [null, "draw", "rooms", "publish", null, "advance"];
const VIEW_KEY = "axiom.live.directorView";

function readView() {
    try { return sessionStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid"; } catch { return "grid"; }
}

export default function Director({live, nowMs, admins, eventId, panel, setPanel, highlightDebateId, onOpenDebate, onOpenBallot}) {
    const {round, debates, rooms, people, presentIds, eliminatedSet, busy, resultsPublished} = live;
    const [view, setView] = useState(readView);
    const [sort, setSort] = useState("room");
    const [search, setSearch] = useState("");
    const q = useDeferredValue(search);
    const [allocateMode, setAllocateMode] = useState(null);
    const [preview, setPreview] = useState(null);
    const [addingRoom, setAddingRoom] = useState(false);

    useEffect(() => { try { sessionStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ } }, [view]);
    // A highlighted (found) debate must be visible: drop any filter hiding it.
    const [clearedFor, setClearedFor] = useState(null);
    if (highlightDebateId && clearedFor !== highlightDebateId) {
        setClearedFor(highlightDebateId);
        if (search) setSearch("");
    }

    const eligibleTotal = Math.max(people.length - eliminatedSet.size, presentIds.size);
    const counters = roundCounters({debates, round, presentCount: presentIds.size, totalCount: eligibleTotal, nowMs});
    const step = pipelineStep({debates, round});
    const withRoom = debates.filter((d) => d.roomId && d.room).length;
    const pending = debates.filter((d) => d.status !== "COMPLETED");
    const next = nextStep({
        step, present: presentIds.size, total: eligibleTotal, debates: debates.length, withRoom,
        noJudge: debates.filter((d) => !judgeOf(d)).length, pending: pending.length, resultsPublished,
        isRound1: round.roundNumber === 1, busy,
        actions: {
            generate: live.generatePairings,
            allocate: setAllocateMode,
            publish: live.togglePublish,
            nextBallot: () => pending[0] && onOpenBallot(pending[0].id),
            advance: () => setPanel("advance"),
            publishResults: live.publishResults,
        },
    });

    const shown = useMemo(
        () => sortDebates(debates.filter((d) => debateMatches(d, q)), sort, nowMs, round),
        [debates, q, sort, nowMs, round],
    );

    // Scroll the found debate into view.
    useEffect(() => {
        if (!highlightDebateId) return;
        const t = window.setTimeout(() => {
            document.querySelector(`[data-debate-id="${CSS.escape(highlightDebateId)}"]`)?.scrollIntoView({behavior: "smooth", block: "center"});
        }, 60);
        return () => window.clearTimeout(t);
    }, [highlightDebateId, view]);

    const openPreview = async () => {
        const res = await live.previewPairings();
        if (res) setPreview(res);
    };
    const closePanel = () => setPanel(null);

    return (
        <div className="space-y-3">
            <RoundStatusStrip step={step} next={next} onStep={(i) => (STEP_PANELS[i] ? setPanel(STEP_PANELS[i]) : i === 4 ? next.run?.() : null)} compact />

            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums" aria-live="polite">
                <span>Checked in <b className="font-display text-xl">{counters.checkedIn}/{counters.eligible}</b></span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span>Ballots <b className="font-display text-xl">{counters.ballots}/{counters.debates}</b></span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className={cn(counters.flagged && "font-semibold")}>{counters.flagged} flagged</span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className={cn(counters.silent && "font-semibold")} title="No ballot 20+ minutes after the draw went out">{counters.silent} silent</span>
            </p>

            <CheckInWindowStrip round={round} busy={busy} onUpdateWindow={live.updateCheckInWindow} />

            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section aria-label="Rooms board" className="ax-card min-w-0 space-y-3 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative block min-w-0 flex-1 sm:max-w-xs">
                            <span className="sr-only">Find a debater, room or judge</span>
                            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Find debater, room, judge"
                                className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-base sm:text-sm"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                                    <X size={14} aria-hidden="true" />
                                </button>
                            )}
                        </label>
                        <Segmented label="View" value={view} onChange={setView} options={[{value: "grid", label: "Grid"}, {value: "table", label: "Table"}]} />
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            Sort
                            <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-11 rounded-lg border border-input bg-card px-2 text-base text-foreground sm:text-xs">
                                <option value="room">Room</option>
                                <option value="state">State</option>
                                <option value="flags">Flags</option>
                                <option value="updated">Updated</option>
                            </select>
                        </label>
                    </div>
                    <nav aria-label="Round tools" className="no-scrollbar flex gap-1.5 overflow-x-auto">
                        {PANEL_BUTTONS.map(([id, label]) => (
                            <button key={id} type="button" onClick={() => setPanel(id)} aria-pressed={panel === id} className="ax-ghost-btn min-h-11 shrink-0 !px-3 !text-xs">
                                {label}
                            </button>
                        ))}
                    </nav>
                    {!debates.length ? (
                        <p className="m-0 py-8 text-center text-sm text-muted-foreground">No draw yet. {presentIds.size} debaters checked in.</p>
                    ) : view === "grid" ? (
                        <RoomGrid debates={shown} round={round} nowMs={nowMs} admins={admins} highlightId={highlightDebateId} onOpen={onOpenDebate} />
                    ) : (
                        <RoomTable debates={shown} round={round} nowMs={nowMs} admins={admins} highlightId={highlightDebateId} onOpen={onOpenDebate} />
                    )}
                </section>
                <aside aria-label="Activity" className="ax-card min-w-0 p-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto">
                    <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Activity</p>
                    <ActivityFeed eventId={eventId} roundId={round.id} limit={30} compact />
                </aside>
            </div>

            <Suspense fallback={null}>
                {panel === "draw" && (
                    <DrawPanel round={round} debates={debates} busy={busy} presentCount={presentIds.size} onPreview={openPreview} onGenerate={live.generatePairings} onClose={closePanel} />
                )}
                {panel === "rooms" && (
                    <RoomsPanel
                        debates={debates} rooms={rooms} savingDebateId={live.savingDebateId}
                        onAllocate={setAllocateMode} onAddRoom={() => setAddingRoom(true)} onAssignJudge={live.assignJudge}
                        onOpenDebate={onOpenDebate} onClose={closePanel}
                    />
                )}
                {panel === "publish" && (
                    <PublishPanel
                        round={round} debates={debates} resultsPublished={resultsPublished} busy={busy}
                        onTogglePublish={live.togglePublish} onPublishResults={live.publishResults} onOpenPanel={setPanel} onClose={closePanel}
                    />
                )}
                {panel === "motion" && <MotionPanel key={round.id} round={round} busy={live.isBusy("motion")} onSave={live.saveMotion} onClose={closePanel} />}
                {panel === "ballot-links" && <BallotLinksPanel roundId={round.id} roundLabel={round.name || `Round ${round.roundNumber}`} onClose={closePanel} />}
                {panel === "advance" && (
                    <AdvancePanel
                        key={round.id}
                        roundId={round.id} performers={live.performers} people={people} promotionsVersion={live.promotionsVersion} busy={busy}
                        resultsPublished={resultsPublished} onApply={live.applyPromotionDelta} onPromoteWinners={live.promoteAllWinners}
                        onPublishResults={live.publishResults} onClose={closePanel}
                    />
                )}
                {allocateMode && (
                    <AllocateRoomsModal
                        onClose={() => setAllocateMode(null)}
                        onConfirm={async (formData) => {
                            if (await live.allocateRooms(formData, {onlyUnassigned: allocateMode === "unassigned"})) setAllocateMode(null);
                        }}
                        totalDebates={allocateMode === "unassigned" ? debates.filter((d) => !d.roomId).length : debates.length}
                        rooms={rooms}
                        loading={busy === "allocating"}
                    />
                )}
                {preview && (
                    <PairingPreviewModal
                        preview={preview}
                        roundNumber={round.roundNumber}
                        onClose={() => setPreview(null)}
                        generating={busy === "generating"}
                        onGenerate={() => { setPreview(null); void live.generatePairings(); }}
                    />
                )}
            </Suspense>
            {addingRoom && (
                <QuickRoomModal onClose={() => setAddingRoom(false)} onCreated={(room) => { setAddingRoom(false); live.addRoom(room); }} />
            )}
        </div>
    );
}
