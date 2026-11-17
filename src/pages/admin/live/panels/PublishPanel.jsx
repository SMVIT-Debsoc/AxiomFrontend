import {Loader2} from "lucide-react";
import {cn} from "../../../../lib/utils";
import {judgeOf} from "../../../../lib/liveStations";
import {SideSheet} from "../ui";

/** Publish checklist + publish/unpublish the draw and results. */
export default function PublishPanel({round, debates, resultsPublished, busy, onTogglePublish, onPublishResults, onOpenPanel, onClose}) {
    const published = Boolean(round.pairingsPublished);
    const withRoom = debates.filter((d) => d.roomId && d.room).length;
    const noJudge = debates.filter((d) => !judgeOf(d)).length;
    const done = debates.filter((d) => d.status === "COMPLETED").length;
    const checks = [
        {ok: Boolean(round.motion), text: round.motion ? `Motion: "${round.motion}"` : "Motion not set", fix: "motion"},
        {ok: debates.length > 0, text: `${debates.length} debate${debates.length === 1 ? "" : "s"} in the draw`, fix: "draw"},
        {ok: debates.length > 0 && withRoom === debates.length, text: `${withRoom} of ${debates.length} rooms allocated`, fix: "rooms"},
        {ok: noJudge === 0, optional: true, text: `${debates.length - noJudge} of ${debates.length} judges assigned`, fix: "rooms"},
    ];
    const allBallots = debates.length > 0 && done === debates.length;
    return (
        <SideSheet
            title={published ? "The draw is live" : "Publish the draw"}
            subtitle="Debaters get their room, side and opponent instantly."
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        onClick={onTogglePublish}
                        disabled={busy === "publishing" || (!published && !debates.length)}
                        className={published ? "ax-ghost-btn min-h-11 w-full sm:w-auto" : "ax-primary-btn w-full sm:w-auto"}
                    >
                        {busy === "publishing" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                        {published ? "Unpublish draw" : "Publish draw"}
                    </button>
                    {published && (
                        <button
                            type="button"
                            onClick={onPublishResults}
                            disabled={busy === "results"}
                            className={allBallots && !resultsPublished ? "ax-primary-btn w-full sm:w-auto" : "ax-ghost-btn min-h-11 w-full sm:w-auto"}
                        >
                            {resultsPublished ? "Hide results" : `Publish results (${done}/${debates.length})`}
                        </button>
                    )}
                </div>
            )}
        >
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {checks.map((c) => (
                    <li key={c.text} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2 text-sm font-semibold", c.ok ? "ax-state-done" : c.optional ? "ax-state-waiting" : "ax-state-flag")}>
                        <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/10 text-xs font-bold">{c.ok ? "✓" : "!"}</span>
                        <span className="min-w-0 flex-1 truncate">{c.text}{!c.ok && c.optional ? " (optional)" : ""}</span>
                        {!c.ok && (
                            <button type="button" onClick={() => onOpenPanel(c.fix)} className="min-h-11 shrink-0 px-2 text-xs font-bold text-primary underline underline-offset-2">
                                Fix
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </SideSheet>
    );
}
