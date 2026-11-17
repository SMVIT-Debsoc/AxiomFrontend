import {useState} from "react";
import ModalSurface from "../../../components/ui/ModalSurface";
import {Loader2, X} from "lucide-react";
import {useAuth} from "../../../auth/client.jsx";
import {AdminApi} from "../../../services/api";
import {useToast} from "../../../hooks/useToast";
import {toISTDateTimeLocal, toISTISOString, addMinutesToISTDateTime, getCurrentISTDateTimeLocal} from "../../../lib/utils";

const toISTDateTimeString = toISTDateTimeLocal;

export function QuickRoomModal({onClose, onCreated}) {
    const {getToken} = useAuth();
    const toast = useToast();
    const [name, setName] = useState("");
    const [capacity, setCapacity] = useState(2);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await AdminApi.createRoom({name: name.trim(), capacity: Number(capacity) || 2}, token);
            if (res.success) {
                toast.success("Room created", `${name.trim()} is ready for allocation.`);
                onCreated(res.room);
            } else {
                toast.error("Failed", res.error || "Could not create room");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Could not create room");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalSurface onDismiss={onClose} aria-label="Add room" className="flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-heading font-bold text-lg text-foreground">Quick Add Room</h3>
                    <button type="button" onClick={onClose} className="min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <label className="block">
                        <span className="font-semibold block mb-1 text-foreground">Room Name</span>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Hall B, Lecture Room 204"
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </label>
                    <label className="block">
                        <span className="font-semibold block mb-1 text-foreground">Capacity</span>
                        <input
                            type="number"
                            required
                            min="2"
                            value={capacity}
                            onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 2)}
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-mono"
                        />
                    </label>
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border font-semibold">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5">
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            Add Room
                        </button>
                    </div>
                </form>
            </div>
        </ModalSurface>
    );
}

export function QuickCreateRoundModal({eventId, defaultRoundNumber, onClose, onCreated}) {
    const {getToken} = useAuth();
    const [roundNumber, setRoundNumber] = useState(defaultRoundNumber);
    const [name, setName] = useState(`Round ${defaultRoundNumber}`);
    const [motion, setMotion] = useState("");
    const [checkInStartTime, setCheckInStartTime] = useState(() => toISTDateTimeString(new Date()));
    const [checkInEndTime, setCheckInEndTime] = useState(() => toISTDateTimeString(new Date(Date.now() + 20 * 60000)));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const applyPreset = (mins) => {
        const baseStart = checkInStartTime || getCurrentISTDateTimeLocal();
        if (!checkInStartTime) setCheckInStartTime(baseStart);
        setCheckInEndTime(addMinutesToISTDateTime(baseStart, mins));
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!motion.trim()) {
            setError("Debate motion is required. Motion cannot be left blank.");
            return;
        }
        const startIso = toISTISOString(checkInStartTime);
        const endIso = toISTISOString(checkInEndTime);
        if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
            setError("Check-in end time must be after check-in start time.");
            return;
        }
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await AdminApi.createRound({
                eventId,
                roundNumber: Number(roundNumber),
                name: name.trim() || `Round ${roundNumber}`,
                motion: motion.trim(),
                checkInStartTime: startIso,
                checkInEndTime: endIso,
            }, token);

            if (res.success && res.round) {
                onCreated(res.round);
            } else {
                setError(res.error || "Failed to create round");
            }
        } catch (err) {
            setError(err?.message || "Failed to create round");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalSurface onDismiss={onClose} aria-label="Add round" className="flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-heading font-bold text-lg text-foreground">Add New Round</h3>
                    <button type="button" onClick={onClose} className="min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="ax-signal-loss p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-medium" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <div>
                        <label className="font-semibold block mb-1 text-foreground">Round Number</label>
                        <input
                            type="number"
                            min="1"
                            value={roundNumber}
                            onChange={(e) => {
                                setRoundNumber(e.target.value);
                                if (!name || name.startsWith("Round ")) setName(`Round ${e.target.value}`);
                            }}
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background font-mono text-foreground font-bold"
                            required
                        />
                    </div>

                    <div>
                        <label className="font-semibold block mb-1 text-foreground">Round Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Preliminary Round 2"
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="block">
                            <span className="font-semibold block mb-1 text-foreground">Check-in Start (IST)</span>
                            <input
                                type="datetime-local"
                                required
                                value={checkInStartTime}
                                onChange={(e) => setCheckInStartTime(e.target.value)}
                                className="w-full min-h-11 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                            />
                        </label>
                        <label className="block">
                            <span className="font-semibold block mb-1 text-foreground">Check-in End (IST)</span>
                            <input
                                type="datetime-local"
                                required
                                value={checkInEndTime}
                                onChange={(e) => setCheckInEndTime(e.target.value)}
                                className="w-full min-h-11 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-medium">Window duration:</span>
                        {[15, 20, 30, 45, 60].map((mins) => (
                            <button
                                key={mins}
                                type="button"
                                onClick={() => applyPreset(mins)}
                                className="min-h-11 px-3 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground font-semibold transition-colors"
                            >
                                {mins}m
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="font-semibold block mb-1 text-foreground">
                            Debate Motion <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <textarea
                            required
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                            placeholder="Enter the required debate motion or topic..."
                            rows={3}
                            className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 px-4 py-2 rounded-lg border text-foreground font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="min-h-11 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            Create Round
                        </button>
                    </div>
                </form>
            </div>
        </ModalSurface>
    );
}
