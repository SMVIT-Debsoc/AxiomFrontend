import {useState} from "react";
import {useDirtyGuard} from "../../../../hooks/useDirtyGuard";
import {SideSheet} from "../ui";

/** Motion editor. Closes only when the save succeeded. */
export default function MotionPanel({round, busy, onSave, onClose}) {
    const [draft, setDraft] = useState(round.motion || "");
    const dirty = draft.trim() !== (round.motion || "").trim();
    const confirmDiscard = useDirtyGuard(dirty, "Discard your motion edit?");
    const save = async () => {
        if (!draft.trim()) return;
        if (await onSave(draft.trim())) onClose();
    };
    return (
        <SideSheet
            title="Motion"
            subtitle={round.name || `Round ${round.roundNumber}`}
            onClose={() => { if (confirmDiscard()) onClose(); }}
            footer={(
                <button type="button" onClick={save} disabled={!dirty || !draft.trim() || busy} className="ax-primary-btn w-full">
                    {busy ? "Saving…" : "Save motion"}
                </button>
            )}
        >
            <label htmlFor="motion-text" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">Motion</label>
            <textarea
                id="motion-text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }}
                rows={4}
                placeholder="This House would…"
                className="w-full rounded-lg border border-input bg-background p-3 text-base font-medium sm:text-sm"
            />
            <p className="m-0 mt-1.5 text-xs text-muted-foreground">⌘/Ctrl + Enter saves. Debaters see the motion with the draw.</p>
        </SideSheet>
    );
}
