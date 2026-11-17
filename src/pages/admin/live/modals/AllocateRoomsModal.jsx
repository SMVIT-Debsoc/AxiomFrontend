import {useState} from "react";
import ModalSurface from "../../../../components/ui/ModalSurface";
import {motion as Motion} from "framer-motion";
import {Loader2, Clock, Check, X} from "lucide-react";
import {cn} from "../../../../lib/utils";
import {useToast} from "../../../../hooks/useToast";
import {toLocalDateTime} from "../../../../lib/datetime";

export default function AllocateRoomsModal({
    onClose,
    onConfirm,
    totalDebates,
    rooms,
    loading,
}) {
    const toast = useToast();
    const [selectedRoomIds, setSelectedRoomIds] = useState(
        rooms.map((r) => r.id)
    );
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        startTime: toLocalDateTime(Date.now()),
        speakingTime: 7,
        bufferTime: 11,
        gap: 5,
    });

    const speaking = Number(formData.speakingTime);
    const minBufferNeeded = Math.max(0, 25 - speaking * 2);
    const effectiveBuffer = Math.max(Number(formData.bufferTime), minBufferNeeded);
    const debateDuration = Math.max(25, speaking * 2 + effectiveBuffer);
    const totalInterval = debateDuration + Number(formData.gap);
    const activeRoomsCount = selectedRoomIds.length || 1;
    const debatesPerRoom = Math.ceil(totalDebates / activeRoomsCount) || 0;
    const totalTimeNeeded = debatesPerRoom * totalInterval;

    const toggleRoom = (id) => {
        setSelectedRoomIds((prev) =>
            prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || localSubmitting) return;

        if (selectedRoomIds.length === 0) {
            toast.error("Selection Required", "Please select at least one room.");
            return;
        }
        setLocalSubmitting(true);
        try {
            await onConfirm({
                ...formData,
                speakingTime: speaking,
                bufferTime: effectiveBuffer,
                gap: Number(formData.gap),
                roomIds: selectedRoomIds,
                startTime: new Date(formData.startTime).toISOString(),
            });
        } finally {
            if (document.body.contains(e.target)) {
                setLocalSubmitting(false);
            }
        }
    };

    // Generate preview slots
    const previewSlots = [];
    const baseTime = new Date(formData.startTime).getTime();
    for (let i = 0; i < Math.min(debatesPerRoom, 3); i++) {
        const start = new Date(baseTime + i * totalInterval * 60000);
        const end = new Date(start.getTime() + debateDuration * 60000);
        previewSlots.push({ start, end });
    }

    return (
        <ModalSurface onDismiss={onClose}
            aria-label="Schedule and Room Allocation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-border/80 rounded-xl p-6 md:p-8 w-full max-w-2xl shadow-xl my-6"
            >
                <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
                    <div>
                        <h2 className="text-xl font-heading font-bold text-foreground">
                            Schedule & Room Allocation
                        </h2>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                            Distribute and time-slot {totalDebates} debates across rooms
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans text-sm"
                >
                    {/* Left Column: Configuration */}
                    <div className="space-y-5">
                        <div className="space-y-3.5">
                            <div>
                                <label htmlFor="allocation-start" className="text-xs font-semibold text-foreground mb-1 block">
                                    Round Start Time (local time)
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        id="allocation-start"
                                        type="datetime-local"
                                        required
                                        value={formData.startTime}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                startTime: e.target.value,
                                            })
                                        }
                                        className="w-full min-h-11 pl-9 pr-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label htmlFor="allocation-speaking" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                                        Speaking Time (Per Debater)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-speaking"
                                            aria-valuetext={`${speaking} minutes per debater`}
                                            type="range"
                                            min="1"
                                            max="15"
                                            value={speaking}
                                            onChange={(e) => {
                                                const nextSpeaking = Number(e.target.value);
                                                const nextMinBuffer = Math.max(0, 25 - nextSpeaking * 2);
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    speakingTime: nextSpeaking,
                                                    bufferTime: Math.max(Number(prev.bufferTime), nextMinBuffer),
                                                }));
                                            }}
                                            className="flex-1 accent-primary"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
                                            {speaking}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label htmlFor="allocation-buffer" className="text-[11px] font-semibold text-muted-foreground">
                                            Prep, POIs &amp; Adjudication Buffer
                                        </label>
                                        <span className="ax-signal-info inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200">
                                            25m minimum enforced
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-buffer"
                                            aria-valuetext={`${effectiveBuffer} minutes`}
                                            type="range"
                                            min="0"
                                            max="25"
                                            value={effectiveBuffer}
                                            onChange={(e) => {
                                                const val = Math.max(minBufferNeeded, Number(e.target.value));
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    bufferTime: val,
                                                }));
                                            }}
                                            className="flex-1 accent-indigo-600"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
                                            {effectiveBuffer}m
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="allocation-gap" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                                        Gap Between Debates
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="allocation-gap"
                                            aria-valuetext={`${formData.gap} minutes`}
                                            type="range"
                                            min="0"
                                            max="10"
                                            value={formData.gap}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    gap: Number(e.target.value),
                                                })
                                            }
                                            className="flex-1 accent-orange-500"
                                        />
                                        <span className="w-11 text-center font-bold text-xs text-primary bg-primary/10 py-1 rounded font-mono">
                                            {formData.gap}m
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                            <h4 className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Schedule Summary
                            </h4>
                            <p className="text-xs font-medium text-foreground pb-1.5 border-b border-border/60">
                                2 × {speaking}m speeches + {effectiveBuffer}m buffer = <span className="font-bold text-primary">{debateDuration}m</span> debate · +{formData.gap}m changeover
                            </p>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Debates per Room</span>
                                <span className="font-semibold text-foreground">
                                    {debatesPerRoom}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Time per Group</span>
                                <span className="font-semibold text-foreground">
                                    {debateDuration}m + {formData.gap}m gap
                                </span>
                            </div>
                            <div className="flex justify-between pt-1.5 border-t border-border/60">
                                <span className="font-semibold text-foreground">Estimated Total</span>
                                <span className="font-semibold text-primary">
                                    {Math.floor(totalTimeNeeded / 60)}h {totalTimeNeeded % 60}m
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Room Selection & Preview */}
                    <div className="space-y-5 flex flex-col">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <h3 className="text-xs font-semibold text-foreground">
                                    Select Available Rooms ({selectedRoomIds.length}/{rooms.length})
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoomIds(rooms.map((r) => r.id))}
                                        className="min-h-11 px-2.5 py-1 rounded-md border border-border/70 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoomIds([])}
                                        className="min-h-11 px-2.5 py-1 rounded-md border border-border/70 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                                {rooms.map((room) => {
                                    const selected = selectedRoomIds.includes(room.id);
                                    return (
                                        <button
                                            key={room.id}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleRoom(room.id)}
                                            className={cn(
                                                "min-h-11 px-3 py-2 rounded-lg text-xs border-2 transition-all text-left flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                selected
                                                    ? "ax-room-selected ax-signal-win font-bold shadow-sm"
                                                    : "border-dashed border-border bg-muted/20 text-muted-foreground font-medium hover:bg-muted/40 hover:text-foreground"
                                            )}
                                        >
                                            <span className="truncate">{room.name}</span>
                                            {selected && (
                                                <Check className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <span>Sequence Preview</span>
                            </h3>
                            <div className="space-y-1.5">
                                {previewSlots.map((slot, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/70 text-[11px]"
                                    >
                                        <span className="w-12 font-bold text-muted-foreground uppercase text-[10px]">
                                            Slot {idx + 1}
                                        </span>
                                        <div className="flex-1 flex items-center justify-between">
                                            <span className="font-medium text-foreground">
                                                {slot.start.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <div className="h-px flex-1 mx-2 bg-border/60" />
                                            <span className="font-medium text-foreground">
                                                {slot.end.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        <span className="text-primary font-semibold text-[10px]">
                                            {debateDuration}m
                                        </span>
                                    </div>
                                ))}
                                {debatesPerRoom > 3 && (
                                    <p className="text-[10px] text-center text-muted-foreground italic">
                                        ... and {debatesPerRoom - 3} more slots
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2.5 pt-3 mt-auto border-t border-border/60">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 min-h-11 py-2 rounded-lg border border-border/70 hover:bg-muted font-medium transition-all text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || localSubmitting}
                                className="flex-[2] min-h-11 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-sm"
                            >
                                {loading || localSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Start Allocation"
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </Motion.div>
        </ModalSurface>
    );
}
