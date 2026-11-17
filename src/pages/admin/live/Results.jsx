import {memo, useMemo, useState} from "react";
import {Copy, Keyboard, QrCode as QrIcon} from "lucide-react";
import QrCode from "../../../components/ops/QrCode";
import SoftLockBadge from "../../../components/ops/SoftLockBadge";
import {othersFocusedOn} from "../../../hooks/usePresence";
import {useToast} from "../../../hooks/useToast";
import {cn} from "../../../lib/utils";
import {
    ballotAgeMinutes, flaggedBallots, flagLabel, flagsOf, fullName, judgeOf, missingBallots, naturalCompare, roomNameOf,
} from "../../../lib/liveStations";
import {copyText, useBallotLinks} from "./ballotLinks";
import PaperEntryBar from "./results/PaperEntryBar";
import {SideSheet} from "./ui";

const NO_ADMINS = [];

/**
 * Results: missing-ballot chasing, flagged-ballot review, paper entry.
 * Live via useRoundLive (debate:result + ballot:submitted).
 */
export default function Results({live, nowMs, admins, onOpenBallot}) {
    const {round, debates} = live;
    const toast = useToast();
    const links = useBallotLinks(round.id, {auto: true});
    const [paperMode, setPaperMode] = useState(false);
    const [dismissed, setDismissed] = useState(() => new Set());
    const [qrFor, setQrFor] = useState(null);

    const missing = useMemo(() => missingBallots(debates, round), [debates, round]);
    const flagged = useMemo(() => flaggedBallots(debates).filter((d) => !dismissed.has(`${d.id}:${d.updatedAt || ""}`)), [debates, dismissed]);
    const done = useMemo(
        () => debates.filter((d) => d.status === "COMPLETED").sort((a, b) => naturalCompare(roomNameOf(a), roomNameOf(b))),
        [debates],
    );

    const copy = async (debateId) => {
        const l = links.byDebate.get(debateId);
        if (!l) { toast.error("No ballot link", links.error || "Ballot links are not available."); return; }
        if (await copyText(l.url)) toast.success("Link copied", l.roomName || "Ballot link");
        else toast.error("Could not copy", l.url);
    };
    const lockOf = (id) => {
        const l = othersFocusedOn(admins, "debate", id);
        return l.length ? l : NO_ADMINS;
    };
    const qrLink = qrFor ? links.byDebate.get(qrFor) : null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 flex-1 text-sm tabular-nums">
                    <b className="font-display text-2xl">{done.length}/{debates.length}</b> ballots in · {missing.length} missing · {flagged.length} flagged
                </p>
                <button type="button" onClick={() => setPaperMode((v) => !v)} aria-pressed={paperMode} className="ax-ghost-btn min-h-11">
                    <Keyboard size={16} aria-hidden="true" /> {paperMode ? "Close paper entry" : "Paper entry"}
                </button>
            </div>

            {paperMode && (
                <PaperEntryBar debates={debates} round={round} onSaved={live.applyResultSaved} onReplaced={live.ballotReplaced} onOpenSheet={onOpenBallot} />
            )}

            <Section title="Missing ballots" count={missing.length} empty="Every ballot is in.">
                {missing.map((d) => (
                    <MissingRow
                        key={d.id}
                        debate={d}
                        age={ballotAgeMinutes(d, round, nowMs)}
                        hasLink={links.byDebate.has(d.id)}
                        lockAdmins={lockOf(d.id)}
                        onQr={setQrFor}
                        onCopy={copy}
                        onEnter={onOpenBallot}
                    />
                ))}
            </Section>

            <Section title="Flagged" count={flagged.length} empty="Nothing flagged.">
                {flagged.map((d) => (
                    <li key={d.id} className="ax-state-flag rounded-xl border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="m-0 truncate font-heading font-bold">{roomNameOf(d) || "No room"} <span className="font-mono text-sm tabular-nums">{d.debater1Score ?? "–"}–{d.debater2Score ?? "–"}</span></p>
                                <p className="m-0 truncate text-xs">{fullName(d.debater1)} vs {fullName(d.debater2)}{judgeOf(d) ? ` · ${judgeOf(d)}` : ""}</p>
                            </div>
                            <SoftLockBadge admins={lockOf(d.id)} kind="debate" id={d.id} />
                        </div>
                        <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                            {flagsOf(d).map((f) => <li key={f} className="rounded-full border border-current/30 bg-card px-2.5 py-0.5 text-[11px] font-semibold">{flagLabel(f)}</li>)}
                        </ul>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
                            <button type="button" onClick={() => onOpenBallot(d.id)} className="ax-ghost-btn min-h-12 bg-card">Review</button>
                            <button
                                type="button"
                                onClick={() => setDismissed((prev) => new Set(prev).add(`${d.id}:${d.updatedAt || ""}`))}
                                className="ax-ghost-btn min-h-12 bg-card"
                            >
                                Looks fine
                            </button>
                        </div>
                    </li>
                ))}
            </Section>

            <Section title="Done" count={done.length} empty="No ballots yet." collapsible>
                {done.map((d) => {
                    const w1 = d.winnerId === d.debater1Id;
                    return (
                        <li key={d.id} className="ax-state-done flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-xs">
                            <span className="w-20 shrink-0 truncate font-heading text-sm font-bold">{roomNameOf(d) || "No room"}</span>
                            <span className="min-w-0 flex-1 truncate">
                                <span className={cn(w1 && "font-bold")}>{fullName(d.debater1)} {d.debater1Score ?? "–"}</span>
                                {" vs "}
                                <span className={cn(!w1 && d.winnerId && "font-bold")}>{fullName(d.debater2)} {d.debater2Score ?? "–"}</span>
                            </span>
                            {String(d.resultSource || "").toUpperCase() === "EBALLOT" && <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">E-ballot</span>}
                            <button type="button" onClick={() => onOpenBallot(d.id)} className="min-h-11 shrink-0 px-2 font-semibold text-primary underline">Edit</button>
                        </li>
                    );
                })}
            </Section>

            {qrFor && (
                <SideSheet title={`Ballot · ${qrLink?.roomName || "room"}`} subtitle="The judge scans this to submit the e-ballot." onClose={() => setQrFor(null)}>
                    {qrLink ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="rounded-2xl bg-white p-3"><QrCode value={qrLink.url} size={260} label="Scan to submit the ballot" /></div>
                            <p className="m-0 break-all text-center font-mono text-xs text-muted-foreground">{qrLink.url}</p>
                            <button type="button" onClick={() => copy(qrFor)} className="ax-ghost-btn min-h-12 w-full"><Copy size={16} aria-hidden="true" /> Copy link</button>
                        </div>
                    ) : (
                        <p className="m-0 text-sm text-muted-foreground">No ballot link for this debate.</p>
                    )}
                </SideSheet>
            )}
        </div>
    );
}

