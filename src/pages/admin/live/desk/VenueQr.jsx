import {useCallback, useEffect, useRef, useState} from "react";
import {X} from "lucide-react";
import ModalSurface from "../../../../components/ui/ModalSurface";
import QrCode from "../../../../components/ops/QrCode";
import LoadError from "../../../../components/ui/LoadError";
import {useAuth} from "../../../../auth/client.jsx";
import {OpsApi} from "../../../../services/api";
import {formatShortCode, venueCheckInUrl} from "../../../../lib/opsLinks";
import {absoluteUrl} from "../../../../lib/liveStations";

const DEFAULT_ROTATE = 30;

/** Full-screen rotating venue check-in QR (refreshes every rotateSeconds). */
export default function VenueQr({roundId, roundLabel, onClose}) {
    const {getToken} = useAuth();
    const [venue, setVenue] = useState(null);
    const [error, setError] = useState(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const tokenRef = useRef(getToken);
    useEffect(() => { tokenRef.current = getToken; }, [getToken]);

    const load = useCallback(async () => {
        try {
            const token = await tokenRef.current();
            const res = await OpsApi.getVenueCode(roundId, token);
            const v = res?.venue || res?.data || res;
            const rotate = Number(v?.rotateSeconds) || DEFAULT_ROTATE;
            const parsed = Date.parse(v?.expiresAt);
            const expires = Number.isFinite(parsed) && parsed > Date.now() ? parsed : Date.now() + rotate * 1000;
            setVenue({code: v?.code, rotate, expiresAt: expires, path: v?.path || v?.url || "", windowOpen: v?.windowOpen});
            setError(null);
            return expires;
        } catch (err) {
            setError(err?.message || "Could not load the venue code");
            return Date.now() + 10000; // retry
        }
    }, [roundId]);

    // Load now, then reload whenever the code expires (all setState in callbacks).
    useEffect(() => {
        let reloadAt = 0;
        let active = true;
        const kick = () => load().then((at) => { if (active) reloadAt = at; });
        const first = window.setTimeout(kick, 0);
        const tick = window.setInterval(() => {
            const now = Date.now();
            setNowMs(now);
            if (reloadAt && now >= reloadAt) { reloadAt = 0; kick(); }
        }, 1000);
        return () => { active = false; window.clearTimeout(first); window.clearInterval(tick); };
    }, [load]);

    const remaining = venue ? Math.max(0, Math.ceil((venue.expiresAt - nowMs) / 1000)) : 0;
    const origin = window.location.origin;
    const url = venue?.code ? (venue.path ? absoluteUrl(origin, venue.path) : venueCheckInUrl(origin, roundId, venue.code)) : "";

    return (
        <ModalSurface onDismiss={onClose} aria-label="Venue check-in QR" className="bg-background p-0">
            <div className="relative flex min-h-full w-full flex-col items-center justify-center gap-5 bg-background p-6 text-center text-foreground">
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] grid h-12 w-12 place-items-center rounded-xl border border-border bg-card">
                    <X size={20} aria-hidden="true" />
                </button>
                <p className="m-0 font-heading text-lg font-bold">{roundLabel} · Check-in</p>
                {error ? (
                    <LoadError message="Venue code unavailable" detail={error} onRetry={load} />
                ) : !venue ? (
                    <p className="m-0 text-muted-foreground">Loading…</p>
                ) : (
                    <>
                        <div className="rounded-3xl bg-white p-4">
                            <QrCode value={url} size={Math.min(360, Math.floor(window.innerWidth * 0.78))} label="Scan to check in" />
                        </div>
                        <p className="m-0 font-display text-6xl leading-none tracking-[0.12em] tabular-nums sm:text-7xl">{formatShortCode(venue.code)}</p>
                        <p className="m-0 text-sm tabular-nums text-muted-foreground">New code in {remaining}s</p>
                        {venue.windowOpen === false && <p className="ax-state-flag m-0 rounded-xl border px-3 py-2 text-sm font-semibold">The check-in window is closed — this code won't work.</p>}
                    </>
                )}
            </div>
        </ModalSurface>
    );
}
