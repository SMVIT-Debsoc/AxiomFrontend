import {useState} from "react";
import {DoorOpen} from "lucide-react";
import {fullName, judgeOf, roomNameOf} from "../../../../lib/liveStations";
import {SideSheet} from "../ui";

/** Rooms: allocate / finish allocation, add a room, assign judges inline. */
export default function RoomsPanel({debates, rooms, savingDebateId, onAllocate, onAddRoom, onAssignJudge, onOpenDebate, onClose}) {
    const [drafts, setDrafts] = useState({});
    const withRoom = debates.filter((d) => d.roomId && d.room).length;
    const missing = debates.length - withRoom;
    const noJudge = debates.filter((d) => !judgeOf(d)).length;

    const saveJudge = async (d) => {
        const value = (drafts[d.id] ?? judgeOf(d)).trim();
        if (await onAssignJudge(d.id, value)) {
            setDrafts((prev) => {
                if (prev[d.id] === undefined || prev[d.id].trim() !== value) return prev;
                const next = {...prev};
                delete next[d.id];
                return next;
            });
        }
    };

    return (
        <SideSheet
            wide
            title="Rooms"
            subtitle={`${withRoom} of ${debates.length} debates have a room · ${rooms.length} rooms · ${noJudge} without a judge`}
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={onAddRoom} className="ax-ghost-btn min-h-11 w-full sm:w-auto">
                        <DoorOpen size={14} aria-hidden="true" /> Add room
                    </button>
                    {debates.length > 0 && missing > 0 && withRoom > 0 && (
                        <button type="button" onClick={() => onAllocate("unassigned")} className="ax-primary-btn w-full sm:w-auto">
                            Finish allocation ({missing})
                        </button>
                    )}
                    {debates.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onAllocate("all")}
                            className={withRoom === 0 ? "ax-primary-btn w-full sm:w-auto" : "ax-ghost-btn min-h-11 w-full sm:w-auto"}
                        >
                            {withRoom === 0 ? "Allocate rooms" : "Reallocate all"}
                        </button>
                    )}
                </div>
            )}
        >
            {!debates.length ? (
                <p className="m-0 text-sm text-muted-foreground">Generate the draw first.</p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {debates.map((d) => {
                        const current = judgeOf(d);
                        const draft = drafts[d.id] ?? current;
                        const dirty = draft.trim() !== current.trim();
                        return (
                            <li key={d.id} className="rounded-xl border border-border bg-card/60 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <button type="button" onClick={() => onOpenDebate(d.id)} className="min-h-11 truncate text-left font-heading font-bold text-primary hover:underline">
                                        {roomNameOf(d) || "No room"}
                                    </button>
                                    <span className="truncate text-xs font-semibold">{fullName(d.debater1)} vs {fullName(d.debater2)}</span>
                                </div>
                                <form
                                    onSubmit={(e) => { e.preventDefault(); void saveJudge(d); }}
                                    className="mt-1 flex items-center gap-1.5"
                                >
                                    <input
                                        aria-label={`Judge for ${roomNameOf(d) || "debate"}`}
                                        value={draft}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setDrafts((prev) => {
                                                const next = {...prev};
                                                if (value.trim() === current.trim()) delete next[d.id];
                                                else next[d.id] = value;
                                                return next;
                                            });
                                        }}
                                        placeholder="Judge name"
                                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base sm:text-xs"
                                    />
                                    <button type="submit" disabled={!dirty || savingDebateId === d.id} className="ax-ghost-btn min-h-11 shrink-0 !text-xs">
                                        {savingDebateId === d.id ? "…" : "Save"}
                                    </button>
                                </form>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SideSheet>
    );
}
