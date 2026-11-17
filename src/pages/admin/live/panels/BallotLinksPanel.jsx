import {useMemo, useState} from "react";
import {Copy, Printer, QrCode as QrIcon} from "lucide-react";
import QrCode from "../../../../components/ops/QrCode";
import LoadError from "../../../../components/ui/LoadError";
import {useToast} from "../../../../hooks/useToast";
import {naturalCompare} from "../../../../lib/liveStations";
import {copyText, printRoomCards, useBallotLinks} from "../ballotLinks";
import {SideSheet} from "../ui";

/** Per-room judge e-ballot links: QR, copy, print room cards. */
export default function BallotLinksPanel({roundId, roundLabel, onClose}) {
    const toast = useToast();
    const {links, loading, error, load} = useBallotLinks(roundId, {auto: true});
    const [shownQr, setShownQr] = useState(null);
    const sorted = useMemo(() => [...links].sort((a, b) => naturalCompare(a.roomName, b.roomName)), [links]);

    const copy = async (l) => {
        if (await copyText(l.url)) toast.success("Link copied", l.roomName || "Ballot link");
        else toast.error("Could not copy", l.url);
    };
    const print = async () => {
        if (!(await printRoomCards(sorted, {title: `${roundLabel} · room cards`}))) {
            toast.error("Pop-up blocked", "Allow pop-ups for this site to print room cards.");
        }
    };

    return (
        <SideSheet
            wide
            title="Ballot links"
            subtitle="Each judge gets a private link. E-ballots count immediately; unusual ones are flagged."
            onClose={onClose}
            footer={(
                <button type="button" onClick={print} disabled={!sorted.length} className="ax-primary-btn w-full sm:w-auto">
                    <Printer size={16} aria-hidden="true" /> Print room cards
                </button>
            )}
        >
            {error ? (
                <LoadError compact message={error} onRetry={load} busy={loading} />
            ) : loading && !links.length ? (
                <p className="m-0 text-sm text-muted-foreground">Loading ballot links…</p>
            ) : !sorted.length ? (
                <p className="m-0 text-sm text-muted-foreground">No ballot links yet. They appear once the draw exists.</p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {sorted.map((l) => (
                        <li key={l.debateId} className="rounded-xl border border-border bg-card/60 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="m-0 truncate font-heading font-bold">{l.roomName || "No room"}</p>
                                    <p className="m-0 truncate text-xs text-muted-foreground">{l.debater1Name} vs {l.debater2Name}{l.judgeName ? ` · ${l.judgeName}` : ""}</p>
                                </div>
                                <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto">
                                    <button type="button" onClick={() => setShownQr(shownQr === l.debateId ? null : l.debateId)} aria-expanded={shownQr === l.debateId} className="ax-ghost-btn min-h-11 !text-xs">
                                        <QrIcon size={14} aria-hidden="true" /> QR
                                    </button>
                                    <button type="button" onClick={() => copy(l)} className="ax-ghost-btn min-h-11 !text-xs">
                                        <Copy size={14} aria-hidden="true" /> Copy link
                                    </button>
                                </div>
                            </div>
                            {shownQr === l.debateId && (
                                <div className="mt-3 flex flex-col items-center gap-1">
                                    <QrCode value={l.url} size={220} label={`Ballot · ${l.roomName || "room"}`} />
                                    <p className="m-0 break-all text-center font-mono text-[11px] text-muted-foreground">{l.url}</p>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SideSheet>
    );
}
