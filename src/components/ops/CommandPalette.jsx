import {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocation, useNavigate} from "react-router-dom";
import {Search} from "lucide-react";
import {fuzzyFilter} from "../../lib/fuzzy";
import {cn} from "../../lib/utils";

// ⌘K / Ctrl+K (or "/" outside inputs) command bar for the Director.
//
// Context in:  window CustomEvent "axiom:command-context"
//              detail {roundId, debates:[{id, roomName, debater1Name, debater2Name}], people:[{userId, name}]}
// Commands out: window CustomEvent "axiom:command" detail {action, payload}
//   "open-debate" {debateId} | "open-room" {roomName} | "find-debater" {userId}
//   "open-panel" {panel: "draw"|"rooms"|"publish"|"motion"|"ballot-links"|"advance"}
//   "set-station" {station: "director"|"desk"|"results"} | "publish-draw" | "publish-results"
// Round commands run on the Live screen: from any other page we navigate to /admin
// first (keeping ?round and ?event) and deliver the command once Live is listening.

export const COMMAND_EVENT = "axiom:command";
export const COMMAND_CONTEXT_EVENT = "axiom:command-context";
/** Dispatch on window to open the palette from a button (phones have no ⌘K). */
export const OPEN_PALETTE_EVENT = "axiom:command-palette-open";
const PENDING_FALLBACK_MS = 2500;

const NAV_ITEMS = [
  {id: "nav-live", group: "Go to", label: "Live", hint: "Round control", to: "/admin"},
  {id: "nav-setup", group: "Go to", label: "Setup", hint: "Events, rounds, rooms", to: "/admin/setup"},
  {id: "nav-setup-rounds", group: "Go to", label: "Setup · Rounds", hint: "Round sequence, advance targets", to: "/admin/setup?tab=rounds"},
  {id: "nav-setup-rooms", group: "Go to", label: "Setup · Rooms", hint: "Room inventory", to: "/admin/setup?tab=rooms"},
  {id: "nav-people", group: "Go to", label: "People", hint: "This event's debaters", to: "/admin/people"},
  {id: "nav-people-registry", group: "Go to", label: "People · All users", hint: "Registry and enrolment", to: "/admin/people?tab=registry"},
  {id: "nav-results", group: "Go to", label: "Results", hint: "Ballots by round", to: "/admin/results"},
  {id: "nav-standings", group: "Go to", label: "Results · Standings", hint: "Leaderboard", to: "/admin/results?tab=standings"},
  {id: "nav-display", group: "Go to", label: "Display", hint: "Projector: check-in QR, draw, motion", to: "/admin/display"},
];

const ACTION_ITEMS = [
  {id: "st-director", group: "Station", label: "Switch station: Director", action: "set-station", payload: {station: "director"}},
  {id: "st-desk", group: "Station", label: "Switch station: Desk", action: "set-station", payload: {station: "desk"}},
  {id: "st-results", group: "Station", label: "Switch station: Results", action: "set-station", payload: {station: "results"}},
  {id: "act-draw", group: "Round", label: "Open draw panel", action: "open-panel", payload: {panel: "draw"}},
  {id: "act-rooms", group: "Round", label: "Open rooms", action: "open-panel", payload: {panel: "rooms"}},
  {id: "act-motion", group: "Round", label: "Show motion", action: "open-panel", payload: {panel: "motion"}},
  {id: "act-publish-draw", group: "Round", label: "Publish draw", action: "publish-draw", payload: {}},
  {id: "act-publish-results", group: "Round", label: "Publish results", action: "publish-results", payload: {}},
  {id: "act-ballots", group: "Round", label: "Ballot links", action: "open-panel", payload: {panel: "ballot-links"}},
  {id: "act-advance", group: "Round", label: "Advance best losers", action: "open-panel", payload: {panel: "advance"}},
];

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

