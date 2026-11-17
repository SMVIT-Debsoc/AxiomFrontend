import {AlertTriangle} from "lucide-react";
import {cn} from "../../lib/utils";
import SectionRetry from "./SectionRetry";

/**
 * Shown when a load fails, so a network error never looks like "not found" or
 * an empty list. `compact` renders the inline SectionRetry strip used for
 * individual page sections; the default is a full panel for whole pages.
 */
export default function LoadError({
  message = "Could not load this page.",
  detail,
  onRetry,
  busy = false,
  compact = false,
  className,
}) {
  if (compact) return <SectionRetry message={message} onRetry={onRetry} busy={busy} />;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-card/70 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-heading text-sm font-semibold text-foreground">{message}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="min-h-11 rounded-lg border border-border px-4 text-xs font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {busy ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}
