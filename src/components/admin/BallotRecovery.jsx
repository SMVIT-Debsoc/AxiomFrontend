export default function BallotRecovery({recovery, busy, onVerify}) {
  if (!recovery) return null;
  const {saved} = recovery;
  const winner = saved?.winnerId === saved?.debater1Id ? "Government" :
    saved?.winnerId === saved?.debater2Id ? "Opposition" : "Not set";

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/40 bg-card p-3.5 text-sm" role="status">
      {recovery.kind === "unconfirmed" ? (
        <>
          <p className="font-semibold">Save not confirmed</p>
          <p className="text-muted-foreground">
            {recovery.verifyFailed
              ? "Could not check the server. Your scores are still here. Try checking again before resubmitting."
              : "The server may have saved this ballot. Check the stored result before resubmitting."}
          </p>
          <button type="button" disabled={Boolean(busy)} onClick={onVerify} className="ax-ghost-btn">
            {busy === "verify" ? "Checking…" : "Check saved result"}
          </button>
        </>
      ) : (
        <>
          <p className="font-semibold">The stored ballot does not match your entry</p>
          <p className="text-muted-foreground">
            {saved.status === "COMPLETED"
              ? `Stored scores: ${saved.debater1Score ?? "—"} (Government), ${saved.debater2Score ?? "—"} (Opposition). Winner: ${winner}.`
              : "The server does not show a completed ballot yet."}
            {" "}Review your scores before saving again.
          </p>
        </>
      )}
    </div>
  );
}
