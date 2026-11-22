import {memo, useMemo} from "react";
import {Flag} from "lucide-react";
import SoftLockBadge from "../../../components/ops/SoftLockBadge";
import {othersFocusedOn} from "../../../hooks/usePresence";
import {cn} from "../../../lib/utils";
import {
    debateState, firstName, flagsOf, flagLabel, fullName, judgeOf, roomNameOf, STATE_LABELS,
} from "../../../lib/liveStations";
import {StateDot} from "./ui";
import DebateTime from "./DebateTime";

const NO_ADMINS = [];

function useTileRows(debates, round, nowMs, admins) {
    return useMemo(() => debates.map((d) => {
        const lock = othersFocusedOn(admins, "debate", d.id);
        return {debate: d, state: debateState(d, round, nowMs), flags: flagsOf(d), lockAdmins: lock.length ? lock : NO_ADMINS};
    }), [debates, round, nowMs, admins]);
}

/**
 * Departures board: one tile per debate. Tiles are memoized and use
 * content-visibility so 100+ rooms stay cheap to render and scroll.
 */
export function RoomGrid({debates, round, nowMs, admins, highlightId, onOpen}) {
    const rows = useTileRows(debates, round, nowMs, admins);
    if (!rows.length) return <p className="m-0 py-6 text-center text-sm text-muted-foreground">No debates match.</p>;
    return (
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Rooms">
            {rows.map((r) => (
                <RoomTile
                    key={r.debate.id}
                    debate={r.debate}
                    state={r.state}
                    flags={r.flags}
                    lockAdmins={r.lockAdmins}
                    highlighted={highlightId === r.debate.id}
                    onOpen={onOpen}
                />
            ))}
        </ul>
    );
}

const RoomTile = memo(function RoomTile({debate, state, flags, lockAdmins, highlighted, onOpen}) {
    const judge = judgeOf(debate);
    const room = roomNameOf(debate);
    return (
        <li data-debate-id={debate.id} style={{contentVisibility: "auto", containIntrinsicSize: "auto 124px"}}>
            <button
                type="button"
                onClick={() => onOpen(debate.id)}
                aria-label={`${room || "No room"}: ${fullName(debate.debater1)} vs ${fullName(debate.debater2)}, ${STATE_LABELS[state]}`}
                className={cn(
                    "flex min-h-[96px] w-full flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    `ax-state-${state}`,
                    highlighted && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
            >
                <span className="flex w-full items-center justify-between gap-1.5">
                    <span className="truncate font-heading text-sm font-bold">{room || "No room"}</span>
                    <span className="flex shrink-0 items-center gap-1">
                        {flags.length > 0 && <Flag size={13} aria-label={flags.map(flagLabel).join(", ")} className="text-[var(--ax-state)]" />}
                        <StateDot state={state} />
                    </span>
                </span>
                <span className="truncate text-xs font-semibold">
                    {firstName(debate.debater1)} <span className="text-muted-foreground">v</span> {firstName(debate.debater2)}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{judge || "No judge"}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                    <DebateTime startTime={debate.startTime} endTime={debate.endTime} />
                </span>
                <span className="mt-auto flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{STATE_LABELS[state]}</span>
                    {debate.status === "COMPLETED" && (
                        <span className="font-mono text-[11px] tabular-nums">{debate.debater1Score ?? "–"}–{debate.debater2Score ?? "–"}</span>
                    )}
                </span>
                {lockAdmins.length > 0 && <SoftLockBadge admins={lockAdmins} kind="debate" id={debate.id} />}
            </button>
        </li>
    );
});

/** Table view (sortable from the toolbar) with a phone card layout. */
export function RoomTable({debates, round, nowMs, admins, highlightId, onOpen}) {
    const rows = useTileRows(debates, round, nowMs, admins);
    if (!rows.length) return <p className="m-0 py-6 text-center text-sm text-muted-foreground">No debates match.</p>;
    return (
        <>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
                {rows.map(({debate: d, state, flags}) => (
                    <li key={d.id} data-debate-id={d.id}>
                        <button
                            type="button"
                            onClick={() => onOpen(d.id)}
                            className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left", `ax-state-${state}`, highlightId === d.id && "ring-2 ring-ring")}
                        >
                            <StateDot state={state} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-heading text-sm font-bold">{roomNameOf(d) || "No room"}</span>
                                <span className="block truncate text-xs">{fullName(d.debater1)} vs {fullName(d.debater2)}</span>
                                <span className="block text-[11px] tabular-nums text-muted-foreground">
                                    <DebateTime startTime={d.startTime} endTime={d.endTime} />
                                </span>
                                {flags.length > 0 && <span className="block truncate text-[11px] font-semibold">{flags.map(flagLabel).join(" · ")}</span>}
                            </span>
                            <span className="shrink-0 text-[11px] font-bold uppercase text-muted-foreground">{STATE_LABELS[state]}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                            <th scope="col" className="py-2 pr-3">Room</th>
                            <th scope="col" className="py-2 pr-3">GOV</th>
                            <th scope="col" className="py-2 pr-3">OPP</th>
                            <th scope="col" className="py-2 pr-3">Judge</th>
                            <th scope="col" className="py-2 pr-3">Time (IST)</th>
                            <th scope="col" className="py-2 pr-3">State</th>
                            <th scope="col" className="py-2 pr-3">Flags</th>
                            <th scope="col" className="py-2 text-right">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({debate: d, state, flags, lockAdmins}) => (
                            <tr
                                key={d.id}
                                data-debate-id={d.id}
                                onClick={() => onOpen(d.id)}
                                className={cn("cursor-pointer border-b border-border/40 hover:bg-muted/40", highlightId === d.id && "bg-muted")}
                            >
                                <td className="py-2 pr-3 font-heading font-bold">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(d.id); }} className="min-h-9 text-left hover:underline">
                                        {roomNameOf(d) || "No room"}
                                    </button>
                                    {lockAdmins.length > 0 && <SoftLockBadge admins={lockAdmins} kind="debate" id={d.id} />}
                                </td>
                                <td className="py-2 pr-3 font-semibold">{fullName(d.debater1)}</td>
                                <td className="py-2 pr-3 font-semibold">{fullName(d.debater2)}</td>
                                <td className="py-2 pr-3 text-muted-foreground">{judgeOf(d) || "—"}</td>
                                <td className="py-2 pr-3 tabular-nums">
                                    <DebateTime startTime={d.startTime} endTime={d.endTime} />
                                </td>
                                <td className="py-2 pr-3">
                                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold", `ax-state-${state}`)}>
                                        <StateDot state={state} />{STATE_LABELS[state]}
                                    </span>
                                </td>
                                <td className="py-2 pr-3">{flags.length ? flags.map(flagLabel).join(", ") : "—"}</td>
                                <td className="py-2 text-right font-mono tabular-nums">
                                    {d.status === "COMPLETED" ? `${d.debater1Score ?? "–"}–${d.debater2Score ?? "–"}` : "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
