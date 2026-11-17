import {memo, useDeferredValue, useMemo, useState} from "react";
import {QrCode as QrIcon, ScanLine, Search, X} from "lucide-react";
import {cn} from "../../../lib/utils";
import {fullName, roomNameOf, userMatches} from "../../../lib/liveStations";
import CheckInWindowStrip from "./CheckInWindowStrip";
import ScanSheet from "./desk/ScanSheet";
import VenueQr from "./desk/VenueQr";
import {Segmented} from "./ui";

function windowCountdown(round, nowMs) {
    const start = Date.parse(round?.checkInStartTime);
    const end = Date.parse(round?.checkInEndTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return {label: "Check-in window not set", open: false};
    if (nowMs < start) return {label: `Check-in window opens in ${Math.ceil((start - nowMs) / 60000)}m`, open: false};
    if (nowMs <= end) {
        const s = Math.max(0, Math.floor((end - nowMs) / 1000));
        return {label: `Check-in window closes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, open: true};
    }
    return {label: "Check-in window closed", open: false};
}

/**
 * Desk (phone-first, one-handed): check-in count + window timer, search-first
 * roster with present/absent toggles, pass scanning, venue QR, room problems.
 */
export default function Desk({live, nowMs, search, setSearch}) {
    const {round, people, presentIds, eliminatedSet, pendingCheckIns, debates, rooms, busy} = live;
    const [tab, setTab] = useState("todo");
    const [showEliminated, setShowEliminated] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [venueOpen, setVenueOpen] = useState(false);
    const [showWindow, setShowWindow] = useState(false);
    const q = useDeferredValue(search);
    const countdown = windowCountdown(round, nowMs);

    const eligibleTotal = Math.max(people.length - eliminatedSet.size, presentIds.size);
    const list = useMemo(() => {
        const base = people.filter((u) => (tab === "in" ? presentIds.has(u.id) : !presentIds.has(u.id)));
        const visible = tab === "todo" && !showEliminated ? base.filter((u) => !eliminatedSet.has(u.id)) : base;
        return visible.filter((u) => userMatches(u, q)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
    }, [people, presentIds, eliminatedSet, tab, showEliminated, q]);
    const shown = list.slice(0, 150);
    const roomless = debates.filter((d) => !d.roomId);

    return (
        <div className="space-y-4 pb-24 md:pb-0">
            <section aria-label="Check-in count" className="ax-card p-4 text-center">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Checked in</p>
                <p className="m-0 font-display text-[clamp(3.5rem,18vw,5.5rem)] leading-none tabular-nums text-primary">
                    {presentIds.size}<span className="text-[0.45em] text-muted-foreground"> / {eligibleTotal}</span>
                </p>
                <button
                    type="button"
                    onClick={() => setShowWindow((v) => !v)}
                    aria-expanded={showWindow}
                    className={cn("mt-2 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold tabular-nums", countdown.open ? "ax-state-live" : "ax-state-waiting")}
                >
                    {countdown.label}
                </button>
                {showWindow && <div className="mt-3 text-left"><CheckInWindowStrip round={round} busy={busy} onUpdateWindow={live.updateCheckInWindow} /></div>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setVenueOpen(true)} className="ax-ghost-btn min-h-12 w-full">
                        <QrIcon size={16} aria-hidden="true" /> Show venue QR
                    </button>
                    <button type="button" onClick={() => setScanning(true)} className="ax-ghost-btn min-h-12 hidden w-full md:inline-flex">
                        <ScanLine size={16} aria-hidden="true" /> Scan pass
                    </button>
                </div>
            </section>

            <section aria-label="Debaters" className="space-y-3">
                <label className="relative block">
                    <span className="sr-only">Find a debater</span>
                    <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Name, college, phone, USN"
                        className="min-h-12 w-full rounded-xl border-[1.5px] border-input bg-card pl-11 pr-12 text-base"
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground">
                            <X size={16} aria-hidden="true" />
                        </button>
                    )}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                        label="Check-in lists"
                        value={tab}
                        onChange={setTab}
                        className="flex-1"
                        options={[
                            {value: "todo", label: `To check in (${Math.max(eligibleTotal - presentIds.size, 0)})`},
                            {value: "in", label: `Checked in (${presentIds.size})`},
                        ]}
                    />
                    {tab === "todo" && eliminatedSet.size > 0 && (
                        <button type="button" onClick={() => setShowEliminated((v) => !v)} aria-pressed={showEliminated} className="ax-ghost-btn min-h-11 !text-xs">
                            {showEliminated ? "Hide" : "Show"} eliminated ({eliminatedSet.size})
                        </button>
                    )}
                </div>
                {tab === "in" && !round.pairingsPublished && (
                    <p className="m-0 text-xs text-muted-foreground">Absent debaters are left out of the draw; an odd count is filled by a Swing.</p>
                )}
                {shown.length === 0 ? (
                    <p className="m-0 py-6 text-center text-sm text-muted-foreground">
                        {tab === "todo" ? "Everyone matching is checked in." : "Nobody checked in yet."}
                    </p>
                ) : (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {shown.map((u) => (
                            <DeskRow
                                key={u.id}
                                user={u}
                                present={presentIds.has(u.id)}
                                eliminated={eliminatedSet.has(u.id)}
                                pending={pendingCheckIns.has(u.id)}
                                onToggle={live.toggleCheckIn}
                            />
                        ))}
                    </ul>
                )}
                {list.length > shown.length && <p className="m-0 text-center text-xs text-muted-foreground">Showing {shown.length} of {list.length}. Search to narrow.</p>}
            </section>

            {debates.length > 0 && (
                <section aria-label="Room problems" className="ax-card space-y-2 p-4">
                    <h2 className="m-0 font-heading text-base font-bold">Room problems</h2>
                    {roomless.length === 0 ? (
                        <p className="m-0 text-sm text-muted-foreground">Every debate has a room.</p>
                    ) : (
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                            {roomless.map((d) => (
                                <RoomFix key={d.id} debate={d} rooms={rooms} debates={debates} saving={live.savingDebateId === d.id} onAssignRoom={live.assignRoom} />
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {/* Bottom-anchored primary action on phones (thumb zone). */}
            <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background px-4 py-3 shadow-lg md:hidden">
                <button type="button" onClick={() => setScanning(true)} className="ax-primary-btn w-full">
                    <ScanLine size={18} aria-hidden="true" /> Scan pass
                </button>
            </div>

            {scanning && <ScanSheet roundId={round.id} onCheckedIn={live.applyCheckIn} onClose={() => setScanning(false)} />}
            {venueOpen && <VenueQr roundId={round.id} roundLabel={round.name || `Round ${round.roundNumber}`} onClose={() => setVenueOpen(false)} />}
        </div>
    );
}

const DeskRow = memo(function DeskRow({user, present, eliminated, pending, onToggle}) {
    return (
        <li className={cn("flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5", present ? "ax-state-done" : eliminated ? "ax-state-waiting opacity-80" : "border-border bg-card")}>
            <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-base font-semibold">{fullName(user)}</p>
                <p className="m-0 truncate text-xs text-muted-foreground">
                    {user.college || "No college"}
                    {user.mobile ? <> · <a href={`tel:${user.mobile}`} className="font-medium text-foreground underline-offset-2 hover:underline">{user.mobile}</a></> : ""}
                </p>
                {eliminated && <p className="m-0 text-[11px] font-semibold">Eliminated</p>}
            </div>
            <button
                type="button"
                onClick={() => onToggle(user.id, present ? "ABSENT" : "PRESENT")}
                disabled={pending || (!present && eliminated)}
                className="min-h-12 min-w-[7.5rem] shrink-0 rounded-xl border-[1.5px] border-input bg-card px-3 text-sm font-bold hover:bg-muted disabled:opacity-50"
            >
                {pending ? "Saving…" : present ? "Mark absent" : eliminated ? "Out" : "Present"}
            </button>
        </li>
    );
});

function RoomFix({debate, rooms, debates, saving, onAssignRoom}) {
    const [roomId, setRoomId] = useState("");
    const used = new Set(debates.map((d) => d.roomId).filter(Boolean));
    const sorted = [...rooms].sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)));
    return (
        <li className="rounded-xl border border-border p-3">
            <p className="m-0 truncate text-sm font-semibold">{fullName(debate.debater1)} vs {fullName(debate.debater2)}</p>
            <p className="m-0 text-xs text-muted-foreground">{roomNameOf(debate) || "No room"}</p>
            <div className="mt-2 flex gap-2">
                <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Room" className="min-h-12 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base">
                    <option value="">Choose a room</option>
                    {sorted.map((r) => <option key={r.id} value={r.id}>{r.name}{used.has(r.id) ? " (in use)" : ""}</option>)}
                </select>
                <button type="button" disabled={!roomId || saving} onClick={() => onAssignRoom(debate.id, roomId)} className="ax-ghost-btn min-h-12 shrink-0">
                    {saving ? "…" : "Assign"}
                </button>
            </div>
        </li>
    );
}
