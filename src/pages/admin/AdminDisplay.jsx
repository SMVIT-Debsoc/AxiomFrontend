import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import {Maximize, Minimize, X} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi, OpsApi, RoundApi} from "../../services/api";
import {useEventSocket, useLiveRefresh, useRoundSocket} from "../../hooks/useSocket";
import {useDebouncedCallback, useLatestRequest} from "../../hooks/useAdminRealtime";
import {usePresence} from "../../hooks/usePresence";
import {useAdminEvent} from "../../contexts/adminEvent";
import QrCode from "../../components/ops/QrCode";
import {drawRows, paginate, pickDisplayRound, rowsThatFit, secondsUntil, wrapPage} from "../../lib/displayBoard";
import {formatShortCode, venueCheckInUrl} from "../../lib/opsLinks";
import {cn} from "../../lib/utils";

// /admin/display — the projector in the main hall. Read-only, no admin chrome,
// readable from 15 m: black background, white Bebas Neue, colour only for state.
// Modes: 1 Check-in (rotating venue QR) · 2 Draw (auto-paginating, by first name) · 3 Motion.
// Keys: 1/2/3 switch mode, F fullscreen, R reveal motion, ←/→ page the draw.

const MODES = [
  {key: "checkin", label: "Check-in", hotkey: "1"},
  {key: "draw", label: "Draw", hotkey: "2"},
  {key: "motion", label: "Motion", hotkey: "3"},
];
const PAGE_MS = 12000;
const DEFAULT_ROTATE_SECONDS = 30;
const CONTROLS_HIDE_MS = 3000;
const ROW_HEIGHT = 96;

function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

function useViewportHeight() {
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 1080 : window.innerHeight));
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

const windowState = (round, now) => {
  if (!round?.checkInStartTime || !round?.checkInEndTime) return "unset";
  const start = new Date(round.checkInStartTime).getTime();
  const end = new Date(round.checkInEndTime).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
};

