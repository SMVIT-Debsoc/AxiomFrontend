import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Check, EyeOff, Loader2, Minus, Plus, RotateCcw, Search, Send, UserPlus, X} from "lucide-react";
import {useAuth} from "../../../../auth/client.jsx";
import {OpsApi} from "../../../../services/api";
import {cn} from "../../../../lib/utils";
import {fullName, userMatches} from "../../../../lib/liveStations";
import {clampCut, normalizeProposal, resolveTarget, slotsToFill, TARGET_OPTIONS} from "../../../../lib/promotionCut";
import {SideSheet} from "../ui";

/** Local fallback when the proposal endpoint is unavailable: winners + losers by score. */
function proposalFromPerformers(performers) {
    const winnerRows = performers
        .filter((p) => p.won === true)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((p) => ({
            userId: p.userId,
            name: fullName(p),
            college: p.college || "",
            score: p.score ?? null,
            margin: null,
            isPromoted: Boolean(p.isPromoted),
            roomName: "",
        }));
    const losers = performers
        .filter((p) => p.won === false)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((p, i) => ({
            userId: p.userId,
            name: fullName(p),
            college: p.college || "",
            score: p.score ?? null,
            margin: null,
            rank: i + 1,
            isPromoted: Boolean(p.isPromoted),
            roomName: "",
        }));
    const otherPromoted = performers
        .filter((p) => p.won !== true && p.won !== false && p.isPromoted)
        .map((p) => ({userId: p.userId, name: fullName(p), college: p.college || ""}));
    return {
        candidates: losers,
        winnerRows,
        otherPromoted,
        winners: winnerRows.length,
        targetSize: null,
        suggestedCut: null,
        promotedIds: performers.filter((p) => p.isPromoted).map((p) => p.userId),
        hasExplicitPromotions: winnerRows.some((w) => w.isPromoted),
    };
}

/**
 * Advance: full manual promotion control with a two-step Review -> Publish workflow,
 * plus anytime Revoke / Unpublish so organisers control who advances and when results go live.
 */
