import {Plus} from "lucide-react";
import PresenceBar from "../../../components/ops/PresenceBar";
import {cn} from "../../../lib/utils";
import {STATION_LABELS, STATIONS} from "../../../lib/liveStations";
import {Segmented} from "./ui";

const roundWord = (status) => ({ONGOING: "live", COMPLETED: "done"}[String(status).toUpperCase()] || "upcoming");

/** Event / round context, round tabs, station switcher and presence. */
export default function LiveHeader({events, event, eventId, setEventId, rounds, round, roundId, setRoundId, station, setStation, admins, me, statusBusy, onStatus, onAddRound}) {
    return (
        <header className="space-y-3 border-b border-border/80 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {events?.length > 1 ? (
                        <select
                            aria-label="Select tournament"
                            value={eventId || ""}
                            onChange={(e) => setEventId(e.target.value)}
                            className="h-11 max-w-[70vw] rounded-lg border border-border bg-card px-2.5 text-base font-semibold sm:text-xs"
                        >
                            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>)}
                        </select>
                    ) : (
                        <span className="truncate text-xs font-bold">{event.name}</span>
                    )}
                    <PresenceBar admins={admins} me={me} />
                </div>
                <Segmented
                    label="Station"
                    value={station}
                    onChange={setStation}
                    className="w-full sm:w-auto"
                    options={STATIONS.map((s) => ({value: s, label: STATION_LABELS[s]}))}
                />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-2">
                <h1 className="m-0 font-display text-[34px] font-normal leading-none text-primary md:text-[44px]">
                    {round.name || `Round ${round.roundNumber}`} — {roundWord(round.status)}
                </h1>
                <div className="grid grid-cols-3 gap-1.5 sm:flex" role="group" aria-label="Round status">
                    {["UPCOMING", "ONGOING", "COMPLETED"].map((s) => {
                        const active = String(round.status).toUpperCase() === s;
                        return (
                            <button
                                key={s}
                                type="button"
                                disabled={statusBusy}
                                aria-pressed={active}
                                onClick={() => onStatus(s)}
                                className={cn(
                                    "min-h-11 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wider",
                                    active ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#B9F5D8] dark:text-[#141510]" : "border-border bg-card text-muted-foreground hover:bg-muted",
                                )}
                            >
                                {s}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div role="tablist" aria-label="Rounds" className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                {rounds.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        role="tab"
                        aria-selected={r.id === roundId}
                        onClick={() => setRoundId(r.id)}
                        className={cn(
                            "min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold sm:text-sm",
                            r.id === roundId
                                ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#B9F5D8] dark:text-[#141510]"
                                : "border-input bg-card hover:bg-muted",
                        )}
                    >
                        Round {r.roundNumber} · {roundWord(r.status)}
                    </button>
                ))}
                <button type="button" onClick={onAddRound} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/50 px-4 text-xs font-bold text-primary hover:bg-primary/10 sm:text-sm">
                    <Plus size={14} aria-hidden="true" /> Add round
                </button>
            </div>
        </header>
    );
}
