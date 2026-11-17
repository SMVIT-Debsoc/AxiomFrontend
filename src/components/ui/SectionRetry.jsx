export default function SectionRetry({message, onRetry, busy = false}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span role="status">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="min-h-11 rounded-lg px-3 font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {busy ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