export default function AdminDisplay() {
  const {getToken} = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const {event, eventId, loading: eventsLoading} = useAdminEvent();
  const [searchParams] = useSearchParams();
  const requestedRoundId = searchParams.get("round");

  const [rounds, setRounds] = useState([]);
  const [roundsState, setRoundsState] = useState({loading: true, error: null});
  const roundsReq = useLatestRequest();
  const loadRounds = useCallback(async () => {
    if (!eventId) return;
    const request = roundsReq.begin();
    try {
      const token = await getTokenRef.current();
      const response = await RoundApi.listByEvent(eventId, token, {skipCache: true, signal: request.signal});
      if (!roundsReq.isCurrent(request.id)) return;
      setRounds(response.rounds || []);
      setRoundsState({loading: false, error: null});
    } catch (failure) {
      if (!roundsReq.isCurrent(request.id)) return;
      setRoundsState({loading: false, error: failure?.message || "Could not load rounds"});
    }
  }, [eventId, roundsReq]);
  // State is only set after the awaited request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRounds(); }, [loadRounds]);
  const refreshRounds = useDebouncedCallback(() => { void loadRounds(); }, 400);
  useEventSocket(eventId, {
    onRoundCreated: refreshRounds,
    onRoundUpdated: refreshRounds,
    onRoundDeleted: refreshRounds,
    onRoundStatusChange: refreshRounds,
    onPairingsPublished: refreshRounds,
    onRoundCheckInWindow: refreshRounds,
  });

  const round = useMemo(() => pickDisplayRound(rounds, requestedRoundId), [rounds, requestedRoundId]);
  const roundId = round?.id || null;
  usePresence({eventId, roundId, station: "display", focus: null});

  // ----- Draw ---------------------------------------------------------------
  const [debates, setDebates] = useState({roundId: null, list: []});
  const debatesReq = useLatestRequest();
  const published = Boolean(round?.pairingsPublished);
  const loadDebates = useCallback(async () => {
    if (!roundId || !published) return;
    const request = debatesReq.begin();
    try {
      const token = await getTokenRef.current();
      const response = await AdminApi.apiRequest(`/debates/round/${roundId}`, "GET", null, token, {skipCache: true, signal: request.signal});
      if (!debatesReq.isCurrent(request.id)) return;
      setDebates({roundId, list: response.debates || []});
    } catch {
      // Keep showing the last draw; the next live event or poll retries.
    }
  }, [roundId, published, debatesReq]);
  // State is only set after the awaited request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadDebates(); }, [loadDebates]);

  // ----- Check-in count ------------------------------------------------------
  const [attendance, setAttendance] = useState({roundId: null, present: null, total: null});
  const attendanceReq = useLatestRequest();
  const loadAttendance = useCallback(async () => {
    if (!roundId || !eventId) return;
    const request = attendanceReq.begin();
    try {
      const token = await getTokenRef.current();
      const options = {skipCache: true, signal: request.signal};
      const [checkIns, roster] = await Promise.all([
        AdminApi.apiRequest(`/check-in/round/${roundId}?view=attendance`, "GET", null, token, options),
        AdminApi.apiRequest(`/events/${eventId}/participants`, "GET", null, token, options),
      ]);
      if (!attendanceReq.isCurrent(request.id)) return;
      setAttendance({
        roundId,
        present: (checkIns.checkIns || []).filter((ci) => ci.status === "PRESENT").length,
        total: (roster.participants || []).length,
      });
    } catch {
      // Count stays at its last value.
    }
  }, [roundId, eventId, attendanceReq]);
  // State is only set after the awaited request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const refreshDebates = useDebouncedCallback(() => { void loadDebates(); }, 400);
  const refreshAttendance = useDebouncedCallback(() => { void loadAttendance(); }, 600);
  useRoundSocket(roundId, {
    onCheckInUpdate: refreshAttendance,
    onCheckInCount: refreshAttendance,
    onPairingsGenerated: refreshDebates,
    onPairingsPublished: () => { refreshRounds(); refreshDebates(); },
    onRoomsAllocated: refreshDebates,
    onDebateCreated: refreshDebates,
    onDebateUpdated: refreshDebates,
    onDebateDeleted: refreshDebates,
    onRoundUpdated: refreshRounds,
    onRoundStatusChange: refreshRounds,
  });
  useLiveRefresh(() => {
    void loadRounds();
    void loadDebates();
    void loadAttendance();
  }, {eventId, roundId, jitterMs: 2000, invalidateCache: false});

  // ----- Mode, controls, fullscreen -------------------------------------------
  const [chosenMode, setChosenMode] = useState(() => (MODES.some((m) => m.key === searchParams.get("mode")) ? searchParams.get("mode") : null));
  const [revealed, setRevealed] = useState({roundId: null});
  const motionRevealed = revealed.roundId === roundId && Boolean(roundId);
  const now = useTick(1000);
  const autoMode = windowState(round, now) === "open" || !published ? "checkin" : "draw";
  const mode = chosenMode || autoMode;

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef(null);
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => {
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    window.addEventListener("mousemove", pokeControls);
    window.addEventListener("touchstart", pokeControls, {passive: true});
    return () => {
      window.clearTimeout(hideTimer.current);
      window.removeEventListener("mousemove", pokeControls);
      window.removeEventListener("touchstart", pokeControls);
    };
  }, [pokeControls]);

  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const [page, setPage] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const picked = MODES.find((m) => m.hotkey === e.key);
      if (picked) {
        setChosenMode(picked.key);
        pokeControls();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if ((e.key === "r" || e.key === "R") && roundId) {
        setRevealed((prev) => (prev.roundId === roundId ? {roundId: null} : {roundId}));
      } else if (e.key === "ArrowRight") {
        setPage((p) => p + 1);
      } else if (e.key === "ArrowLeft") {
        setPage((p) => p - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pokeControls, toggleFullscreen, roundId]);

  // ----- Draw pagination -------------------------------------------------------
  const viewportHeight = useViewportHeight();
  const rows = useMemo(() => (debates.roundId === roundId ? drawRows(debates.list) : []), [debates, roundId]);
  const perPage = rowsThatFit(viewportHeight, ROW_HEIGHT, 260, {minRows: 4, maxRows: 14});
  const pages = useMemo(() => paginate(rows, perPage), [rows, perPage]);
  const pageIndex = wrapPage(page, pages.length);
  useEffect(() => {
    if (mode !== "draw" || pages.length < 2) return undefined;
    const timer = window.setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => window.clearInterval(timer);
  }, [mode, pages.length]);

  // ----- Render ----------------------------------------------------------------
  const roundTitle = round ? (round.name || `Round ${round.roundNumber}`) : null;
  let content;
  if (eventsLoading || (roundsState.loading && rounds.length === 0)) {
    content = <BigMessage title="Loading…" />;
  } else if (!eventId) {
    content = <BigMessage title="No event" note="Create an event in Setup first." />;
  } else if (!round) {
    content = <BigMessage title={event?.name || "Axiom"} note={roundsState.error || "No rounds yet."} />;
  } else if (mode === "checkin") {
    content = <CheckInMode round={round} attendance={attendance.roundId === roundId ? attendance : null} now={now} getTokenRef={getTokenRef} />;
  } else if (mode === "draw") {
    content = !published ? (
      <BigMessage title="Draw coming soon" note={roundTitle} />
    ) : rows.length === 0 ? (
      <BigMessage title="Loading draw…" note={roundTitle} />
    ) : (
      <DrawMode rows={pages[pageIndex]} pageIndex={pageIndex} pageCount={pages.length} title={roundTitle} total={rows.length} />
    );
  } else {
    content = (
      <MotionMode
        round={round}
        revealed={motionRevealed}
        onReveal={() => setRevealed({roundId})}
        onHide={() => setRevealed({roundId: null})}
        controlsVisible={controlsVisible}
      />
    );
  }

  return (
    <main
      className="relative flex min-h-dvh flex-col overflow-hidden bg-black text-white"
      style={{cursor: controlsVisible ? "default" : "none"}}
      aria-label="Tournament display"
    >
      <header className="flex items-baseline justify-between gap-6 px-[3vw] pt-[2.5vh]">
        <p className="m-0 truncate font-display text-[clamp(1.5rem,3vw,3rem)] leading-none tracking-wide text-white/80">{event?.name || "AXIOM"}</p>
        {roundTitle && <p className="m-0 shrink-0 font-display text-[clamp(1.5rem,3vw,3rem)] leading-none tracking-wide text-white">{roundTitle}</p>}
      </header>
      <div className="flex flex-1 flex-col px-[3vw] pb-[3vh] pt-[2vh]">{content}</div>

      {/* Auto-hiding controls (mouse move / touch shows them) */}
      <nav
        aria-label="Display controls"
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setChosenMode(m.key)}
            aria-pressed={mode === m.key}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-bold", mode === m.key ? "border-white bg-white text-black" : "border-white/40 text-white hover:bg-white/10")}
          >
            <span className="mr-1.5 text-xs opacity-60">{m.hotkey}</span>{m.label}
          </button>
        ))}
        {chosenMode && (
          <button type="button" onClick={() => setChosenMode(null)} className="min-h-11 rounded-full border border-white/40 px-4 text-sm font-bold text-white hover:bg-white/10">Auto</button>
        )}
        {rounds.length > 1 && (
          <RoundPicker rounds={rounds} currentId={roundId} />
        )}
        <button type="button" onClick={toggleFullscreen} className="grid h-11 w-11 place-items-center rounded-full border border-white/40 text-white hover:bg-white/10" aria-label={fullscreen ? "Exit full screen (F)" : "Full screen (F)"} title="Full screen (F)">
          {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
        </button>
        <Link to="/admin" className="grid h-11 w-11 place-items-center rounded-full border border-white/40 text-white hover:bg-white/10" aria-label="Close display" title="Back to Live">
          <X size={18} aria-hidden="true" />
        </Link>
      </nav>
    </main>
  );
}

