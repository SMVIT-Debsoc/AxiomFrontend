import {memo, useEffect, useState} from "react";
import {Clock} from "lucide-react";
import {cn, formatTimeIST, toISTDateTimeLocal, toISTISOString, addMinutesToISTDateTime, getCurrentISTDateTimeLocal} from "../../../lib/utils";

const toISTDateTimeString = toISTDateTimeLocal;

// Memoized: it re-renders on its own 15s clock, not on every parent update.
const CheckInWindowStrip = memo(function CheckInWindowStrip({round, busy, onUpdateWindow}) {
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [editing, setEditing] = useState(false);
    const [startVal, setStartVal] = useState("");
    const [endVal, setEndVal] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const hasWindow = Boolean(round?.checkInStartTime && round?.checkInEndTime);
    const startMs = hasWindow ? new Date(round.checkInStartTime).getTime() : NaN;
    const endMs = hasWindow ? new Date(round.checkInEndTime).getTime() : NaN;
    const isValid = hasWindow && Number.isFinite(startMs) && Number.isFinite(endMs);

    const status = !isValid
        ? "NOT_CONFIGURED"
        : nowMs < startMs
        ? "UPCOMING"
        : nowMs <= endMs
        ? "OPEN"
        : "CLOSED";

    const statusMeta = {
        OPEN: {
            label: "OPEN",
            cls: "ax-signal-win border-emerald-500/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.22)]",
        },
        CLOSED: {
            label: "CLOSED",
            cls: "ax-signal-loss border-rose-500/45 bg-rose-500/20 text-rose-700 dark:text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
        },
        UPCOMING: {
            label: "UPCOMING",
            cls: "ax-signal-warn border-orange-500/45 bg-orange-500/18 text-orange-800 dark:text-orange-200",
        },
        NOT_CONFIGURED: {
            label: "NOT CONFIGURED",
            cls: "ax-signal-loss border-rose-500/50 bg-rose-500/20 text-rose-700 dark:text-rose-200",
        },
    }[status];

    const openEditor = () => {
        setStartVal(toISTDateTimeString(round?.checkInStartTime || new Date()));
        setEndVal(toISTDateTimeString(round?.checkInEndTime || new Date(Date.now() + 20 * 60000)));
        setErr("");
        setEditing((v) => !v);
    };

    const handleSaveCustom = async (e) => {
        e.preventDefault();
        setErr("");
        const startIso = toISTISOString(startVal);
        const endIso = toISTISOString(endVal);
        if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
            setErr("Closing time must be after opening time.");
            return;
        }
        const ok = await onUpdateWindow({checkInStartTime: startIso, checkInEndTime: endIso});
        if (ok) setEditing(false);
    };

    const currentDurationMins = (() => {
        if (!startVal || !endVal) return null;
        const s = new Date(startVal).getTime();
        const e = new Date(endVal).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
        return Math.round((e - s) / 60000);
    })();

    const windowBusy = busy === "window";

    return (
        <div
            className={cn(
                "rounded-xl border p-3.5 space-y-3",
                status === "NOT_CONFIGURED"
                    ? "ax-signal-loss border-rose-500/40 bg-rose-500/10"
                    : status === "OPEN"
                    ? "border-emerald-500/35 bg-emerald-500/5"
                    : "border-border bg-muted/30"
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Clock size={15} className="text-primary shrink-0" aria-hidden="true" />
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border", statusMeta.cls)}>
                        {statusMeta.label}
                    </span>
                    {isValid ? (
                        <span className="text-xs font-semibold text-foreground">
                            Opens: <span className="font-mono">{formatTimeIST(round.checkInStartTime)} IST</span>
                            {" · "}
                            Closes: <span className="font-mono">{formatTimeIST(round.checkInEndTime)} IST</span>
                        </span>
                    ) : (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                            Check-in window is not configured — open a 20m window so debaters can check in.
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap w-full sm:w-auto items-center gap-1.5">
                    <button
                        type="button"
                        disabled={windowBusy}
                        onClick={() =>
                            onUpdateWindow({
                                checkInStartTime: new Date().toISOString(),
                                checkInEndTime: new Date(Date.now() + 20 * 60000).toISOString(),
                            })
                        }
                        className="min-h-11 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        Open 20m Now
                    </button>
                    <button
                        type="button"
                        disabled={windowBusy}
                        onClick={() => {
                            const baseEnd = isValid ? Math.max(Date.now(), endMs) : Date.now();
                            onUpdateWindow({
                                checkInStartTime: isValid ? round.checkInStartTime : new Date().toISOString(),
                                checkInEndTime: new Date(baseEnd + 10 * 60000).toISOString(),
                            });
                        }}
                        className="min-h-11 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                        +10m Extend
                    </button>
                    {status === "OPEN" && (
                        <button
                            type="button"
                            disabled={windowBusy}
                            onClick={() => {
                                if (!window.confirm("Close check-in now? Debaters who haven't checked in will be locked out.")) return;
                                onUpdateWindow({
                                    checkInStartTime: isValid ? round.checkInStartTime : new Date(Date.now() - 60000).toISOString(),
                                    checkInEndTime: new Date(Date.now() - 1000).toISOString(),
                                });
                            }}
                            className="min-h-11 px-3 py-1.5 rounded-lg ax-signal-loss border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-50 transition-colors"
                        >
                            Close Now
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={openEditor}
                        aria-expanded={editing}
                        className="min-h-11 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors"
                    >
                        {editing ? "Cancel" : "Edit Times"}
                    </button>
                </div>
            </div>

            {editing && (
                <form onSubmit={handleSaveCustom} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-end pt-2 border-t border-border/60">
                    {err && (
                        <p className="sm:col-span-3 m-0 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">
                            {err}
                        </p>
                    )}
                    <label className="text-xs">
                        <span className="block font-semibold text-foreground mb-1">Opens (IST)</span>
                        <input
                            type="datetime-local"
                            required
                            value={startVal}
                            onChange={(e) => setStartVal(e.target.value)}
                            className="w-full min-h-11 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs"
                        />
                    </label>
                    <label className="text-xs">
                        <span className="block font-semibold text-foreground mb-1">Closes (IST)</span>
                        <input
                            type="datetime-local"
                            required
                            value={endVal}
                            onChange={(e) => setEndVal(e.target.value)}
                            className="w-full min-h-11 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={windowBusy}
                        className="min-h-11 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                    >
                        {windowBusy ? "Saving…" : "Save Window"}
                    </button>
                    <div className="sm:col-span-3 space-y-1.5 pt-1">
                        <span className="text-muted-foreground text-[11px] font-medium block">Window duration:</span>
                        <div className="grid grid-cols-5 gap-1.5">
                            {[15, 20, 30, 45, 60].map((mins) => {
                                const isActive = currentDurationMins === mins;
                                return (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => {
                                            const baseStart = startVal || getCurrentISTDateTimeLocal();
                                            if (!startVal) setStartVal(baseStart);
                                            setEndVal(addMinutesToISTDateTime(baseStart, mins));
                                            setErr("");
                                        }}
                                        className={cn(
                                            "min-h-9 py-1 px-1 text-center rounded-lg font-heading font-bold text-xs tracking-wide transition-all border-2",
                                            isActive
                                                ? "bg-[#1D1E18] text-[#EAFBF5] border-[#1D1E18] dark:bg-[#B9F5D8] dark:text-[#141510] dark:border-[#B9F5D8] shadow-sm ring-1 ring-primary/40"
                                                : "bg-muted/40 hover:bg-muted text-foreground border-border hover:border-foreground/30"
                                        )}
                                    >
                                        {mins}m
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
});


export default CheckInWindowStrip;
