import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, Save, X, Trophy, ArrowRight } from "lucide-react";
import { UserAvatar } from "../ui/UserAvatar";
import { resolveWinnerId } from "../../lib/scoring";

export default function InlineResultSheet({ debate, debates = [], onSave, onClose }) {
    const [score1, setScore1] = useState(debate?.debater1Score?.toString() || "");
    const [score2, setScore2] = useState(debate?.debater2Score?.toString() || "");
    const [winnerId, setWinnerId] = useState(debate?.winnerId || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!debate) return;
        const initialS1 = debate.debater1Score?.toString() || "";
        const initialS2 = debate.debater2Score?.toString() || "";
        setScore1(initialS1);
        setScore2(initialS2);
        setWinnerId(
            resolveWinnerId(
                initialS1,
                initialS2,
                debate.winnerId || "",
                debate.debater1Id,
                debate.debater2Id
            )
        );
        setError(null);
    }, [debate]);

    if (!debate) return null;

    const s1Num = parseFloat(score1);
    const s2Num = parseFloat(score2);
    const isTie = Number.isFinite(s1Num) && Number.isFinite(s2Num) && s1Num === s2Num;

    const nextPending = debates.find(
        (d) => d.id !== debate.id && d.status !== "COMPLETED"
    );

    const handleScoreChange = (debaterIndex, value) => {
        const newS1 = debaterIndex === 1 ? value : score1;
        const newS2 = debaterIndex === 2 ? value : score2;
        if (debaterIndex === 1) setScore1(value);
        else setScore2(value);

        const autoWinner = resolveWinnerId(
            newS1,
            newS2,
            winnerId,
            debate.debater1Id,
            debate.debater2Id
        );
        setWinnerId(autoWinner);
        setError(null);
    };

    const handleSave = async (andNext = false) => {
        if (!score1 || !score2) {
            setError("Both speaker scores are required");
            return;
        }
        if (!Number.isFinite(parseFloat(score1)) || !Number.isFinite(parseFloat(score2))) {
            setError("Please enter valid numeric scores");
            return;
        }
        if (!winnerId) {
            setError("Please select a winner (required for tied scores)");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await onSave({
                debateId: debate.id,
                debater1Score: parseFloat(score1),
                debater2Score: parseFloat(score2),
                winnerId,
                nextDebate: andNext ? nextPending : null,
            });
        } catch (err) {
            setError(err?.message || "Failed to save debate result");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-card border-2 border-border rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 space-y-6 max-h-[92vh] overflow-y-auto font-sans">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Fast Ballot Entry
                        </span>
                        <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
                            Score Debate #{debate.id.substring(0, 6)}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {debate.room?.name ? `Room: ${debate.room.name}` : "No room assigned"} ·{" "}
                            {debate.judgeName || debate.adjudicator?.firstName
                                ? `Judge: ${debate.judgeName || debate.adjudicator?.firstName}`
                                : "No judge assigned"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close ballot sheet"
                        className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm flex items-start gap-2.5"
                    >
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {isTie && (
                    <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs sm:text-sm flex items-start gap-2.5 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                            Scores are tied ({score1} vs {score2}). Tap &ldquo;Set as Winner&rdquo; on the advancing debater.
                        </span>
                    </div>
                )}

                {/* Debaters comparison grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Debater 1 */}
                    <div
                        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 ${
                            winnerId === debate.debater1Id
                                ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 ring-2 ring-emerald-500/30"
                                : "border-border bg-card/60"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <UserAvatar
                                user={debate.debater1}
                                imageUrl={debate.debater1?.imageUrl}
                                size="lg"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Government
                                    </span>
                                    {winnerId === debate.debater1Id && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">
                                            <Trophy size={10} /> Winner
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-heading font-bold text-base sm:text-lg text-foreground truncate">
                                    {debate.debater1?.firstName} {debate.debater1?.lastName}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">
                                    {debate.debater1?.college || "Independent"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label
                                    htmlFor={`score-debater-1-${debate.id}`}
                                    className="text-xs font-semibold text-muted-foreground block mb-1"
                                >
                                    Score (0–100)
                                </label>
                                <input
                                    id={`score-debater-1-${debate.id}`}
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={score1}
                                    onChange={(e) => handleScoreChange(1, e.target.value)}
                                    placeholder="e.g. 78.5"
                                    className="w-full h-12 px-3.5 rounded-xl border-2 border-input bg-background text-lg font-mono font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setWinnerId(debate.debater1Id)}
                                className={`w-full min-h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                                    winnerId === debate.debater1Id
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                                }`}
                            >
                                <CheckCircle2 size={14} />
                                {winnerId === debate.debater1Id ? "Winner Auto-Selected" : "Set as Winner"}
                            </button>
                        </div>
                    </div>

                    {/* Debater 2 */}
                    <div
                        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 ${
                            winnerId === debate.debater2Id
                                ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 ring-2 ring-emerald-500/30"
                                : "border-border bg-card/60"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <UserAvatar
                                user={debate.debater2}
                                imageUrl={debate.debater2?.imageUrl}
                                size="lg"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Opposition
                                    </span>
                                    {winnerId === debate.debater2Id && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">
                                            <Trophy size={10} /> Winner
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-heading font-bold text-base sm:text-lg text-foreground truncate">
                                    {debate.debater2?.firstName} {debate.debater2?.lastName}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">
                                    {debate.debater2?.college || "Independent"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label
                                    htmlFor={`score-debater-2-${debate.id}`}
                                    className="text-xs font-semibold text-muted-foreground block mb-1"
                                >
                                    Score (0–100)
                                </label>
                                <input
                                    id={`score-debater-2-${debate.id}`}
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={score2}
                                    onChange={(e) => handleScoreChange(2, e.target.value)}
                                    placeholder="e.g. 76.0"
                                    className="w-full h-12 px-3.5 rounded-xl border-2 border-input bg-background text-lg font-mono font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setWinnerId(debate.debater2Id)}
                                className={`w-full min-h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                                    winnerId === debate.debater2Id
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                                }`}
                            >
                                <CheckCircle2 size={14} />
                                {winnerId === debate.debater2Id ? "Winner Auto-Selected" : "Set as Winner"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-border/80">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-full sm:w-auto min-h-11 px-5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>

                    {nextPending && (
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={submitting}
                            className="w-full sm:w-auto min-h-11 px-5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-sm hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ArrowRight size={16} />
                            )}
                            Save &amp; Next Pending
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={submitting}
                        className="w-full sm:w-auto min-h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        Save Result
                    </button>
                </div>
            </div>
        </div>
    );
}
