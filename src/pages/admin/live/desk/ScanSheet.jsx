import {useCallback, useEffect, useRef, useState} from "react";
import {Camera, Keyboard, Loader2} from "lucide-react";
import {useAuth} from "../../../../auth/client.jsx";
import {OpsApi} from "../../../../services/api";
import {UserAvatar} from "../../../../components/ui/UserAvatar";
import {cn} from "../../../../lib/utils";
import {fullName} from "../../../../lib/liveStations";
import {SideSheet} from "../ui";

const hasDetector = () => typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
const SHORT_CODE = /^[A-Z0-9]{6}$/;

/** Scan response → {kind: "in"|"already"|"error", user, message, checkIn}. */
function readScan(res) {
    const status = String(res?.status || res?.result || "").toUpperCase();
    const body = res?.data && typeof res.data === "object" ? res.data : res;
    const already = Boolean(body?.alreadyPresent ?? res?.alreadyPresent ?? body?.alreadyCheckedIn ?? body?.already) || status.startsWith("ALREADY");
    const user = body?.user || res?.user || body?.checkIn?.user || null;
    return {kind: already ? "already" : "in", user, checkIn: body?.checkIn || (user ? {userId: user.id, status: "PRESENT"} : null), message: body?.message || res?.message || ""};
}

/**
 * Desk scanner: camera QR via the native BarcodeDetector when available,
 * otherwise (or by choice) a 6-character short-code field.
 */
export default function ScanSheet({roundId, onCheckedIn, onClose}) {
    const {getToken} = useAuth();
    const [mode, setMode] = useState(hasDetector() ? "camera" : "code");
    const [code, setCode] = useState("");
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const videoRef = useRef(null);
    const busyRef = useRef(false);

    const submit = useCallback(async (pass) => {
        const value = String(pass || "").trim();
        if (!value || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            const token = await getToken();
            const res = await OpsApi.scanCheckIn(roundId, value, token);
            const parsed = readScan(res);
            setResult(parsed);
            if (parsed.checkIn || parsed.user) onCheckedIn?.(parsed.checkIn, parsed.user);
            navigator.vibrate?.(parsed.kind === "in" ? 60 : [30, 40, 30]);
        } catch (err) {
            setResult({kind: "error", message: err?.message || "Pass not recognised"});
            navigator.vibrate?.([80, 60, 80]);
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }, [getToken, roundId, onCheckedIn]);

    // Camera loop: runs while in camera mode and no result card is shown.
    useEffect(() => {
        if (mode !== "camera" || result) return undefined;
        let stream;
        let timer;
        let stopped = false;
        (async () => {
            try {
                const formats = await window.BarcodeDetector.getSupportedFormats?.().catch(() => null);
                if (Array.isArray(formats) && !formats.includes("qr_code")) throw Object.assign(new Error("QR unsupported"), {name: "NotSupportedError"});
                const detector = new window.BarcodeDetector({formats: ["qr_code"]});
                stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false});
                if (stopped) return;
                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await video.play().catch(() => {});
                const tick = async () => {
                    if (stopped) return;
                    try {
                        const codes = await detector.detect(video);
                        const raw = codes?.[0]?.rawValue;
                        if (raw && !busyRef.current) {
                            stopped = true;
                            await submit(raw);
                            return;
                        }
                    } catch { /* frame not ready */ }
                    timer = window.setTimeout(tick, 220);
                };
                tick();
            } catch (err) {
                if (!stopped) {
                    setCameraError(err?.name === "NotAllowedError" ? "Camera permission denied." : err?.name === "NotSupportedError" ? "This browser can't read QR codes." : "Camera unavailable.");
                    setMode("code");
                }
            }
        })();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [mode, result, submit]);

    const normalized = code.replace(/[\s-]+/g, "").toUpperCase();
    const reset = () => { setResult(null); setCode(""); };

    return (
        <SideSheet title="Scan pass" subtitle="Scan a debater's personal pass, or type its 6-character code." onClose={onClose}>
            {result ? (
                <div className={cn("flex flex-col items-center gap-3 rounded-2xl border p-6 text-center", result.kind === "error" ? "ax-state-flag" : "ax-state-done")} role="status" aria-live="assertive">
                    {result.user && <UserAvatar user={result.user} size="lg" />}
                    <p className="m-0 font-heading text-2xl font-bold">{result.user ? fullName(result.user) : result.kind === "error" ? "Not checked in" : "Checked in"}</p>
                    <p className="m-0 font-display text-4xl leading-none">
                        {result.kind === "in" ? "Checked in" : result.kind === "already" ? "Already in" : "Error"}
                    </p>
                    {result.message && <p className="m-0 text-sm">{result.message}</p>}
                    {result.user?.college && <p className="m-0 text-xs text-muted-foreground">{result.user.college}</p>}
                    <button type="button" onClick={reset} className="ax-primary-btn mt-2 w-full min-h-12" autoFocus>Scan next</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {hasDetector() && (
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setMode("camera")} aria-pressed={mode === "camera"} className={cn("ax-ghost-btn min-h-12", mode === "camera" && "bg-muted")}>
                                <Camera size={16} aria-hidden="true" /> Camera
                            </button>
                            <button type="button" onClick={() => setMode("code")} aria-pressed={mode === "code"} className={cn("ax-ghost-btn min-h-12", mode === "code" && "bg-muted")}>
                                <Keyboard size={16} aria-hidden="true" /> Type code
                            </button>
                        </div>
                    )}
                    {mode === "camera" ? (
                        <div className="relative overflow-hidden rounded-2xl bg-black">
                            <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
                            <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80" />
                            {busy && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="animate-spin text-white" /></div>}
                        </div>
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); if (SHORT_CODE.test(normalized)) void submit(normalized); }} className="space-y-3">
                            {cameraError && <p className="m-0 text-xs text-muted-foreground">{cameraError} Type the code instead.</p>}
                            <label htmlFor="pass-code" className="block text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">Pass code</label>
                            <input
                                id="pass-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                autoFocus
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={9}
                                placeholder="ABC123"
                                className="min-h-14 w-full rounded-xl border border-input bg-background px-4 text-center font-mono text-3xl tracking-[0.3em]"
                            />
                            <button type="submit" disabled={!SHORT_CODE.test(normalized) || busy} className="ax-primary-btn w-full min-h-12">
                                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Check in
                            </button>
                        </form>
                    )}
                </div>
            )}
        </SideSheet>
    );
}