function contextItems(context) {
  if (!context) return [];
  const items = [];
  const rooms = new Set();
  for (const d of context.debates || []) {
    if (!d?.id) continue;
    const names = [d.debater1Name, d.debater2Name].filter(Boolean).join(" vs ") || "Debate";
    items.push({
      id: `debate-${d.id}`,
      group: "Debates",
      label: d.roomName ? `${d.roomName} · ${names}` : names,
      keys: [d.roomName, d.debater1Name, d.debater2Name, names].filter(Boolean),
      action: "open-debate",
      payload: {debateId: d.id},
    });
    if (d.roomName && !rooms.has(d.roomName)) {
      rooms.add(d.roomName);
      items.push({id: `room-${d.roomName}`, group: "Rooms", label: d.roomName, action: "open-room", payload: {roomName: d.roomName}});
    }
  }
  for (const p of context.people || []) {
    if (!p?.userId) continue;
    items.push({id: `person-${p.userId}`, group: "Debaters", label: p.name || "Debater", action: "find-debater", payload: {userId: p.userId}});
  }
  return items;
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [context, setContext] = useState(null);
  const pending = useRef(null);
  const inputRef = useRef(null);
  const restoreFocus = useRef(null);
  const listId = useId();

  // Live page publishes searchable context; deliver a queued command once it is listening.
  useEffect(() => {
    const onContext = (event) => {
      setContext(event.detail || null);
      if (pending.current) {
        const {detail, timer} = pending.current;
        window.clearTimeout(timer);
        pending.current = null;
        window.dispatchEvent(new CustomEvent(COMMAND_EVENT, {detail}));
      }
    };
    window.addEventListener(COMMAND_CONTEXT_EVENT, onContext);
    return () => {
      window.removeEventListener(COMMAND_CONTEXT_EVENT, onContext);
      if (pending.current) window.clearTimeout(pending.current.timer);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => restoreFocus.current?.focus?.());
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => {
          if (!was) restoreFocus.current = document.activeElement;
          return !was;
        });
        return;
      }
      if (event.key === "/" && !mod && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        restoreFocus.current = document.activeElement;
        setOpen(true);
      }
    };
    const onOpenRequest = () => {
      restoreFocus.current = document.activeElement;
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const allItems = useMemo(() => [...NAV_ITEMS, ...ACTION_ITEMS, ...contextItems(context)], [context]);
  const results = useMemo(
    () => fuzzyFilter(allItems, query, (item) => [item.label, ...(item.keys || []), item.hint].filter(Boolean), 40),
    [allItems, query],
  );
  const safeIndex = results.length ? Math.min(activeIndex, results.length - 1) : -1;
  const optionId = (index) => `${listId}-opt-${index}`;

  const dispatchCommand = (detail) => {
    const onLive = location.pathname === "/admin" || location.pathname === "/admin/";
    if (onLive) {
      window.dispatchEvent(new CustomEvent(COMMAND_EVENT, {detail}));
      return;
    }
    const params = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    const round = params.get("round") || context?.roundId;
    if (round) keep.set("round", round);
    if (params.get("event")) keep.set("event", params.get("event"));
    if (pending.current) window.clearTimeout(pending.current.timer);
    // Fallback in case Live never publishes context (e.g. no round yet).
    const timer = window.setTimeout(() => {
      if (pending.current?.detail !== detail) return;
      pending.current = null;
      window.dispatchEvent(new CustomEvent(COMMAND_EVENT, {detail}));
    }, PENDING_FALLBACK_MS);
    pending.current = {detail, timer};
    navigate({pathname: "/admin", search: keep.toString() ? `?${keep}` : ""});
  };

  const execute = (item) => {
    if (!item) return;
    close();
    if (item.to) {
      const [pathname, search = ""] = item.to.split("?");
      const params = new URLSearchParams(search);
      const current = new URLSearchParams(location.search);
      if (current.get("event")) params.set("event", current.get("event"));
      navigate({pathname, search: params.toString() ? `?${params}` : ""});
      return;
    }
    dispatchCommand({action: item.action, payload: item.payload || {}});
  };

  const onInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (Math.min(i, results.length - 1) + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (Math.min(i, results.length - 1) - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(results[safeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      event.preventDefault(); // keep focus inside the dialog
    }
  };

  useEffect(() => {
    if (safeIndex < 0) return;
    document.getElementById(optionId(safeIndex))?.scrollIntoView?.({block: "nearest"});
    // optionId is derived from the stable listId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex]);

  if (!open || typeof document === "undefined") return null;

  let lastGroup = null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-3 pt-[max(1rem,10vh)] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-label="Command bar" className="axiom-workspace w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={safeIndex >= 0 ? optionId(safeIndex) : undefined}
            aria-label="Type a command, room or debater"
            placeholder="Jump to a room or debater, or run a round action…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground sm:inline">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="m-0 max-h-[min(60dvh,420px)] list-none overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches. Open Live to search rooms and debaters.</li>}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const active = index === safeIndex;
            return (
              <li key={item.id} role="presentation">
                {header && <p aria-hidden="true" className="m-0 px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{header}</p>}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => { if (!active) setActiveIndex(index); }}
                  onClick={() => execute(item)}
                  className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-[15px]", active ? "bg-[#1D1E18] text-[#EAFBF5] dark:bg-[#B9F5D8] dark:text-[#141510]" : "text-foreground")}
                >
                  <span className="min-w-0 truncate font-semibold">{item.label}</span>
                  {item.hint && <span className={cn("shrink-0 truncate text-xs", active ? "opacity-80" : "text-muted-foreground")}>{item.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="m-0 hidden border-t border-border px-3 py-2 text-xs text-muted-foreground sm:block">↑↓ to move · Enter to run · Esc to close · ⌘K or / to open</p>
      </div>
    </div>,
    document.body,
  );
}
