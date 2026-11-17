import ModalSurface from "../../../../components/ui/ModalSurface";
import {motion as Motion} from "framer-motion";
import {Loader2, AlertTriangle, X} from "lucide-react";
import {cn} from "../../../../lib/utils";

export default function PairingPreviewModal({
    preview,
    roundNumber,
    onClose,
    onGenerate,
    generating = false,
}) {
    const payload = preview?.data || preview || {};
    const roundType =
        preview?.roundType ||
        payload.roundType ||
        (roundNumber === 1 ? "Random Draw" : "Power Matching (High vs High)");
    const usersList = Array.isArray(payload.users) ? payload.users : [];
    const eliminatedUsers = usersList.filter((u) => u.eliminated);
    const eligibleUsers = usersList.filter((u) => !u.eliminated);

    const presentCount = payload.presentUsers ?? usersList.length;
    const eligibleCount = payload.eligibleUsers ?? eligibleUsers.length;
    const eliminatedCount = payload.eliminatedUsers ?? eliminatedUsers.length;

    const proposedPairs = (() => {
        if (Array.isArray(payload.proposedPairings) && payload.proposedPairings.length > 0) {
            return payload.proposedPairings.map((pair, idx) => ({
                index: idx + 1,
                gov: pair.debater1 || pair.gov,
                opp: pair.debater2 || pair.opp,
                isSwing: Boolean(pair.usesSwing || pair.isSwing || pair.debater2?.isSwing || pair.opp?.isSwing),
                isRematch: Boolean(pair.isRematch),
            }));
        }
        const pairs = [];
        for (let i = 0; i < eligibleUsers.length; i += 2) {
            const gov = eligibleUsers[i];
            const opp = eligibleUsers[i + 1];
            if (opp) {
                pairs.push({ index: Math.floor(i / 2) + 1, gov, opp, isSwing: false });
            } else {
                pairs.push({
                    index: Math.floor(i / 2) + 1,
                    gov,
                    opp: { firstName: "Swing", lastName: "Member", college: "Auto-assigned Bye / Swing", isSwing: true },
                    isSwing: true,
                });
            }
        }
        return pairs;
    })();

    const needsSwing = Boolean(
        payload.needsSwing ??
            payload.unpaired ??
            (eligibleCount % 2 === 1)
    );
    const debatesToCreate = proposedPairs.length ||
        ((payload.possiblePairings ?? 0) + Number(needsSwing && eligibleCount > 0));
    const insufficientEntrants = eligibleCount === 0;

    const labelOf = (u) => {
        if (!u) return "TBD";
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return full || u.email || "Unknown";
    };

    return (
        <ModalSurface
            onDismiss={onClose}
            aria-label="Pairing Preview"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
            <Motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-border/80 rounded-xl p-5 md:p-6 w-full max-w-2xl shadow-xl my-6 max-h-[90vh] flex flex-col"
            >
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3.5">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-lg font-heading font-bold text-foreground">
                                Pairing Preview · Round {roundNumber}
                            </h2>
                            <span className="ax-signal-info inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200">
                                {roundType}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                            Dry-run bracket computed from checked-in debaters before locking debates.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close preview"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Vivid Stat Pills */}
                <div className="flex flex-wrap gap-2 py-3 border-b border-border/60">
                    <span className="ax-signal-info inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 text-xs font-semibold tabular-nums">
                        Present: {presentCount}
                    </span>
                    <span className="ax-signal-info inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-200 text-xs font-semibold tabular-nums">
                        Eligible: {eligibleCount}
                    </span>
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums",
                            eliminatedCount > 0
                                ? "ax-signal-loss border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                                : "border-border bg-muted/40 text-muted-foreground"
                        )}
                    >
                        Eliminated Excluded: {eliminatedCount}
                    </span>
                    <span className="ax-signal-win inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 text-xs font-semibold tabular-nums">
                        Debates to Create: {debatesToCreate}
                    </span>
                    {needsSwing && (
                        <span className="ax-signal-warn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 text-xs font-semibold">
                            Swing Needed
                        </span>
                    )}
                </div>

                {insufficientEntrants && (
                    <div className="ax-signal-loss mt-3 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
                        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>No present eligible debaters are available for a new pairing.</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                    {proposedPairs.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                            No matchups can be formed with {eligibleCount} eligible debater{eligibleCount === 1 ? "" : "s"}.
                        </div>
                    ) : (
                        proposedPairs.map((pair) => (
                            <div
                                key={pair.index}
                                className={cn(
                                    "rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs",
                                    pair.isSwing
                                        ? "ax-signal-warn border-orange-500/40 bg-orange-500/10"
                                        : "border-border/70 bg-muted/20"
                                )}
                            >
                                <div className="flex items-center gap-1.5 w-14 shrink-0">
                                    <span className="font-mono font-bold text-muted-foreground">
                                        #{pair.index}
                                    </span>
                                    {pair.isRematch && (
                                        <span
                                            title="Unavoidable rematch based on prior pairings"
                                            className="ax-chip ax-chip--warn text-[9px] font-bold uppercase"
                                        >
                                            RM
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="ax-chip ax-chip--gov shrink-0 text-[10px] font-bold">
                                        GOV
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{labelOf(pair.gov)}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {pair.gov?.college || "—"}
                                            {typeof pair.gov?.wins === "number" ? ` · ${pair.gov.wins}W` : ""}
                                            {typeof pair.gov?.avgScore === "number" ? ` · Avg ${pair.gov.avgScore.toFixed(1)}` : ""}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[11px] font-bold text-muted-foreground/70 shrink-0 px-1">vs</span>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className={cn(
                                        "shrink-0 text-[10px] font-bold ax-chip",
                                        pair.isSwing
                                            ? "ax-chip--warn"
                                            : "ax-chip--opp"
                                    )}>
                                        {pair.isSwing ? "SWING" : "OPP"}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{labelOf(pair.opp)}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {pair.opp?.college || "—"}
                                            {!pair.isSwing && typeof pair.opp?.wins === "number" ? ` · ${pair.opp.wins}W` : ""}
                                            {!pair.isSwing && typeof pair.opp?.avgScore === "number" ? ` · Avg ${pair.opp.avgScore.toFixed(1)}` : ""}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {eliminatedUsers.length > 0 && (
                        <div className="ax-signal-loss rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs">
                            <p className="font-semibold text-rose-700 dark:text-rose-200 mb-1.5">
                                Eliminated Debaters Excluded ({eliminatedUsers.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {eliminatedUsers.map((u) => (
                                    <span
                                        key={u.id || u.email}
                                        className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-200 border border-rose-500/30 text-[11px]"
                                    >
                                        {labelOf(u)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3.5 border-t border-border/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 px-4 py-2 rounded-lg border border-border/70 hover:bg-muted text-foreground text-xs font-medium transition-colors"
                    >
                        Close
                    </button>
                    {onGenerate && (
                        <button
                            type="button"
                            onClick={onGenerate}
                            disabled={insufficientEntrants || generating}
                            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                            <span>Generate Pairings Now</span>
                        </button>
                    )}
                </div>
            </Motion.div>
        </ModalSurface>
    );
}
