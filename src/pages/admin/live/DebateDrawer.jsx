import {useState} from "react";
import {Loader2} from "lucide-react";
import SoftLockBadge from "../../../components/ops/SoftLockBadge";
import {useDirtyGuard} from "../../../hooks/useDirtyGuard";
import {cn} from "../../../lib/utils";
import {debateState, flagLabel, flagsOf, fullName, judgeOf, roomNameOf, STATE_LABELS} from "../../../lib/liveStations";
import {SideSheet, StateDot} from "./ui";
import DebateTime from "./DebateTime";

/**
 * Debate drawer: judge + room edits (conflict-safe via useRoundLive) and the
 * way into the ballot sheet. Render with key={debate.id}.
 */
export default function DebateDrawer({debate, round, rooms, debates, admins, nowMs, saving, onAssignJudge, onAssignRoomJudge, onAssignRoom, onOpenBallot, onClose}) {
    const currentJudge = judgeOf(debate);
    const [judgeDraft, setJudgeDraft] = useState(null);
    const [roomDraft, setRoomDraft] = useState(null);
    const judgeValue = judgeDraft ?? currentJudge;
    const roomValue = roomDraft ?? (debate.roomId || "");
    const judgeDirty = judgeDraft !== null && judgeDraft.trim() !== currentJudge.trim();
    const roomDirty = roomDraft !== null && roomDraft !== (debate.roomId || "");
    const confirmDiscard = useDirtyGuard(judgeDirty || roomDirty, "Discard your unsaved judge/room change?");
    const state = debateState(debate, round, nowMs);
    const flags = flagsOf(debate);
    const roomUse = new Map();
    for (const d of debates) if (d.roomId && d.id !== debate.id) roomUse.set(d.roomId, (roomUse.get(d.roomId) || 0) + 1);

    const roomDebateCount = debates.filter((d) => d.roomId === debate.roomId).length;

    const close = () => { if (confirmDiscard()) onClose(); };
    const saveJudge = async (e) => {
        e.preventDefault();
        if (await onAssignJudge(debate.id, judgeValue.trim())) setJudgeDraft(null);
    };
    const saveRoomJudge = async () => {
        if (await onAssignRoomJudge(debate.roomId, judgeValue.trim())) setJudgeDraft(null);
    };
    const saveRoom = async () => {
        if (await onAssignRoom(debate.id, roomValue || null)) setRoomDraft(null);
    };

    return (
        <SideSheet
            title={roomNameOf(debate) || "No room"}
            subtitle={`${fullName(debate.debater1)} (GOV) vs ${fullName(debate.debater2)} (OPP)`}
            onClose={close}
            footer={(
                <button type="button" onClick={() => { if (confirmDiscard()) onOpenBallot(debate.id); }} className="ax-primary-btn w-full">
                    {debate.status === "COMPLETED" ? "Edit ballot" : "Enter ballot"}
                </button>
            )}
        >
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", `ax-state-${state}`)}>
                        <StateDot state={state} />{STATE_LABELS[state]}
                    </span>
                    {debate.status === "COMPLETED" && (
                        <span className="font-display text-2xl leading-none tabular-nums">{debate.debater1Score ?? "–"} – {debate.debater2Score ?? "–"}</span>
                    )}
                    <SoftLockBadge admins={admins} kind="debate" id={debate.id} />
                </div>

                {flags.length > 0 && (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Ballot flags">
                        {flags.map((f) => <li key={f} className="ax-state-flag rounded-full border px-2.5 py-1 text-xs font-semibold">{flagLabel(f)}</li>)}
                    </ul>
                )}

                <form onSubmit={saveJudge} className="space-y-1.5">
                    <label htmlFor="drawer-judge" className="block text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">Judge</label>
                    <div className="flex gap-2">
                        <input
                            id="drawer-judge"
                            value={judgeValue}
                            onChange={(e) => setJudgeDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setJudgeDraft(null); } }}
                            placeholder="Judge name"
                            maxLength={80}
                            className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base sm:text-sm"
                        />
                        <button type="submit" disabled={!judgeDirty || saving} className="ax-ghost-btn min-h-11 shrink-0">
                            {saving && judgeDirty ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Save"}
                        </button>
                    </div>
                    {debate.roomId && (
                        <button
                            type="button"
                            onClick={saveRoomJudge}
                            disabled={!judgeValue.trim() || roomDirty || saving}
                            className="ax-ghost-btn min-h-11 w-full text-xs"
                        >
                            Apply to room ({roomDebateCount} debates)
                        </button>
                    )}
                </form>

                <div className="space-y-1.5">
                    <label htmlFor="drawer-room" className="block text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">Room</label>
                    <div className="flex gap-2">
                        <select
                            id="drawer-room"
                            value={roomValue}
                            onChange={(e) => setRoomDraft(e.target.value)}
                            className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base sm:text-sm"
                        >
                            <option value="">No room</option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}{roomUse.get(r.id) ? ` (in use ×${roomUse.get(r.id)})` : ""}
                                </option>
                            ))}
                        </select>
                        <button type="button" onClick={saveRoom} disabled={!roomDirty || saving} className="ax-ghost-btn min-h-11 shrink-0">
                            {saving && roomDirty ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Move"}
                        </button>
                    </div>
                </div>

                <p className="m-0 text-xs text-muted-foreground">
                    <DebateTime startTime={debate.startTime} endTime={debate.endTime} />
                </p>
            </div>
        </SideSheet>
    );
}