function RoundPicker({rounds, currentId}) {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">Round</span>
      <select
        value={currentId || ""}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          next.set("round", e.target.value);
          setSearchParams(next, {replace: true});
        }}
        className="min-h-11 rounded-full border border-white/40 bg-black px-4 text-sm font-bold text-white"
      >
        {[...rounds].sort((a, b) => a.roundNumber - b.roundNumber).map((r) => (
          <option key={r.id} value={r.id}>{r.name || `Round ${r.roundNumber}`}</option>
        ))}
      </select>
    </label>
  );
}

function BigMessage({title, note}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="m-0 font-display text-[clamp(4rem,12vw,12rem)] leading-[0.9]">{title}</p>
      {note && <p className="m-0 font-display text-[clamp(1.5rem,3.5vw,3.5rem)] leading-none text-white/70">{note}</p>}
    </div>
  );
}

function CheckInMode({round, attendance, now, getTokenRef}) {
  const roundId = round.id;
  const [venue, setVenue] = useState({roundId: null, code: null, expiresAt: null, rotateSeconds: DEFAULT_ROTATE_SECONDS, error: null, errorCode: null});
  const req = useLatestRequest();
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const request = req.begin();
    try {
      const token = await getTokenRef.current();
      const response = await OpsApi.getVenueCode(roundId, token);
      if (!req.isCurrent(request.id)) return;
      const data = response?.data || response || {};
      const rotateSeconds = Number(data.rotateSeconds) > 0 ? Number(data.rotateSeconds) : DEFAULT_ROTATE_SECONDS;
      setVenue({
        roundId,
        code: data.code || null,
        expiresAt: data.expiresAt || Date.now() + rotateSeconds * 1000,
        rotateSeconds,
        error: null,
        errorCode: null,
      });
    } catch (failure) {
      if (!req.isCurrent(request.id)) return;
      setVenue((prev) => ({...prev, roundId, code: null, error: failure?.message || "Could not get a code", errorCode: failure?.code || null}));
    }
  }, [roundId, req, getTokenRef]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  // Rotate: fetch a new code when the current one expires (or every rotateSeconds; retry errors every 10 s).
  const current = venue.roundId === roundId ? venue : null;
  const left = current?.code ? secondsUntil(current.expiresAt, now) : null;
  const waitMs = current?.error ? 10000 : current?.code ? Math.max(1000, (secondsUntil(current.expiresAt) ?? current.rotateSeconds) * 1000) : null;
  useEffect(() => {
    if (waitMs == null) return undefined;
    const timer = window.setTimeout(() => setRefreshKey((k) => k + 1), waitMs);
    return () => window.clearTimeout(timer);
  }, [waitMs, current?.code, current?.error]);

  const state = windowState(round, now);
  const url = current?.code && typeof window !== "undefined" ? venueCheckInUrl(window.location.origin, roundId, current.code) : "";
  const qrSize = typeof window === "undefined" ? 480 : Math.round(Math.min(window.innerHeight * 0.62, window.innerWidth * 0.42));
  const closedMessage = current?.errorCode === "CHECKIN_CLOSED" || state === "closed";

  return (
    <div className="grid flex-1 items-center gap-[4vw] md:grid-cols-[auto_1fr]">
      <div className="flex justify-center">
        {closedMessage ? (
          <div className="grid aspect-square place-items-center rounded-3xl border-4 border-white/30 p-10 text-center font-display text-[clamp(3rem,6vw,6rem)] leading-none" style={{width: qrSize}}>
            Check-in closed
          </div>
        ) : url ? (
          <div className="rounded-3xl bg-white p-[1.2vw]">
            <QrCode value={url} size={qrSize} />
          </div>
        ) : (
          <div className="grid aspect-square place-items-center rounded-3xl border-4 border-white/30 p-10 text-center font-display text-[clamp(2rem,4vw,4rem)] leading-none" style={{width: qrSize}}>
            {current?.error || "Getting code…"}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[3vh]">
        <p className="m-0 font-display text-[clamp(3rem,7vw,8rem)] leading-[0.9]">
          {closedMessage ? "Check-in is closed" : state === "upcoming" ? "Check-in opens soon" : "Scan to check in"}
        </p>
        {!closedMessage && current?.code && (
          <div>
            <p className="m-0 text-[clamp(1rem,1.6vw,1.6rem)] font-semibold uppercase tracking-[0.2em] text-white/60">Or type the code</p>
            <p className="m-0 font-display text-[clamp(4rem,10vw,11rem)] leading-none tracking-[0.08em] tabular-nums">{formatShortCode(current.code)}</p>
            {left != null && (
              <p className="m-0 text-[clamp(1rem,1.8vw,1.8rem)] font-semibold tabular-nums text-white/70" aria-live="off">New code in {left}s</p>
            )}
          </div>
        )}
        <p className="m-0 font-display text-[clamp(2.5rem,5vw,5.5rem)] leading-none tabular-nums" aria-live="polite">
          Checked in {attendance?.present ?? "—"}
          <span className="text-white/60"> / {attendance?.total ?? "—"}</span>
        </p>
      </div>
    </div>
  );
}

function DrawMode({rows, pageIndex, pageCount, title, total}) {
  return (
    <div className="flex flex-1 flex-col">
      <ol aria-label={`${title} draw, ${total} debaters, page ${pageIndex + 1} of ${pageCount}`} className="m-0 flex flex-1 list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-x-[3vw] border-b border-white/20 py-[1.1vh]" style={{minHeight: ROW_HEIGHT}}>
            <div className="min-w-0">
              <p className="m-0 truncate font-display text-[clamp(2.2rem,4.2vw,4.8rem)] leading-none">{row.name}</p>
              <p className="m-0 mt-1 truncate text-[clamp(1rem,1.6vw,1.8rem)] font-semibold text-white/70">
                vs {row.opponent} · <span className="font-bold text-white">{row.side}</span>
              </p>
            </div>
            <p className="m-0 whitespace-nowrap font-display text-[clamp(2.4rem,4.8vw,5.4rem)] leading-none tabular-nums">
              <span aria-hidden="true" className="text-white/50">→ </span>{row.room}
            </p>
          </li>
        ))}
      </ol>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 pt-[2vh]" aria-hidden="true">
          {Array.from({length: pageCount}, (_, i) => (
            <span key={i} className={cn("h-3 rounded-full transition-all", i === pageIndex ? "w-10 bg-white" : "w-3 bg-white/35")} />
          ))}
        </div>
      )}
    </div>
  );
}

