import {useRef, useState} from "react";
import {Loader2} from "lucide-react";
import {useBallotSave} from "../../../../hooks/useBallotSave";
import {useDirtyGuard} from "../../../../hooks/useDirtyGuard";
import BallotRecovery from "../../../../components/admin/BallotRecovery";
import {cn} from "../../../../lib/utils";
import {findDebateByRoom, fullName, roomNameOf} from "../../../../lib/liveStations";
import {nextMissingDebate, parseWinnerKey, pushRecent, resolvePaperEntry} from "../../../../lib/paperEntry";

/**
 * Keyboard paper-ballot entry: Room → Tab → GOV → Tab → OPP → Enter.
 * Higher score wins; a tie needs W then 1/2. Saves through useBallotSave
 * (expectedUpdatedAt + BALLOT_CONFLICT / DEBATE_REPLACED recovery), then jumps
 * to the next missing room. Esc clears.
 */
export default function PaperEntryBar({debates, round, onSaved, onReplaced, onOpenSheet}) {
    const [room, setRoom] = useState("");
    const [gov, setGov] = useState("");
    const [opp, setOpp] = useState("");
    const [winnerMode, setWinnerMode] = useState(false);
    const [error, setError] = useState(null);
    const [recent, setRecent] = useState([]);
    const pending = useRef(null);
    const roomRef = useRef(null);
    const govRef = useRef(null);
    const dirty = Boolean(room || gov || opp);
    useDirtyGuard(dirty && Boolean(gov || opp), "Discard the paper ballot you are typing?");

    const match = findDebateByRoom(debates, room);
    const {save, verify, busy, recovery, saveError, clearSaveError, clearRecovery} = useBallotSave((ballot, saved) => {
        onSaved(ballot, saved);
        const entry = pending.current;
        if (entry) setRecent((list) => pushRecent(list, entry));
        pending.current = null;
        const next = nextMissingDebate(debates, round, ballot.debateId);
        setRoom(next ? roomNameOf(next) : "");
        setGov("");
        setOpp("");
        setWinnerMode(false);
        setError(null);
        window.setTimeout(() => (next ? govRef.current : roomRef.current)?.focus(), 0);
    }, {onReplaced});

    const reset = () => {
        setRoom(""); setGov(""); setOpp(""); setWinnerMode(false); setError(null);
        clearSaveError(); clearRecovery();
        roomRef.current?.focus();
    };

    const submit = async (winnerChoice = null, overrideUpdatedAt) => {
        if (busy) return;
        clearSaveError();
        const r = resolvePaperEntry({debates, roomText: room, gov, opp, winnerChoice});
        if (!r.ok) {
            setError(r.error);
            if (r.needsWinner) setWinnerMode(true);
            return;
        }
        setError(null);
        setWinnerMode(false);
        const d = r.debate;
        pending.current = {
            debateId: d.id, roomName: roomNameOf(d), gov: String(r.debater1Score), opp: String(r.debater2Score),
            winner: r.winnerId === d.debater1Id ? "GOV" : "OPP", label: `${fullName(d.debater1)} vs ${fullName(d.debater2)}`,
        };
        const expectedUpdatedAt = overrideUpdatedAt || d.updatedAt;
        await save({
            debateId: d.id,
            debater1Score: r.debater1Score,
            debater2Score: r.debater2Score,
            winnerId: r.winnerId,
            ...(expectedUpdatedAt ? {expectedUpdatedAt} : {}),
        });
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); reset(); return; }
        if (winnerMode) {
            const choice = parseWinnerKey(e.key);
            if (choice) { e.preventDefault(); void submit(choice); return; }
        }
        if ((e.key === "w" || e.key === "W") && e.target !== roomRef.current) {
            e.preventDefault();
            setWinnerMode(true);
            setError("Winner: press 1 for GOV or 2 for OPP");
            return;
        }
        if (e.key === "Enter") { e.preventDefault(); void submit(); }
    };

    const editRecent = (entry) => {
        setRoom(entry.roomName); setGov(entry.gov); setOpp(entry.opp); setError(null);
        govRef.current?.focus();
    };

    const field = "min-h-12 rounded-xl border-[1.5px] border-input bg-background px-3 text-base font-semibold tabular-nums";
    return (
        <section aria-label="Paper ballot entry" className="ax-card space-y-3 p-3" onKeyDown={onKeyDown}>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,2fr)_7rem_7rem_auto]">
                <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Room</span>
                    <input ref={roomRef} value={room} onChange={(e) => { setRoom(e.target.value); setError(null); }} autoFocus autoComplete="off" placeholder="12" className={cn(field, "w-full")} />
                </label>
                <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">GOV</span>
                    <input ref={govRef} value={gov} onChange={(e) => setGov(e.target.value)} inputMode="decimal" autoComplete="off" className={cn(field, "w-full")} />
                </label>
                <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">OPP</span>
                    <input value={opp} onChange={(e) => setOpp(e.target.value)} inputMode="decimal" autoComplete="off" className={cn(field, "w-full")} />
                </label>
                <button type="button" onClick={() => submit()} disabled={Boolean(busy)} className="ax-primary-btn col-span-3 sm:col-span-1 sm:self-end">
                    {busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Save ↵
                </button>
            </div>
            <p className="m-0 min-h-5 text-xs" aria-live="polite">
                {match ? (
                    <span><b>{roomNameOf(match)}</b> · {fullName(match.debater1)} (GOV) vs {fullName(match.debater2)} (OPP){match.status === "COMPLETED" ? " · already has a ballot (this overwrites it)" : ""}</span>
                ) : room ? <span className="text-muted-foreground">No single room matches yet</span> : <span className="text-muted-foreground">Tab between fields · Enter saves · Esc clears · W then 1/2 on a tie</span>}
            </p>
            {winnerMode && (
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pick the winner">
                    <button type="button" onClick={() => submit(1)} className="ax-ghost-btn min-h-12">1 · GOV wins</button>
                    <button type="button" onClick={() => submit(2)} className="ax-ghost-btn min-h-12">2 · OPP wins</button>
                </div>
            )}
            {(error || saveError) && <p role="alert" className="ax-state-flag m-0 rounded-lg border px-3 py-2 text-xs font-semibold">{saveError || error}</p>}
            <BallotRecovery
                recovery={recovery}
                busy={busy}
                onVerify={verify}
                onLoadSaved={() => { clearRecovery(); reset(); }}
                onOverwrite={(saved) => { clearRecovery(); void submit(null, saved?.updatedAt); }}
            />
            {recent.length > 0 && (
                <div>
                    <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Last entries</p>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {recent.map((e) => (
                            <li key={e.debateId} className="flex min-h-11 items-center gap-2 rounded-lg bg-muted/50 px-2.5 text-xs">
                                <span className="w-20 shrink-0 truncate font-heading font-bold">{e.roomName}</span>
                                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                                <span className="shrink-0 font-mono tabular-nums">{e.gov}–{e.opp} {e.winner}</span>
                                <button type="button" onClick={() => editRecent(e)} className="min-h-11 shrink-0 px-2 font-semibold text-primary underline">Undo / edit</button>
                                <button type="button" onClick={() => onOpenSheet(e.debateId)} className="min-h-11 shrink-0 px-2 font-semibold text-primary underline">Sheet</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