export default function AdvancePanel({
    roundId,
    performers = [],
    people = [],
    promotionsVersion,
    busy,
    resultsPublished,
    onApply,
    onPublishResults,
    onClose,
}) {
    const {getToken} = useAuth();
    const [step, setStep] = useState("select"); // "select" | "review"
    const [choice, setChoice] = useState("auto");
    const [custom, setCustom] = useState("");
    const [proposal, setProposal] = useState(null);
    const [source, setSource] = useState("server");
    const [loading, setLoading] = useState(true);
    const [cut, setCut] = useState(null);
    const [overrides, setOverrides] = useState(() => new Map());
    const [manualQuery, setManualQuery] = useState("");
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

    const effective = useMemo(
        () => (source === "server" && proposal ? proposal : proposalFromPerformers(performers)),
        [source, proposal, performers],
    );
    const {candidates, winners: winnersCount} = effective;

    const winnerRows = useMemo(() => {
        if (effective.winnerRows && effective.winnerRows.length > 0) return effective.winnerRows;
        return performers
            .filter((p) => p.won === true)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((p) => ({
                userId: p.userId,
                name: fullName(p),
                college: p.college || "",
                score: p.score ?? null,
                margin: null,
                isPromoted: Boolean(p.isPromoted),
                roomName: "",
            }));
    }, [effective.winnerRows, performers]);

    const savedPromotedIds = useMemo(() => {
        const set = new Set(effective.promotedIds || []);
        for (const p of performers) {
            if (p.isPromoted) set.add(p.userId);
        }
        return [...set];
    }, [effective.promotedIds, performers]);
    const savedPromotedSet = useMemo(() => new Set(savedPromotedIds), [savedPromotedIds]);

    const hasExplicitSaved = useMemo(
        () => Boolean(effective.hasExplicitPromotions || winnerRows.some((w) => savedPromotedSet.has(w.userId))),
        [effective.hasExplicitPromotions, winnerRows, savedPromotedSet],
    );

    const target = choice === "auto" && effective.targetSize ? effective.targetSize : resolveTarget(choice, winnersCount, custom);
    const proposedCut = effective.suggestedCut ?? slotsToFill(target, winnersCount, candidates.length);
    const line = clampCut(cut ?? proposedCut, candidates.length);

    // Base advancing set before local toggles: saved explicit roster if one exists, else recommended (all winners + top cut losers).
    const baseSelectedSet = useMemo(() => {
        if (hasExplicitSaved) return new Set(savedPromotedSet);
        const set = new Set(savedPromotedSet);
        winnerRows.forEach((w) => set.add(w.userId));
        candidates.slice(0, proposedCut).forEach((c) => set.add(c.userId));
        return set;
    }, [hasExplicitSaved, savedPromotedSet, winnerRows, candidates, proposedCut]);

    const selectedSet = useMemo(() => {
        const set = new Set(baseSelectedSet);
        for (const [uid, included] of overrides.entries()) {
            if (included) set.add(uid);
            else set.delete(uid);
        }
        return set;
    }, [baseSelectedSet, overrides]);

    const delta = useMemo(() => {
        const add = [...selectedSet].filter((id) => !savedPromotedSet.has(id));
        const remove = [...savedPromotedSet].filter((id) => !selectedSet.has(id));
        return {add, remove};
    }, [selectedSet, savedPromotedSet]);
    const hasUnsaved = delta.add.length > 0 || delta.remove.length > 0;

    const toggleUser = useCallback((userId) => {
        setOverrides((prev) => {
            const next = new Map(prev);
            const current = next.has(userId) ? next.get(userId) : baseSelectedSet.has(userId);
            next.set(userId, !current);
            return next;
        });
    }, [baseSelectedSet]);

    const applyCutLine = useCallback((nextCutValue) => {
        const clamped = clampCut(nextCutValue, candidates.length);
        setCut(clamped);
        setOverrides((prev) => {
            const next = new Map(prev);
            candidates.forEach((c, idx) => {
                next.set(c.userId, idx < clamped);
            });
            return next;
        });
    }, [candidates]);

    const nudge = useCallback((by) => applyCutLine(line + by), [applyCutLine, line]);

    const resetRecommended = useCallback(() => {
        setCut(null);
        setOverrides(() => {
            const next = new Map();
            winnerRows.forEach((w) => next.set(w.userId, true));
            candidates.forEach((c, idx) => next.set(c.userId, idx < proposedCut));
            for (const uid of savedPromotedSet) {
                if (!winnerRows.some((w) => w.userId === uid) && !candidates.some((c) => c.userId === uid)) {
                    next.set(uid, false);
                }
            }
            return next;
        });
    }, [winnerRows, candidates, proposedCut, savedPromotedSet]);

    const knownDebateIds = useMemo(() => {
        const set = new Set();
        winnerRows.forEach((w) => set.add(w.userId));
        candidates.forEach((c) => set.add(c.userId));
        return set;
    }, [winnerRows, candidates]);

    const peopleById = useMemo(() => {
        const map = new Map();
        for (const u of people) map.set(u.id, u);
        for (const p of performers) {
            if (!map.has(p.userId)) map.set(p.userId, {id: p.userId, firstName: p.firstName, lastName: p.lastName, name: fullName(p), college: p.college});
        }
        for (const o of effective.otherPromoted || []) {
            if (!map.has(o.userId)) map.set(o.userId, {id: o.userId, name: o.name, college: o.college});
        }
        return map;
    }, [people, performers, effective.otherPromoted]);

    const manualExtraSelected = useMemo(() => {
        const list = [];
        for (const uid of selectedSet) {
            if (knownDebateIds.has(uid)) continue;
            const u = peopleById.get(uid);
            list.push({
                userId: uid,
                name: u ? fullName(u) : uid,
                college: u?.college || "",
            });
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedSet, knownDebateIds, peopleById]);

    const manualSearchResults = useMemo(() => {
        const q = manualQuery.trim();
        if (!q) return [];
        return people
            .filter((u) => !knownDebateIds.has(u.id) && userMatches(u, q))
            .slice(0, 8);
    }, [people, knownDebateIds, manualQuery]);

    // Categorised lists for Step 2 (Review & Publish)
    const reviewAdvancing = useMemo(() => {
        const items = [];
        for (const w of winnerRows) {
            if (selectedSet.has(w.userId)) items.push({...w, category: "Winner"});
        }
        for (const c of candidates) {
            if (selectedSet.has(c.userId)) items.push({...c, category: "Best Loser"});
        }
        for (const m of manualExtraSelected) {
            items.push({...m, score: null, margin: null, category: "Manual"});
        }
        return items;
    }, [winnerRows, candidates, manualExtraSelected, selectedSet]);

    const reviewEliminated = useMemo(() => {
        const items = [];
        for (const w of winnerRows) {
            if (!selectedSet.has(w.userId)) items.push({...w, category: "Winner (revoked)"});
        }
        for (const c of candidates) {
            if (!selectedSet.has(c.userId)) items.push({...c, category: "Did not advance"});
        }
        return items;
    }, [winnerRows, candidates, selectedSet]);

    const winnersSelectedCount = winnerRows.filter((w) => selectedSet.has(w.userId)).length;
    const losersSelectedCount = candidates.filter((c) => selectedSet.has(c.userId)).length;
    const isBusyAction = busy === "promoting" || busy === "results";

    const saveDraft = async () => {
        if (!hasUnsaved) return true;
        const ok = await onApply(delta);
        if (ok) {
            setOverrides(new Map());
            setCut(null);
        }
        return ok;
    };

    const saveAndPublish = async () => {
        if (hasUnsaved) {
            const saved = await saveDraft();
            if (!saved) return;
        }
        if (onPublishResults && !resultsPublished) {
            await onPublishResults(true);
        }
    };

    const revokePublished = async () => {
        if (onPublishResults && resultsPublished) {
            await onPublishResults(false);
        }
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
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Cut · {line} best losers</span>
            <span className="h-0.5 flex-1 bg-foreground" aria-hidden="true" />
        </li>
    );

    const candidateRows = [];
    candidates.forEach((c, i) => {
        if (i === line) candidateRows.push(cutLine());
        const above = i < line;
        const selected = selectedSet.has(c.userId);
        candidateRows.push(
            <li key={c.userId} className={cn("flex min-h-12 items-center gap-2.5 px-1 py-2", !selected && "opacity-70")}>
                <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{c.rank}</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                        {[
                            c.college,
                            c.roomName,
                            typeof c.cumulativeWins === "number" ? `${c.cumulativeWins}W overall` : null,
                        ].filter(Boolean).join(" · ")}
                    </span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">
                    {c.score ?? "–"}{c.margin != null ? ` (−${c.margin})` : ""}
                </span>
                <button
                    type="button"
                    onClick={() => applyCutLine(above ? i : i + 1)}
                    className="hidden sm:inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                    title={above ? "Move cut line above this debater" : "Move cut line below this debater"}
                >
                    {above ? "Cut ↑" : "Cut ↓"}
                </button>
                <button
                    type="button"
                    onClick={() => toggleUser(c.userId)}
                    aria-pressed={selected}
                    className={cn(
                        "min-h-10 shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                        selected
                            ? "border-emerald-600/40 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 hover:bg-rose-600/15 hover:border-rose-600/40 hover:text-rose-700"
                            : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                >
                    {selected ? "Advancing" : "Advance"}
                </button>
            </li>,
        );
    });
    if (line === candidates.length && candidates.length) candidateRows.push(cutLine());

    const footerContent = step === "select" ? (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => setStep("review")}
                className="ax-primary-btn min-h-11 flex-1 sm:flex-none"
            >
                Review advancing ({selectedSet.size}) →
            </button>
            <button
                type="button"
                onClick={saveDraft}
                disabled={!hasUnsaved || isBusyAction}
                className="ax-ghost-btn min-h-11"
            >
                {busy === "promoting" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Save draft
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
                {hasUnsaved ? `+${delta.add.length} / −${delta.remove.length} unsaved` : "Saved"}
            </span>
            {resultsPublished && onPublishResults && (
                <button
                    type="button"
                    onClick={revokePublished}
                    disabled={isBusyAction}
                    className="min-h-11 sm:ml-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                >
                    <EyeOff size={14} aria-hidden="true" />
                    Revoke publish
                </button>
            )}
        </div>
    ) : (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => setStep("select")}
                disabled={isBusyAction}
                className="ax-ghost-btn min-h-11"
            >
                ← Back to edit
            </button>
            {hasUnsaved && (
                <button
                    type="button"
                    onClick={saveDraft}
                    disabled={isBusyAction}
                    className="ax-ghost-btn min-h-11"
                >
                    {busy === "promoting" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                    {resultsPublished ? "Save roster changes" : "Save draft"}
                </button>
            )}
            {!resultsPublished && onPublishResults ? (
                <button
                    type="button"
                    onClick={saveAndPublish}
                    disabled={isBusyAction}
                    className="ax-primary-btn min-h-11 sm:ml-auto"
                >
                    {isBusyAction ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                    Save &amp; Publish Results ({selectedSet.size})
                </button>
            ) : resultsPublished && onPublishResults ? (
                <button
                    type="button"
                    onClick={revokePublished}
                    disabled={isBusyAction}
                    className="min-h-11 sm:ml-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                    {busy === "results" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                    Revoke / Unpublish Results
                </button>
            ) : null}
        </div>
    );

    return (
        <SideSheet
            wide
            title="Advance & Publish"
            subtitle={`${selectedSet.size} advancing (${winnersSelectedCount} winners · ${losersSelectedCount} best losers${manualExtraSelected.length ? ` · ${manualExtraSelected.length} manual` : ""})`}
            onClose={onClose}
            footer={footerContent}
        >
            <div id="inline-promotion-panel" className="space-y-4">
                {/* Step switcher + live publication state */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 text-xs font-semibold" role="tablist" aria-label="Promotion steps">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={step === "select"}
                            onClick={() => setStep("select")}
                            className={cn(
                                "min-h-9 rounded-lg px-3 transition-colors",
                                step === "select" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            1. Select ({selectedSet.size})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={step === "review"}
                            onClick={() => setStep("review")}
                            className={cn(
                                "min-h-9 rounded-lg px-3 transition-colors",
                                step === "review" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            2. Review &amp; Publish
                        </button>
                    </div>

                    <span className={cn("ax-chip text-[11px] font-bold uppercase", resultsPublished ? "ax-chip--win" : "ax-chip--warn")}>
                        {resultsPublished ? "Published (live)" : "Draft (hidden)"}
                    </span>
                </div>

                {step === "select" ? (
                    <>
                        {/* Target size & cut line toolbar */}
                        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                            <label className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">
                                <span className="mb-1 block">Target size</span>
                                <select
                                    value={String(choice)}
                                    onChange={(e) => { const v = e.target.value; setChoice(v === "auto" || v === "custom" ? v : Number(v)); setCut(null); }}
                                    className="min-h-11 rounded-lg border border-input bg-background px-2.5 text-base font-semibold normal-case tracking-normal text-foreground sm:text-sm"
                                >
                                    {TARGET_OPTIONS.map((o) => (
                                        <option key={o} value={String(o)}>{o === "auto" ? `Auto (${resolveTarget("auto", winnersCount)})` : o === "custom" ? "Custom…" : o}</option>
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
                                <button
                                    type="button"
                                    onClick={resetRecommended}
                                    title="Select all winners plus recommended best losers"
                                    className="min-h-11 inline-flex items-center gap-1 px-2 text-xs font-semibold text-primary hover:underline"
                                >
                                    <RotateCcw size={13} aria-hidden="true" />
                                    Recommended
                                </button>
                            </div>
                        </div>

                        {source === "local" && (
                            <p className="m-0 text-[11px] text-muted-foreground">Proposal service unavailable — ranked here by score.</p>
                        )}

                        {/* Round Winners (individually toggleable / revocable) */}
                        <section aria-label="Round winners" className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                    Winners ({winnersSelectedCount}/{winnerRows.length} advancing)
                                </h3>
                            </div>
                            {winnerRows.length === 0 ? (
                                <p className="m-0 text-xs text-muted-foreground">No completed winners yet.</p>
                            ) : (
                                <ul className="m-0 list-none divide-y divide-border/50 rounded-xl border border-border/70 bg-card px-2.5">
                                    {winnerRows.map((w) => {
                                        const selected = selectedSet.has(w.userId);
                                        return (
                                            <li key={w.userId} className={cn("flex min-h-12 items-center gap-2.5 py-2", !selected && "opacity-65")}>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold">{w.name}</span>
                                                    <span className="block truncate text-[11px] text-muted-foreground">
                                                        {[w.college, w.roomName].filter(Boolean).join(" · ") || "Winner"}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 font-mono text-xs tabular-nums">
                                                    {w.score ?? "–"}{w.margin != null ? ` (+${w.margin})` : ""}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUser(w.userId)}
                                                    aria-pressed={selected}
                                                    className={cn(
                                                        "min-h-10 shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                                                        selected
                                                            ? "border-emerald-600/40 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 hover:bg-rose-600/15 hover:border-rose-600/40 hover:text-rose-700"
                                                            : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200 hover:bg-emerald-600/15",
                                                    )}
                                                >
                                                    {selected ? "Advancing" : "Revoked"}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        {/* Best Losers (power selection with cut line + per-row toggle) */}
                        <section aria-label="Best losers" className="space-y-1.5">
                            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                Best Losers ({losersSelectedCount}/{candidates.length} advancing)
                            </h3>
                            {loading && !candidates.length ? (
                                <p className="m-0 text-sm text-muted-foreground">Ranking best losers…</p>
                            ) : !candidates.length ? (
                                <p className="m-0 text-sm text-muted-foreground">No losers to rank yet. Ballots must be in first.</p>
                            ) : (
                                <>
                                    <div className="md:hidden divide-y divide-border">
                                        <ul className="m-0 list-none p-0">{candidateRows}</ul>
                                    </div>
                                    <ul className="m-0 hidden list-none divide-y divide-border/50 p-0 md:block">{candidateRows}</ul>
                                </>
                            )}
                        </section>

                        {/* Manual Add — promote or revoke any enrolled participant */}
                        <section aria-label="Manual participant override" className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                            <div className="flex items-center gap-1.5">
                                <UserPlus size={14} className="text-primary" aria-hidden="true" />
                                <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                    Manual Override (Any Participant)
                                </h3>
                            </div>
                            {manualExtraSelected.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {manualExtraSelected.map((m) => (
                                        <span key={m.userId} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                                            {m.name}
                                            <button
                                                type="button"
                                                onClick={() => toggleUser(m.userId)}
                                                aria-label={`Remove ${m.name}`}
                                                className="rounded-full p-0.5 hover:bg-indigo-500/20"
                                            >
                                                <X size={12} aria-hidden="true" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <label className="relative block">
                                <span className="sr-only">Search any enrolled participant to advance manually</span>
                                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={manualQuery}
                                    onChange={(e) => setManualQuery(e.target.value)}
                                    placeholder="Search enrolled participant by name, college, or email…"
                                    className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-8 text-sm"
                                />
                                {manualQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setManualQuery("")}
                                        aria-label="Clear participant search"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded text-muted-foreground hover:bg-muted"
                                    >
                                        <X size={14} aria-hidden="true" />
                                    </button>
                                )}
                            </label>
                            {manualQuery.trim() && (
                                manualSearchResults.length === 0 ? (
                                    <p className="m-0 text-xs text-muted-foreground">No additional enrolled participants match.</p>
                                ) : (
                                    <ul className="m-0 list-none divide-y divide-border/50 rounded-lg border border-border/60 bg-card px-2.5">
                                        {manualSearchResults.map((u) => {
                                            const selected = selectedSet.has(u.id);
                                            return (
                                                <li key={u.id} className="flex min-h-11 items-center justify-between gap-2 py-1.5">
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-xs font-semibold">{fullName(u)}</span>
                                                        <span className="block truncate text-[11px] text-muted-foreground">{u.college || u.email}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleUser(u.id)}
                                                        className={cn(
                                                            "min-h-9 shrink-0 rounded-lg border px-2.5 text-xs font-semibold",
                                                            selected
                                                                ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                                                                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                                                        )}
                                                    >
                                                        {selected ? "Revoke" : "+ Advance"}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )
                            )}
                        </section>
                    </>
                ) : (
                    /* Step 2: Review & Publish */
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="ax-signal-win rounded-xl border p-3">
                                <p className="m-0 text-[11px] font-mono uppercase tracking-wider opacity-85">Advancing</p>
                                <p className="m-0 mt-1 font-display text-3xl leading-none tabular-nums">{reviewAdvancing.length}</p>
                                <p className="m-0 mt-1 text-[11px] opacity-80">
                                    {winnersSelectedCount} winners · {losersSelectedCount} best losers{manualExtraSelected.length ? ` · ${manualExtraSelected.length} manual` : ""}
                                </p>
                            </div>
                            <div className="ax-signal-loss rounded-xl border p-3">
                                <p className="m-0 text-[11px] font-mono uppercase tracking-wider opacity-85">Not Advancing</p>
                                <p className="m-0 mt-1 font-display text-3xl leading-none tabular-nums">{reviewEliminated.length}</p>
                                <p className="m-0 mt-1 text-[11px] opacity-80">Will see Game Over once published</p>
                            </div>
                        </div>

                        <section aria-label="Advancing roster review" className="space-y-1.5">
                            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                Everyone Advancing ({reviewAdvancing.length})
                            </h3>
                            {reviewAdvancing.length === 0 ? (
                                <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                                    No debaters selected to advance yet. Go back to select debaters.
                                </p>
                            ) : (
                                <ul className="m-0 list-none divide-y divide-border/50 rounded-xl border border-border/70 bg-card px-3">
                                    {reviewAdvancing.map((item) => (
                                        <li key={item.userId} className="flex min-h-12 items-center gap-2.5 py-2">
                                            <Check size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold">{item.name}</span>
                                                <span className="block truncate text-[11px] text-muted-foreground">
                                                    {[item.college, item.roomName].filter(Boolean).join(" · ")}
                                                </span>
                                            </span>
                                            <span className={cn(
                                                "ax-chip shrink-0 text-[10px] font-bold uppercase",
                                                item.category === "Winner"
                                                    ? "ax-chip--win"
                                                    : item.category === "Best Loser"
                                                        ? "ax-chip--info"
                                                        : "ax-chip--warn",
                                            )}>
                                                {item.category}
                                            </span>
                                            {item.score != null && (
                                                <span className="shrink-0 font-mono text-xs tabular-nums">{item.score}</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => toggleUser(item.userId)}
                                                className="min-h-9 shrink-0 rounded-lg border border-rose-500/35 px-2 text-[11px] font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-500/15"
                                            >
                                                Revoke
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {reviewEliminated.length > 0 && (
                            <section aria-label="Not advancing" className="space-y-1.5">
                                <h3 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                    Not Advancing ({reviewEliminated.length})
                                </h3>
                                <ul className="m-0 list-none divide-y divide-border/40 rounded-xl border border-border/60 bg-muted/20 px-3">
                                    {reviewEliminated.map((item) => (
                                        <li key={item.userId} className="flex min-h-11 items-center gap-2.5 py-1.5 opacity-80">
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-semibold">{item.name}</span>
                                                <span className="block truncate text-[11px] text-muted-foreground">{item.category}</span>
                                            </span>
                                            {item.score != null && (
                                                <span className="shrink-0 font-mono text-xs tabular-nums">{item.score}</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => toggleUser(item.userId)}
                                                className="min-h-9 shrink-0 rounded-lg border border-border bg-card px-2 text-[11px] font-semibold text-foreground hover:bg-muted"
                                            >
                                                Restore
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </SideSheet>
    );
}