function MotionMode({round, revealed, onReveal, onHide, controlsVisible}) {
  if (!round.motion) return <BigMessage title="Motion not set" note={round.name} />;
  if (!revealed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] text-center">
        <p className="m-0 font-display text-[clamp(4rem,11vw,12rem)] leading-[0.9]">The motion is…</p>
        <button
          type="button"
          onClick={onReveal}
          className={cn("min-h-14 rounded-full border-2 border-white px-10 font-display text-[clamp(1.5rem,2.5vw,2.5rem)] tracking-wide transition-opacity hover:bg-white hover:text-black", controlsVisible ? "opacity-100" : "opacity-0 focus-visible:opacity-100")}
        >
          Reveal (R)
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col justify-center gap-[3vh]">
      <p className="m-0 text-[clamp(1rem,1.8vw,2rem)] font-semibold uppercase tracking-[0.25em] text-white/60">Motion</p>
      <p className="m-0 font-display text-[clamp(3rem,6.5vw,8rem)] leading-[0.95]">{round.motion}</p>
      <button type="button" onClick={onHide} className={cn("self-start rounded-full border border-white/40 px-5 py-2 text-sm font-bold text-white/80 transition-opacity", controlsVisible ? "opacity-100" : "opacity-0 focus-visible:opacity-100")}>
        Hide (R)
      </button>
    </div>
  );
}
