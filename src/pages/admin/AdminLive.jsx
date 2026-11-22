import {lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi} from "../../services/api";
import {useAdminEvent} from "../../contexts/adminEvent";
import {useToast} from "../../hooks/useToast";
import {usePresence} from "../../hooks/usePresence";
import {useRoundLive} from "../../hooks/useRoundLive";
import {useDebouncedCallback} from "../../hooks/useAdminRealtime";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import InlineResultSheet from "../../components/admin/InlineResultSheet";
import {commandContext, defaultStation, findDebateByRoom, fullName, parsePanel, parseStation} from "../../lib/liveStations";
import LiveHeader from "./live/LiveHeader";
import {QuickCreateRoundModal} from "./live/QuickModals";
import {EmptyBlock} from "./live/ui";

const Director = lazy(() => import("./live/Director"));
const Desk = lazy(() => import("./live/Desk"));
const Results = lazy(() => import("./live/Results"));
const DebateDrawer = lazy(() => import("./live/DebateDrawer"));

const STATION_KEY = "axiom.live.station";

function initialStation(params) {
    const fromUrl = parseStation(params.get("station"));
    if (fromUrl) return fromUrl;
    try {
        const saved = parseStation(sessionStorage.getItem(STATION_KEY));
        if (saved) return saved;
    } catch { /* private mode */ }
    return defaultStation(typeof window !== "undefined" ? window.innerWidth : 1280);
}

/**
 * Live = the station shell. One source of truth (useRoundLive) shared by the
 * Director, Desk and Results stations. URL: ?station= ?round= ?debate= ?panel=
 */