function Section({title, count, empty, collapsible = false, children}) {
    const [open, setOpen] = useState(!collapsible);
    return (
        <section aria-label={title} className="space-y-2">
            <h2 className="m-0 flex items-center gap-2 font-heading text-base font-bold">
                {collapsible ? (
                    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 text-left">
                        {title} <span className="tabular-nums text-muted-foreground">({count})</span> <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                    </button>
                ) : (
                    <>{title} <span className="tabular-nums text-muted-foreground">({count})</span></>
                )}
            </h2>
            {open && (count === 0 ? <p className="m-0 text-sm text-muted-foreground">{empty}</p> : <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>)}
        </section>
    );
}

const MissingRow = memo(function MissingRow({debate: d, age, hasLink, lockAdmins, onQr, onCopy, onEnter}) {
    return (
        <li className={cn("rounded-xl border p-3", age >= 20 ? "ax-state-flag" : "ax-state-live")}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-heading font-bold">
                        {roomNameOf(d) || "No room"}
                        {age > 0 && <span className="ml-2 font-mono text-xs font-normal tabular-nums">{age}m</span>}
                    </p>
                    <p className="m-0 truncate text-xs">{fullName(d.debater1)} vs {fullName(d.debater2)}</p>
                    <p className="m-0 truncate text-xs text-muted-foreground">{judgeOf(d) || "No judge"}</p>
                </div>
                {lockAdmins.length > 0 && <SoftLockBadge admins={lockAdmins} kind="debate" id={d.id} />}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:flex">
                <button type="button" onClick={() => onQr(d.id)} disabled={!hasLink} className="ax-ghost-btn min-h-12 bg-card !px-2 !text-xs"><QrIcon size={14} aria-hidden="true" /> QR</button>
                <button type="button" onClick={() => onCopy(d.id)} disabled={!hasLink} className="ax-ghost-btn min-h-12 bg-card !px-2 !text-xs"><Copy size={14} aria-hidden="true" /> Link</button>
                <button type="button" onClick={() => onEnter(d.id)} className="ax-ghost-btn min-h-12 bg-card !px-2 !text-xs">Paper ballot</button>
            </div>
        </li>
    );
});
