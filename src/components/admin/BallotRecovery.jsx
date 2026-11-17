export default function BallotRecovery({recovery, busy, onVerify, onLoadSaved, onOverwrite}) {
  if (!recovery) return null;
  const {saved} = recovery;
  const winner = saved?.winnerId === saved?.debater1Id ? "Government" :
    saved?.winnerId === saved?.debater2Id ? "Opposition" : "Not set";

  if (recovery.kind === "unconfirmed") {
    return (
      <div className="space-y-2 rounded-xl border border-amber-500/40 bg-card p-3.5 text-sm" role="status">
        <p className="font-semibold">Save not confirmed</p>
        <p className="text-muted-foreground">
          {recovery.verifyFailed
            ? "Could not check the server. Your scores are still here. Try checking again before resubmitting."
            : "The server may have saved this ballot. Check the stored result before resubmitting."}
        </p>
        <button type="button" disabled={Boolean(busy)} onClick={onVerify} className="ax-ghost-btn">
          {busy === "verify" ? "Checking…" : "Check saved result"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/40 bg-card p-3.5 text-sm" role="status">
      <p className="font-semibold">
        {recovery.conflict ? "Another admin saved this ballot first" : "The stored ballot does not match your entry"}
      </p>
      <p className="text-muted-foreground">
        {saved?.status === "COMPLETED"
          ? `Stored scores: ${saved.debater1Score ?? "—"} (Government), ${saved.debater2Score ?? "—"} (Opposition). Winner: ${winner}.`
          : saved
            ? "The server does not show a completed ballot yet."
            : "The server has a newer version of this ballot."}
        {" "}Review your scores before saving again.
      </p>
      {recovery.conflict && (onLoadSaved || onOverwrite) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onLoadSaved && saved && (
            <button type="button" disabled={Boolean(busy)} onClick={() => onLoadSaved(saved)} className="ax-ghost-btn">
              Load theirs
            </button>
          )}
          {onOverwrite && (
            <button type="button" disabled={Boolean(busy)} onClick={() => onOverwrite(saved)} className="ax-ghost-btn">
              Keep mine and overwrite
            </button>
          )}
        </div>
      )}
    </div>
  );
}