export default function AdminLive() {
    const {getToken} = useAuth();
    const toast = useToast();
    const {events, event, eventId, setEventId, loading: eventsLoading} = useAdminEvent();
    const [params, setParams] = useSearchParams();

    const [station, setStationState] = useState(() => initialStation(params));
    const [panel, setPanel] = useState(() => parsePanel(params.get("panel")));
    const [urlRound, setUrlRound] = useState(() => params.get("round") || null);
    // Open debate: drawer (judge/room) or ballot sheet.
    const [open, setOpen] = useState(() => (params.get("debate") ? {debateId: params.get("debate"), mode: initialStation(params) === "director" ? "drawer" : "ballot"} : null));
    const [highlightDebateId, setHighlightDebateId] = useState(null);
    const [deskSearch, setDeskSearch] = useState("");
    const [showQuickRound, setShowQuickRound] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const openDebateIdRef = useRef(null);
    useLayoutEffect(() => { openDebateIdRef.current = open?.debateId || null; }, [open]);

    const live = useRoundLive({eventId, preferredRoundId: urlRound, openDebateIdRef});
    const {rounds, roundId, round, debates, people, loading, roundsLoaded} = live;

    useEffect(() => {
        const t = window.setInterval(() => setNowMs(Date.now()), 30000);
        return () => window.clearInterval(t);
    }, []);

    const setStation = useCallback((next) => {
        const s = parseStation(next);
        if (!s) return;
        setStationState(s);
        try { sessionStorage.setItem(STATION_KEY, s); } catch { /* private mode */ }
    }, []);
    useEffect(() => { try { sessionStorage.setItem(STATION_KEY, station); } catch { /* private mode */ } }, [station]);

    // ----- URL <-> state -----
    const buildParams = (base) => {
        const next = new URLSearchParams(base);
        const set = (k, v) => (v ? next.set(k, v) : next.delete(k));
        set("station", station);
        set("round", roundId || urlRound);
        set("debate", open?.debateId);
        set("panel", station === "director" ? panel : null);
        return next;
    };
    const paramStr = params.toString();
    const ownStr = buildParams(params).toString();
    useEffect(() => {
        if (ownStr !== paramStr) setParams(new URLSearchParams(ownStr), {replace: true});
    }, [ownStr, paramStr, setParams]);

    // External navigation to /admin?… while mounted (palette, links): adopt it.
    const [seenParams, setSeenParams] = useState(paramStr);
    if (paramStr !== seenParams) {
        setSeenParams(paramStr);
        if (paramStr !== ownStr) {
            const s = parseStation(params.get("station"));
            if (s && s !== station) setStationState(s);
            const r = params.get("round");
            if (r && r !== roundId) setUrlRound(r);
            if (params.has("panel")) {
                const p = parsePanel(params.get("panel"));
                if (p !== panel) setPanel(p);
            }
            const d = params.get("debate");
            if (d && d !== open?.debateId) setOpen({debateId: d, mode: (s || station) === "director" ? "drawer" : "ballot"});
        }
    }

    // A ?round= from another event (redirect / deep link): switch event once.
    const triedRound = useRef(null);
    useEffect(() => {
        if (!urlRound || !roundsLoaded || triedRound.current === urlRound) return;
        if (rounds.some((r) => r.id === urlRound)) return;
        triedRound.current = urlRound;
        let active = true;
        (async () => {
            try {
                const token = await getToken();
                const res = await AdminApi.apiRequest(`/rounds/${urlRound}`, "GET", null, token);
                const target = res?.round?.eventId;
                if (active && target && target !== eventId) setEventId(target);
            } catch { /* keep the current event */ }
        })();
        return () => { active = false; };
    }, [urlRound, roundsLoaded, rounds, eventId, setEventId, getToken]);

    const selectRound = useCallback((id) => {
        setUrlRound(id);
        live.setRoundId(id);
        setOpen(null);
        setPanel(null);
    }, [live]);

    // ----- presence -----
    const focusKey = open ? `debate:${open.debateId}` : panel && station === "director" ? `panel:${panel}` : "";
    const focusRoomName = open ? (debates.find((d) => d.id === open.debateId)?.room?.name || "") : "";
    const focus = useMemo(() => {
        if (!focusKey) return null;
        const i = focusKey.indexOf(":");
        const kind = focusKey.slice(0, i);
        const label = kind === "debate" && focusRoomName ? String(focusRoomName).slice(0, 60) : undefined;
        return {kind, id: focusKey.slice(i + 1), ...(label ? {label} : {})};
    }, [focusKey, focusRoomName]);
    const {admins, me} = usePresence({eventId, roundId, station, focus});

    // ----- open debate helpers -----
    const openDebate = useCallback((debateId) => setOpen({debateId, mode: "drawer"}), []);
    const openBallot = useCallback((debateId) => setOpen({debateId, mode: "ballot"}), []);
    const openDefault = useCallback((debateId) => setOpen({debateId, mode: station === "director" ? "drawer" : "ballot"}), [station]);
    const openDebateObj = open ? debates.find((d) => d.id === open.debateId) || null : null;

    // ----- ⌘K palette: commands in, searchable context out -----
    const commandRef = useRef(null);
    useLayoutEffect(() => {
        commandRef.current = ({action, payload = {}} = {}) => {
            switch (action) {
                case "open-debate":
                    if (payload.debateId) openDefault(payload.debateId);
                    break;
                case "open-room": {
                    const d = findDebateByRoom(debates, payload.roomName);
                    if (d) openDefault(d.id);
                    else toast.info("Room not found", payload.roomName ? `No debate in "${payload.roomName}".` : "");
                    break;
                }
                case "find-debater": {
                    const d = debates.find((x) => x.debater1Id === payload.userId || x.debater2Id === payload.userId
                        || x.debater1?.id === payload.userId || x.debater2?.id === payload.userId);
                    const person = people.find((u) => u.id === payload.userId);
                    if (d && station !== "desk") {
                        setOpen(null);
                        setHighlightDebateId(d.id);
                        window.setTimeout(() => setHighlightDebateId((cur) => (cur === d.id ? null : cur)), 4000);
                    } else if (person) {
                        setStation("desk");
                        setDeskSearch(fullName(person));
                    }
                    break;
                }
                case "open-panel":
                    if (parsePanel(payload.panel)) {
                        setStation("director");
                        setOpen(null);
                        setPanel(parsePanel(payload.panel));
                    }
                    break;
                case "set-station":
                    setStation(payload.station);
                    break;
                case "publish-draw":
                    if (round?.pairingsPublished) toast.info("Draw already published");
                    else void live.togglePublish();
                    break;
                case "publish-results":
                    if (live.resultsPublished) toast.info("Results already public");
                    else void live.publishResults();
                    break;
                default:
            }
        };
    });
    useEffect(() => {
        const onCommand = (e) => commandRef.current?.(e.detail);
        window.addEventListener("axiom:command", onCommand);
        return () => window.removeEventListener("axiom:command", onCommand);
    }, []);
    const announceContext = useDebouncedCallback((detail) => {
        window.dispatchEvent(new CustomEvent("axiom:command-context", {detail}));
    }, 400);
    const ctx = useMemo(() => (roundId ? commandContext(roundId, debates, people) : null), [roundId, debates, people]);
    useEffect(() => { if (ctx) announceContext(ctx); }, [ctx, announceContext]);

    // ----- render -----
    if (eventsLoading || (loading && !round)) {
        return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Loading live round" /></div>;
    }
    if (!event) return <EmptyBlock title="No event yet" body="Create an event and its rounds to run it from here." to="/admin/events" cta="Set up an event" />;
    if (!round && (live.roundsError || live.roundError || rounds.length > 0)) {
        return (
            <div role="alert" className="ax-card mx-auto mt-10 max-w-lg space-y-4 p-8 text-center">
                <h1 className="font-display text-4xl font-normal text-primary">Couldn't load round data</h1>
                <p className="text-sm text-muted-foreground">{live.roundsError || live.roundError || "Round data is unavailable. Please try again."}</p>
                <button type="button" onClick={live.retryRoundData} className="ax-primary-btn mx-auto">Retry</button>
            </div>
        );
    }
    if (!rounds.length || !round) {
        return (
            <div className="ax-card mx-auto mt-10 max-w-lg space-y-4 p-8 text-center">
                <h1 className="font-display text-4xl font-normal text-primary">{event.name} has no rounds yet</h1>
                <p className="text-sm text-muted-foreground">Add the first round to begin check-in, the draw and ballots.</p>
                <button type="button" onClick={() => setShowQuickRound(true)} className="ax-primary-btn mx-auto">+ Add Round 1</button>
                {showQuickRound && (
                    <QuickCreateRoundModal
                        eventId={event.id}
                        defaultRoundNumber={1}
                        onClose={() => setShowQuickRound(false)}
                        onCreated={(r) => { setShowQuickRound(false); live.addRound(r); setUrlRound(r.id); }}
                    />
                )}
            </div>
        );
    }

    const stationProps = {live, nowMs, admins};
    return (
        <div className="mx-auto max-w-[1400px] space-y-3 font-sans">
            <LiveHeader
                events={events} event={event} eventId={eventId} setEventId={(id) => { setUrlRound(null); setOpen(null); setPanel(null); setEventId(id); }}
                rounds={rounds} round={round} roundId={roundId} setRoundId={selectRound}
                station={station} setStation={(s) => { setStation(s); if (s !== "director") setPanel(null); }}
                admins={admins} me={me} statusBusy={live.isBusy("status")} onStatus={live.updateRoundStatus}
                onAddRound={() => setShowQuickRound(true)}
            />

            <Suspense fallback={<div className="grid min-h-[30vh] place-items-center"><LoadingIndicator label="Loading station" /></div>}>
                {station === "director" && (
                    <Director
                        {...stationProps}
                        eventId={eventId}
                        panel={panel}
                        setPanel={(p) => { setOpen(null); setPanel(p); }}
                        highlightDebateId={highlightDebateId}
                        onOpenDebate={openDebate}
                        onOpenBallot={openBallot}
                    />
                )}
                {station === "desk" && <Desk {...stationProps} search={deskSearch} setSearch={setDeskSearch} />}
                {station === "results" && <Results {...stationProps} onOpenBallot={openBallot} />}

                {open?.mode === "drawer" && openDebateObj && (
                    <DebateDrawer
                        key={openDebateObj.id}
                        debate={openDebateObj}
                        round={round}
                        rooms={live.rooms}
                        debates={debates}
                        admins={admins}
                        nowMs={nowMs}
                        saving={live.savingDebateId === openDebateObj.id || live.isBusy("room-judge")}
                        onAssignJudge={live.assignJudge}
                        onAssignRoomJudge={live.assignRoomJudge}
                        onAssignRoom={live.assignRoom}
                        onOpenBallot={openBallot}
                        onClose={() => setOpen(null)}
                    />
                )}
            </Suspense>

            {open?.mode === "ballot" && openDebateObj && (
                <InlineResultSheet
                    debate={openDebateObj}
                    debates={debates}
                    onSaved={(info, saved) => {
                        live.applyResultSaved(info, saved);
                        toast.success("Ballot saved", "Higher score is the winner.");
                        setOpen(info.nextDebate?.id ? {debateId: info.nextDebate.id, mode: "ballot"} : null);
                    }}
                    onReplaced={(err) => { live.ballotReplaced(err); setOpen(null); }}
                    onClose={() => setOpen(null)}
                />
            )}

            {showQuickRound && (
                <QuickCreateRoundModal
                    eventId={event.id}
                    defaultRoundNumber={rounds.length + 1}
                    onClose={() => setShowQuickRound(false)}
                    onCreated={(r) => {
                        setShowQuickRound(false);
                        live.addRound(r);
                        setUrlRound(r.id);
                        toast.success("Round created", `Switched to Round ${r.roundNumber}.`);
                    }}
                />
            )}
        </div>
    );
}
