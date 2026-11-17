import {Loader2} from "lucide-react";
import {cn} from "../../../lib/utils";
import {PIPELINE} from "../../../lib/roundNextStep";

/** Pipeline strip + the one primary action. Steps open their panel. */
export function RoundStatusStrip({step, next, onStep, compact = false}) {
    return (
        <section aria-label="Round status" className={cn("ax-card flex flex-col gap-3 p-3 lg:flex-row lg:items-center", compact && "p-2.5")}>
            <ol aria-label="Round steps" className="m-0 grid min-w-0 flex-1 list-none grid-cols-6 gap-1 p-0">
                {PIPELINE.map((label, i) => (
                    <li key={label} className="min-w-0">
                        <button
                            type="button"
                            onClick={() => onStep(i)}
                            aria-current={i === step ? "step" : undefined}
                            className={cn(
                                "flex min-h-11 w-full flex-col items-start justify-center rounded-lg border px-1.5 text-left transition-colors sm:px-2.5",
                                i === step
                                    ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#3A3E34]"
                                    : i < step ? "border-transparent bg-muted text-foreground" : "border-border bg-card text-muted-foreground",
                            )}
                        >
                            <span className="hidden text-[10px] font-bold uppercase tracking-[0.06em] opacity-75 sm:block">0{i + 1}{i < step ? " · done" : i === step ? " · now" : ""}</span>
                            <span className="w-full truncate text-[11px] font-bold sm:text-xs">{label}</span>
                        </button>
                    </li>
                ))}
            </ol>
            <div className="flex min-w-0 items-center gap-3 lg:w-[360px] lg:shrink-0">
                <div className="min-w-0 flex-1">
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Do this next</p>
                    <p className="m-0 truncate font-heading text-base font-bold" title={next.body}>{next.title}</p>
                </div>
                <button type="button" onClick={next.run} disabled={next.working || next.disabled} className="ax-primary-btn shrink-0 !min-h-11 !px-4 !text-sm">
                    {next.working && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    {next.cta}
                </button>
            </div>
        </section>
    );
}
