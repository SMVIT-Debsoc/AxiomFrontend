import {Loader2} from "lucide-react";
import {fullName, roomNameOf} from "../../../../lib/liveStations";
import {SideSheet} from "../ui";

function Unallocated() {
    return <span className="ax-state-waiting inline-block rounded border px-2 py-0.5 text-[10px] font-semibold">No room</span>;
}

/** Draw: preview / generate / regenerate (confirmations + PAIRINGS_PUBLISHED live in useRoundLive). */
export default function DrawPanel({round, debates, busy, presentCount, onPreview, onGenerate, onClose}) {
    const hasDebates = debates.length > 0;
    const isRound1 = round.roundNumber === 1;
    return (
        <SideSheet
            wide
            title={`Draw · ${isRound1 ? "random" : "power-matched"}`}
            subtitle={hasDebates ? `${debates.length} debates` : `${presentCount} debaters checked in`}
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={onPreview} disabled={busy === "preview"} className="ax-ghost-btn min-h-11 w-full sm:w-auto">
                        {busy === "preview" ? "Previewing…" : "Preview draw"}
                    </button>
                    {hasDebates ? (
                        <button type="button" onClick={onGenerate} disabled={busy === "generating"} className="ax-ghost-btn min-h-11 w-full sm:w-auto">
                            {busy === "generating" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                            Regenerate draw
                        </button>
                    ) : (
                        <button type="button" onClick={onGenerate} disabled={busy === "generating" || presentCount === 0} className="ax-primary-btn w-full sm:w-auto">
                            {busy === "generating" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                            Close check-in &amp; draw
                        </button>
                    )}
                </div>
            )}
        >
            {!hasDebates ? (
                <p className="m-0 text-sm text-muted-foreground">No draw yet. Preview it, or close check-in to generate it. Odd numbers are filled by a Swing.</p>
            ) : (
                <>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 max-h-[460px] overflow-y-auto md:hidden">
                        {debates.map((d, i) => (
                            <li key={d.id} className="space-y-2 rounded-xl border border-border bg-card/60 p-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-muted-foreground">#{i + 1}</span>
                                    {roomNameOf(d) ? <span className="font-heading font-bold text-primary">{roomNameOf(d)}</span> : <Unallocated />}
                                </div>
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="ax-chip ax-chip--gov shrink-0 text-[10px] font-bold">GOV</span>
                                    <span className="truncate font-semibold">{fullName(d.debater1)}</span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="ax-chip ax-chip--opp shrink-0 text-[10px] font-bold">OPP</span>
                                    <span className="truncate font-semibold">{fullName(d.debater2)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-border text-xs uppercase tracking-[0.06em] text-muted-foreground">
                                    <th scope="col" className="py-2 pr-3">#</th>
                                    <th scope="col" className="py-2 pr-3">GOV</th>
                                    <th scope="col" className="py-2 pr-3">OPP</th>
                                    <th scope="col" className="py-2">Room</th>
                                </tr>
                            </thead>
                            <tbody>
                                {debates.map((d, i) => (
                                    <tr key={d.id} className="border-b border-border/40">
                                        <td className="py-2 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                                        <td className="py-2 pr-3 font-semibold">{fullName(d.debater1)}</td>
                                        <td className="py-2 pr-3 font-semibold">{fullName(d.debater2)}</td>
                                        <td className="py-2">{roomNameOf(d) || <Unallocated />}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </SideSheet>
    );
}
