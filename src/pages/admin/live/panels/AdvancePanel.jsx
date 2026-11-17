import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Loader2, Minus, Plus} from "lucide-react";
import {useAuth} from "../../../../auth/client.jsx";
import {OpsApi} from "../../../../services/api";
import {cn} from "../../../../lib/utils";
import {fullName} from "../../../../lib/liveStations";
import {clampCut, normalizeProposal, promotionDelta, resolveTarget, slotsToFill, TARGET_OPTIONS} from "../../../../lib/promotionCut";
import {SideSheet} from "../ui";

/** Local fallback when the proposal endpoint is unavailable: losers by score. */
function proposalFromPerformers(performers) {
    const losers = performers.filter((p) => p.won === false)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((p, i) => ({userId: p.userId, name: fullName(p), college: p.college || "", score: p.score ?? null, margin: null, rank: i + 1, isPromoted: Boolean(p.isPromoted)}));
    return {candidates: losers, winners: performers.filter((p) => p.won).length, targetSize: null, suggestedCut: null, promotedIds: []};
}

/**
 * Advance: the system proposes a ranked best-loser list and a cut line to reach
 * the round's target; the Director nudges the line and applies it as a delta.
 */
export default function AdvancePanel({roundId, performers, promotionsVersion, busy, resultsPublished, onApply, onPromoteWinners, onClose}) {
    const {getToken} = useAuth();
    const [choice, setChoice] = useState("auto");
    const [custom, setCustom] = useState("");
    const [proposal, setProposal] = useState(null);
    const [source, setSource] = useState("server");
    const [loading, setLoading] = useState(true);
    const [cut, setCut] = useState(null);
    const tokenRef = useRef(getToken);
    useEffect(() => { tokenRef.current = getToken; }, [getToken]);

    const numericTarget = choice === "custom" ? Number(custom) || undefined : choice === "auto" ? undefined : choice;
    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const token = await tokenRef.current();
                const res = await OpsApi.getPromotionProposal(roundId, token, {targetSize: numericTarget});
                if (!active) return;
                setProposal(normalizeProposal(res));
                setSource("server");
            } catch {
                if (!active) return;
                setProposal(null);
                setSource("local");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [roundId, numericTarget, promotionsVersion]);

    const effective = useMemo(() => (source === "server" && proposal ? proposal : proposalFromPerformers(performers)), [source, proposal, performers]);
    const {candidates, winners} = effective;
    // Live advanced state comes from performers (ROUND_PROMOTIONS keeps it current).
    const promotedIds = useMemo(() => {
        const ids = performers.filter((p) => p.isPromoted).map((p) => p.userId);
        return ids.length || performers.length ? ids : effective.promotedIds;
    }, [performers, effective.promotedIds]);
    const promotedSet = useMemo(() => new Set(promotedIds), [promotedIds]);
    const target = choice === "auto" && effective.targetSize ? effective.targetSize : resolveTarget(choice, winners, custom);
    const proposedCut = effective.suggestedCut ?? slotsToFill(target, winners, candidates.length);
    const line = clampCut(cut ?? proposedCut, candidates.length);
    const delta = promotionDelta(candidates, line, promotedIds);
    const changes = delta.add.length + delta.remove.length;
    const advancedLosers = candidates.filter((c) => promotedSet.has(c.userId)).length;

    const nudge = useCallback((by) => setCut(clampCut(line + by, candidates.length)), [line, candidates.length]);
    const apply = async () => {
        if (await onApply(delta)) setCut(null);
    };

    const rowKeys = (e) => {
        if (e.key === "ArrowDown" || e.key === "+") { e.preventDefault(); nudge(1); }
        if (e.key === "ArrowUp" || e.key === "-") { e.preventDefault(); nudge(-1); }
    };

    const cutLine = () => (
        <li
            key="cut"
            role="separator"
            aria-label={`Cut line: ${line} above`}
            tabIndex={0}
            onKeyDown={rowKeys}
            className="flex items-center gap-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="h-0.5 flex-1 bg-foreground" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Cut · {line} advance</span>
            <span className="h-0.5 flex-1 bg-foreground" aria-hidden="true" />
        </li>
    );

    const rows = [];
    candidates.forEach((c, i) => {
        if (i === line) rows.push(cutLine());
        const above = i < line;
        const advanced = promotedSet.has(c.userId);
        rows.push(
            <li key={c.userId} className={cn("flex min-h-12 items-center gap-3 px-1 py-2", !above && "opacity-70")}>
                <span className="w-7 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{c.rank}</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{[c.college, c.roomName].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{c.score ?? "–"}{c.margin != null ? ` (${c.margin > 0 ? "+" : ""}${c.margin})` : ""}</span>
                {advanced && <span className="ax-chip ax-chip--ok shrink-0">Advanced</span>}
                <button
                    type="button"
                    onClick={() => setCut(above ? i : i + 1)}
                    className="min-h-11 shrink-0 rounded-lg px-2 text-[11px] font-semibold text-primary hover:underline"
                >
                    {above ? "Cut above" : "Cut below"}
                </button>
            </li>,
        );
    });
    if (line === candidates.length && candidates.length) rows.push(cutLine());

    return (
        <SideSheet
            wide
            title="Advance"
            subtitle={`${winners} winners · target ${target || "—"} · ${advancedLosers} best losers advanced`}
            onClose={onClose}
            footer={(
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button type="button" onClick={apply} disabled={!changes || busy === "promoting"} className="ax-primary-btn w-full sm:w-auto">
                        {busy === "promoting" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                        Advance {line} above the line
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {changes ? `+${delta.add.length} / −${delta.remove.length}` : "No changes"}
                    </span>
                    <button type="button" onClick={onPromoteWinners} disabled={busy === "promoting"} className="ax-ghost-btn min-h-11 w-full sm:ml-auto sm:w-auto">
                        Advance all winners
                    </button>
                </div>
            )}
        >
            <div id="inline-promotion-panel" className="space-y-4">
                {!resultsPublished && (
                    <p className="ax-state-waiting m-0 rounded-xl border px-3 py-2 text-xs">Results are not public yet. You can still set who advances.</p>
                )}
                <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">
                        <span className="mb-1 block">Target size</span>
                        <select
                            value={String(choice)}
                            onChange={(e) => { const v = e.target.value; setChoice(v === "auto" || v === "custom" ? v : Number(v)); setCut(null); }}
                            className="min-h-11 rounded-lg border border-input bg-background px-2.5 text-base font-semibold normal-case tracking-normal text-foreground sm:text-sm"
                        >
                            {TARGET_OPTIONS.map((o) => (
                                <option key={o} value={String(o)}>{o === "auto" ? `Auto (${resolveTarget("auto", winners)})` : o === "custom" ? "Custom…" : o}</option>
                            ))}
                        </select>
                    </label>
                    {choice === "custom" && (
                        <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            aria-label="Custom target size"
                            value={custom}
                            onChange={(e) => { setCustom(e.target.value); setCut(null); }}
                            className="min-h-11 w-24 rounded-lg border border-input bg-background px-2.5 text-base sm:text-sm"
                        />
                    )}
                    <div className="ml-auto flex items-center gap-1.5" aria-label="Move cut line">
                        <button type="button" onClick={() => nudge(-1)} aria-label="One fewer" className="ax-ghost-btn h-11 w-11 !px-0"><Minus size={16} /></button>
                        <span className="min-w-[3ch] text-center font-display text-3xl leading-none tabular-nums">{line}</span>
                        <button type="button" onClick={() => nudge(1)} aria-label="One more" className="ax-ghost-btn h-11 w-11 !px-0"><Plus size={16} /></button>
                        {cut != null && cut !== proposedCut && (
                            <button type="button" onClick={() => setCut(null)} className="min-h-11 px-2 text-xs font-semibold text-primary underline">Reset</button>
                        )}
                    </div>
                </div>
                {source === "local" && (
                    <p className="m-0 text-[11px] text-muted-foreground">Proposal service unavailable — ranked here by score.</p>
                )}
                {loading && !candidates.length ? (
                    <p className="m-0 text-sm text-muted-foreground">Ranking best losers…</p>
                ) : !candidates.length ? (
                    <p className="m-0 text-sm text-muted-foreground">No losers to rank yet. Ballots must be in first.</p>
                ) : (
                    <>
                        <div className="md:hidden divide-y divide-border">
                            <ul className="m-0 list-none p-0">{rows}</ul>
                        </div>
                        <ul className="m-0 hidden list-none divide-y divide-border/50 p-0 md:block">{rows}</ul>
                    </>
                )}
            </div>
        </SideSheet>
    );
}
