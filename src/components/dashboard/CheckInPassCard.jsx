import {useCallback, useEffect, useRef, useState} from "react";
import {ChevronDown, QrCode as QrIcon} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {OpsApi} from "../../services/api";
import QrCode from "../ops/QrCode";
import {formatShortCode, passQrValue} from "../../lib/opsLinks";
import SectionRetry from "../ui/SectionRetry";

/**
 * Personal check-in pass: the Desk scans this QR (or types the short code)
 * when the venue QR can't be used. Collapsed by default so it never crowds
 * the round card; the pass is fetched the first time it is opened.
 */
export default function CheckInPassCard({className = ""}) {
  const {getToken} = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({loading: false, error: null, pass: null, shortCode: null});

  const load = useCallback(async () => {
    setState((prev) => ({...prev, loading: true, error: null}));
    try {
      const token = await getTokenRef.current();
      const response = await OpsApi.getMyCheckInPass(token);
      const data = response?.data || response || {};
      setState({loading: false, error: null, pass: data.pass || null, shortCode: data.shortCode || null});
    } catch (failure) {
      setState((prev) => ({...prev, loading: false, error: failure?.message || "Could not load your pass."}));
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !state.pass && !state.loading) void load();
  };

  return (
    <section className={`rounded-xl border border-border bg-background/50 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold sm:text-sm">
          <QrIcon size={16} aria-hidden="true" /> My check-in pass
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Show this at the desk
          <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col items-center gap-3 border-t border-border px-3.5 pb-4 pt-3 text-center">
          {state.error ? (
            <SectionRetry message={state.error} onRetry={load} busy={state.loading} />
          ) : (
            <>
              <QrCode value={state.pass ? passQrValue(state.pass) : ""} size={220} />
              <p className="m-0 font-display text-5xl leading-none tracking-wider tabular-nums" aria-label={state.shortCode ? `Short code ${state.shortCode.split("").join(" ")}` : undefined}>
                {state.loading && !state.shortCode ? "…" : formatShortCode(state.shortCode) || "—"}
              </p>
              <p className="m-0 text-xs text-muted-foreground">Show this at the desk. Scan the screen in the hall first — this is the backup.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
