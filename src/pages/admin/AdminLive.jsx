import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Loader2, Search} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi, EventApi} from "../../services/api";
import {useRoundSocket} from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast";
import {useAdminEvent} from "../../contexts/adminEvent";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {AllocateRoomsModal} from "./AdminRoundManagement";
import {cn} from "../../lib/utils";

const STEPS = [
    {label: "Check-in", short: "Check-in"},
    {label: "Pairings", short: "Pair"},
    {label: "Rooms", short: "Rooms"},
    {label: "Publish draw", short: "Publish"},
    {label: "Results", short: "Results"},
];

const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "Unknown";
const roundWord = (status) => ({ONGOING: "live", COMPLETED: "done"}[String(status).toUpperCase()] || "upcoming");
const judgeOf = (d) => d.judgeName || (d.adjudicator ? fullName(d.adjudicator) : "");

export default function AdminLive() {
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const {event, eventId, loading: eventsLoading} = useAdminEvent();

    const [rounds, setRounds] = useState([]);
    const [roundId, setRoundId] = useState(null);
    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(""); // generating | allocating | publishing | results | checkin:<id>
    const [showAllocate, setShowAllocate] = useState(false);
    const [viewStep, setViewStep] = useState(null);
    const [search, setSearch] = useState("");
    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
    const activeRound = useRef(roundId);
    useEffect(() => { activeRound.current = roundId; }, [roundId]);

    // Rounds of the selected event
    useEffect(() => {
        if (!eventId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const token = await getTokenRef.current();
                const res = await AdminApi.apiRequest(`/rounds/event/${eventId}`, "GET", null, token);
                if (cancelled) return;
                const list = (res.success ? res.rounds || [] : []).slice().sort((a, b) => a.roundNumber - b.roundNumber);
                setRounds(list);
                const live = list.find((r) => String(r.status).toUpperCase() === "ONGOING")
                    || list.find((r) => String(r.status).toUpperCase() !== "COMPLETED")
                    || list[list.length - 1];
                setRoundId(live?.id || null);
                if (!live) setLoading(false);
            } catch {
                if (!cancelled) { toast.error("Error", "Failed to load rounds"); setLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [eventId, toast]);

    const fetchRound = useCallback(async (background = false) => {
        if (!roundId) return;
        const id = roundId;
        if (!background) setLoading(true);
        try {
            const token = await getTokenRef.current();
            const res = await AdminApi.apiRequest(`/rounds/${id}`, "GET", null, token);
            if (activeRound.current !== id || !res.success) return;
            const r = res.round;
            const [roomsRes, partsRes, perfRes] = await Promise.all([
                AdminApi.apiRequest("/rooms", "GET", null, token),
                EventApi.getParticipants(r.eventId, token),
                AdminApi.getRoundPerformers(id, token).catch(() => null),
            ]);
            if (activeRound.current !== id) return;
            setRound(r);
            setCheckIns(r.checkIns || []);
            setDebates(r.debates || []);
            setRooms(roomsRes.success ? roomsRes.rooms || [] : []);
            setUsers(partsRes.success ? partsRes.participants || [] : []);
            setResultsPublished(Boolean(perfRes?.resultsPublished));
        } catch {
            toast.error("Error", "Failed to load round data");
        } finally {
            if (activeRound.current === id) setLoading(false);
        }
    }, [roundId, toast]);

    useEffect(() => { setViewStep(null); setRound(null); fetchRound(); }, [fetchRound]);

    const refetchTimer = useRef(null);
    const softRefetch = useCallback(() => {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => fetchRound(true), 300);
    }, [fetchRound]);
    useEffect(() => () => clearTimeout(refetchTimer.current), []);

    useRoundSocket(roundId, {
        onCheckInUpdate: (data) => setCheckIns((prev) => prev.some((c) => c.userId === data.userId)
            ? prev.map((c) => c.userId === data.userId ? {...c, status: data.status} : c)
            : (softRefetch(), prev)),
        onPairingsGenerated: (data) => (data.debates ? setDebates(data.debates) : softRefetch()),
        onRoomsAllocated: softRefetch,
        onDebateResult: (data) => setDebates((prev) => prev.map((d) => d.id === data.debateId
            ? {...d, winnerId: data.winnerId, debater1Score: data.debater1Score, debater2Score: data.debater2Score, status: "COMPLETED"} : d)),
        onRoundStatusChange: (data) => setRound((prev) => (prev ? {...prev, ...data} : prev)),
        onPairingsPublished: (data) => setRound((prev) => (prev ? {...prev, pairingsPublished: data.published} : prev)),
        onRoundUpdated: (data) => { if (data.round) setRound((prev) => ({...prev, ...data.round})); },
    });

    // ----- derived round state -----
    const people = useMemo(() => {
        const merged = [...users];
        checkIns.forEach((ci) => { if (ci.user && !merged.find((u) => u.id === ci.userId)) merged.push(ci.user); });
        return merged;
    }, [users, checkIns]);
    const presentIds = useMemo(() => new Set(checkIns.filter((c) => c.status === "PRESENT").map((c) => c.userId)), [checkIns]);
    const absent = useMemo(() => people.filter((u) => !presentIds.has(u.id)), [people, presentIds]);
    const total = Math.max(people.length, checkIns.length);
    const present = presentIds.size;

    const hasDebates = debates.length > 0;
    const withRoom = debates.filter((d) => d.room).length;
    const allRooms = hasDebates && withRoom === debates.length;
    const published = Boolean(round?.pairingsPublished);
    const done = debates.filter((d) => d.status === "COMPLETED");
    const pending = debates.filter((d) => d.status !== "COMPLETED");
    const noJudge = debates.filter((d) => !judgeOf(d)).length;
    const currentStep = !hasDebates ? 0 : withRoom === 0 ? 1 : !allRooms ? 2 : !published ? 3 : 4;
    const step = viewStep ?? currentStep;
    const isRound1 = round?.roundNumber === 1;

    const q = search.trim().toLowerCase();
    const match = (...parts) => !q || parts.join(" ").toLowerCase().includes(q);

    // ----- actions (same endpoints and rules as AdminRoundManagement) -----
    const markPresent = async (userId) => {
        setBusy(`checkin:${userId}`);
        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/check-in/round/${roundId}/user/${userId}`, "PUT", {status: "PRESENT"}, token);
            if (res.success) {
                setCheckIns((prev) => prev.some((c) => c.userId === userId)
                    ? prev.map((c) => c.userId === userId ? {...c, status: "PRESENT"} : c)
                    : [...prev, {userId, status: "PRESENT"}]);
            }
        } catch { toast.error("Error", "Failed to update check-in status"); } finally { setBusy(""); }
    };

    const previewPairings = async () => {
        setBusy("preview");
        try {
            const token = await getToken();
            const res = await AdminApi.previewPairings(roundId, token);
            if (res.success) toast.info("Pairing preview", `${res.data?.pairings?.length ?? res.pairings?.length ?? res.data?.count ?? "Some"} debates would be created.`);
            else toast.error("Preview failed", res.error || "Could not preview pairings");
        } catch { toast.error("Error", "Could not preview pairings"); } finally { setBusy(""); }
    };

    const generatePairings = async () => {
        const message = hasDebates
            ? "Regenerate pairings? This will DELETE all existing pairings/debates found in this round (except completed ones). This action cannot be undone."
            : `Generate ${isRound1 ? "round 1" : "power-matched"} pairings? This will end the check-in period.`;
        if (!window.confirm(message)) return;
        setBusy("generating");
        try {
            const token = await getToken();
            const res = isRound1 ? await AdminApi.generateRound1Pairings(roundId, token) : await AdminApi.generatePowerMatchPairings(roundId, token);
            if (res.success) {
                toast.success("Pairings generated", `Created ${res.data?.pairingsCreated ?? 0} pairings.`);
                await fetchRound(true);
                setViewStep(null);
            } else toast.error("Generation failed", res.error || "Failed to generate pairings");
        } catch { toast.error("Error", "Error generating pairings"); } finally { setBusy(""); }
    };

    const allocateRooms = async (formData) => {
        setBusy("allocating");
        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/pairing/${roundId}/allocate-rooms`, "POST", formData, token);
            if (res.success) {
                toast.success("Rooms allocated", `Allocated rooms for ${res.data?.debatesAllocated || 0} debates.`);
                if (res.data?.debates) setDebates(res.data.debates); else await fetchRound(true);
                setShowAllocate(false);
                setViewStep(null);
            } else toast.error("Allocation failed", res.error || "Failed to allocate rooms");
        } catch { toast.error("Error", "Error allocating rooms"); } finally { setBusy(""); }
    };

    const togglePublish = async () => {
        setBusy("publishing");
        try {
            const token = await getToken();
            const next = !published;
            const res = await AdminApi.apiRequest(`/rounds/${roundId}`, "PUT", {pairingsPublished: next}, token);
            if (res.success) {
                setRound((r) => ({...r, pairingsPublished: next}));
                toast.success("Visibility updated", next ? "The draw is now visible to debaters." : "The draw is now hidden from debaters.");
                setViewStep(null);
            }
        } catch { toast.error("Error", "Failed to toggle publish status"); } finally { setBusy(""); }
    };

    const publishResults = async () => {
        setBusy("results");
        try {
            const token = await getToken();
            const res = await AdminApi.publishResults(roundId, !resultsPublished, token);
            if (res.success) {
                setResultsPublished(!resultsPublished);
                toast.success("Results", !resultsPublished ? "Results are now public." : "Results are hidden again.");
            } else toast.error("Error", res.error || "Could not change results visibility");
        } catch { toast.error("Error", "Could not change results visibility"); } finally { setBusy(""); }
    };

    // ----- "Do this next", computed from state -----
    const next = (() => {
        if (currentStep === 0) return {
            title: "Close check-in & draw",
            body: `${present} of ${total} debaters are present. Closing check-in locks the list and generates ${isRound1 ? "random" : "power-matched"} pairings.`,
            cta: "Close check-in → pair", run: generatePairings, working: busy === "generating", disabled: present === 0,
        };
        if (currentStep === 1) return {
            title: "Confirm pairings",
            body: `${debates.length} debates drafted. Review them, then allocate rooms.`,
            cta: "Allocate rooms", run: () => setShowAllocate(true), working: busy === "allocating",
        };
        if (currentStep === 2) return {
            title: "Finish room allocation",
            body: `${withRoom} of ${debates.length} debates have a room. Allocate the rest to continue.`,
            cta: "Allocate rooms", run: () => setShowAllocate(true), working: busy === "allocating",
        };
        if (currentStep === 3) return {
            title: "Publish the draw",
            body: `Debaters get their room, side and opponent instantly.${noJudge ? ` ${noJudge} debate${noJudge === 1 ? "" : "s"} still need a judge; you can assign later.` : ""}`,
            cta: "Publish draw", run: togglePublish, working: busy === "publishing",
        };
        if (pending.length > 0) return {
            title: "Collect ballots",
            body: `${pending.length} ballot${pending.length === 1 ? "" : "s"} outstanding.`,
            cta: "Enter next result", run: () => navigate(`/admin/results/${pending[0].id}`),
        };
        return {
            title: resultsPublished ? "Promote debaters" : "Publish results",
            body: resultsPublished ? "Results are public. Review the top performers and promote them to the next round." : "All ballots are in. Make results public, then promote.",
            cta: resultsPublished ? "Review & promote" : "Publish results", run: resultsPublished ? () => navigate(`/admin/rounds/${roundId}/promotion`) : publishResults, working: busy === "results",
        };
    })();

    // ----- render -----
    if (eventsLoading || (loading && !round && roundId)) return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Loading live round" /></div>;
    if (!event) return <EmptyBlock title="No event yet" body="Create an event and its rounds to run it from here." to="/admin/events" cta="Set up an event" />;
    if (!rounds.length || !round) return <EmptyBlock title={`${event.name} has no rounds yet`} body="Add the first round, then come back to run check-in, pairings and results." to={`/admin/events/${event.id}`} cta="Add a round" />;

    const stepState = (i) => (i < currentStep ? "Done" : i === currentStep ? "Now" : "Next");
    const sideNote = [
        withRoom < debates.length && hasDebates ? {text: `${debates.length - withRoom} debate${debates.length - withRoom === 1 ? "" : "s"} without a room`, to: `/admin/rounds/${roundId}`, cta: "allocate"} : null,
        allRooms && noJudge ? {text: `${noJudge} debate${noJudge === 1 ? "" : "s"} without a judge`, to: `/admin/rounds/${roundId}`, cta: "assign"} : null,
    ].filter(Boolean);

    return (
        <div className="mx-auto max-w-[1180px] font-sans">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{event.name}</p>
                    <h1 className="font-display text-[44px] font-normal leading-[0.95] text-primary md:text-[56px]">{round.name || `Round ${round.roundNumber}`} — {roundWord(round.status)}</h1>
                </div>
                <label className="relative block w-full md:w-72">
                    <span className="sr-only">Find a debater or room</span>
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a debater or room" className="h-11 w-full rounded-xl border-[1.5px] border-input bg-card pl-9 pr-3 text-[15px]" />
                </label>
            </div>

            <div role="tablist" aria-label="Rounds" className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {rounds.map((r) => (
                    <button key={r.id} type="button" role="tab" aria-selected={r.id === roundId} onClick={() => setRoundId(r.id)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold", r.id === roundId ? "border-[#1E3B2F] bg-[#1E3B2F] text-[#F4EAD5] dark:border-[#FF3EA5] dark:bg-[#FF3EA5] dark:text-[#142A21]" : "border-input bg-card text-foreground")}>
                        Round {r.roundNumber} · {roundWord(r.status)}
                    </button>
                ))}
                <Link to={`/admin/events/${event.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-dashed border-input px-4 text-sm font-semibold text-primary">+ Add round</Link>
            </div>

            <ol aria-label="Round steps" className="m-0 mb-4 grid list-none grid-cols-5 gap-1.5 p-0 md:gap-2.5">
                {STEPS.map((s, i) => {
                    const isCurrent = i === step;
                    return (
                        <li key={s.label}>
                            <button type="button" onClick={() => setViewStep(i)} aria-current={i === currentStep ? "step" : undefined} className={cn("flex min-h-12 w-full flex-col items-start gap-0.5 rounded-xl border px-2 py-2 text-left md:px-3.5", isCurrent ? "border-2 border-[#1E3B2F] bg-[#1E3B2F] text-[#F4EAD5] dark:border-[#FF3EA5] dark:bg-[#2B5241]" : i < currentStep ? "border-transparent bg-[#EBDFC4] text-[#142A21] dark:bg-[#2B5241] dark:text-[#EBDFC4]" : "border-border bg-card text-foreground")}>
                                <span className="hidden text-[11px] font-bold uppercase tracking-[0.06em] opacity-80 md:block">0{i + 1} · {stepState(i)}</span>
                                <span className="text-[12px] font-bold md:text-[15px]"><span className="md:hidden">{s.short}</span><span className="hidden md:inline">{s.label}</span></span>
                                <span aria-hidden="true" className={cn("mt-1 h-1 w-full rounded-full md:hidden", i <= currentStep ? "bg-[#FF3EA5]" : "bg-border")} />
                            </button>
                        </li>
                    );
                })}
            </ol>

            <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
                <section aria-label="Step detail" className="ax-card order-2 p-4 md:p-6 lg:order-1">
                    {step === 0 && <CheckInPanel present={present} total={total} absent={absent.filter((u) => match(fullName(u), u.college))} busy={busy} onMark={markPresent} onPreview={previewPairings} />}
                    {step === 1 && <PairingsPanel round={round} debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))} onRegenerate={generatePairings} regenerating={busy === "generating"} hasDebates={hasDebates} />}
                    {step === 2 && <RoomsPanel debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))} onAllocate={() => setShowAllocate(true)} hasDebates={hasDebates} noJudge={noJudge} roundId={roundId} />}
                    {step === 3 && <PublishPanel checks={[
                        {ok: Boolean(round.motion), text: round.motion ? "Motion set" : "Motion not set (add it in round tools)"},
                        {ok: hasDebates, text: `${debates.length} debate${debates.length === 1 ? "" : "s"} paired`},
                        {ok: allRooms, text: `${withRoom} of ${debates.length} rooms allocated`},
                        {ok: noJudge === 0, optional: true, text: `${debates.length - noJudge} of ${debates.length} judges assigned`},
                    ]} published={published} />}
                    {step === 4 && <ResultsPanel done={done.length} total={debates.length} pending={pending.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))} resultsPublished={resultsPublished} roundId={roundId} />}
                </section>

                <aside aria-label="Next action" className="order-1 flex flex-col gap-3 lg:order-2">
                    <div className="rounded-[20px] bg-[#1E3B2F] p-5 text-[#F4EAD5] dark:bg-[#2B5241]">
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#FF8CC8]">Do this next</p>
                        <h2 className="mt-1.5 font-heading text-2xl font-bold leading-tight text-[#F4EAD5]">{next.title}</h2>
                        <p className="m-0 mt-2 text-[15px] leading-normal text-[#E4E0D6]">{next.body}</p>
                        <button type="button" onClick={next.run} disabled={next.working || next.disabled} className="mt-4 hidden min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#F4EAD5] px-4 text-base font-bold text-[#1E3B2F] hover:bg-white disabled:opacity-60 md:flex">
                            {next.working && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{next.cta}
                        </button>
                    </div>
                    {sideNote.length > 0 && (
                        <div className="ax-card p-4 text-sm">
                            <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Needs attention</p>
                            {sideNote.map((n) => <p key={n.text} className="m-0 mb-1.5 text-foreground">{n.text} · <Link className="font-semibold text-primary underline underline-offset-2" to={n.to}>{n.cta}</Link></p>)}
                        </div>
                    )}
                    <Link to={`/admin/rounds/${roundId}`} className="text-center text-sm font-semibold text-primary underline underline-offset-4">Open full round tools</Link>
                </aside>
            </div>

            {/* Sticky primary action, phones only (sits above the tab bar) */}
            <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background px-4 py-3 md:hidden">
                <button type="button" onClick={next.run} disabled={next.working || next.disabled} className="ax-primary-btn w-full">
                    {next.working && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{next.cta}
                </button>
            </div>

            {showAllocate && <AllocateRoomsModal onClose={() => setShowAllocate(false)} onConfirm={allocateRooms} totalDebates={debates.length} rooms={rooms} loading={busy === "allocating"} />}
        </div>
    );
}

function EmptyBlock({title, body, to, cta}) {
    return (
        <div className="ax-card mx-auto mt-10 max-w-lg p-8 text-center">
            <h1 className="font-display text-4xl font-normal text-primary">{title}</h1>
            <p className="mb-5 mt-2 text-muted-foreground">{body}</p>
            <Link to={to} className="ax-primary-btn">{cta}</Link>
        </div>
    );
}

function Stat({label, value, of}) {
    return (
        <div className="rounded-2xl bg-muted/60 p-3.5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
            <p className="m-0 mt-1 font-display text-4xl leading-none text-primary">{value}{of != null && <span className="font-sans text-base text-muted-foreground"> / {of}</span>}</p>
        </div>
    );
}

function CheckInPanel({present, total, absent, busy, onMark, onPreview}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2.5">
                <Stat label="Present" value={present} of={total} />
                <Stat label="Not checked in" value={Math.max(total - present, 0)} />
                <Stat label="Registered" value={total} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-xl font-bold">Still to check in</h2>
                <button type="button" onClick={onPreview} disabled={busy === "preview"} className="ax-ghost-btn">{busy === "preview" ? "Previewing…" : "Preview pairings"}</button>
            </div>
            {absent.length === 0 ? <p className="m-0 text-muted-foreground">Everyone is checked in.</p> : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {absent.slice(0, 60).map((u) => (
                        <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                            <div className="min-w-0 flex-1"><p className="m-0 truncate font-semibold">{fullName(u)}</p><p className="m-0 truncate text-sm text-muted-foreground">{u.college || "No college"}</p></div>
                            <button type="button" onClick={() => onMark(u.id)} disabled={busy === `checkin:${u.id}`} className="ax-ghost-btn !min-h-11">{busy === `checkin:${u.id}` ? "…" : "Mark present"}</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PairingsPanel({round, debates, onRegenerate, regenerating, hasDebates}) {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <p className="m-0 text-sm font-semibold text-muted-foreground">Motion</p>
                <p className="m-0 mt-1 text-lg font-semibold">{round.motion || "No motion set yet"}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-xl font-bold">{round.roundNumber === 1 ? "Draft pairings" : "Draft pairings · power-matched"}</h2>
                {hasDebates && <button type="button" onClick={onRegenerate} disabled={regenerating} className="ax-ghost-btn">{regenerating ? "Regenerating…" : "Regenerate"}</button>}
            </div>
            {!hasDebates ? <p className="m-0 text-muted-foreground">No pairings yet. Close check-in to generate them.</p> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[15px]">
                        <thead><tr className="text-xs uppercase tracking-[0.06em] text-muted-foreground"><th scope="col" className="py-2 pr-3">#</th><th scope="col" className="py-2 pr-3">Proposition</th><th scope="col" className="py-2 pr-3">Opposition</th><th scope="col" className="py-2">Room</th></tr></thead>
                        <tbody>{debates.slice(0, 100).map((d, i) => (
                            <tr key={d.id}><td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td><td className="py-2.5 pr-3 font-semibold">{fullName(d.debater1)}</td><td className="py-2.5 pr-3 font-semibold">{fullName(d.debater2)}</td><td className="py-2.5">{d.room?.name || <span className="ax-chip ax-chip--warn">None</span>}</td></tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function RoomsPanel({debates, onAllocate, hasDebates, noJudge, roundId}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-xl font-bold">Rooms</h2>
                {hasDebates && <button type="button" onClick={onAllocate} className="ax-ghost-btn">Allocate rooms</button>}
            </div>
            {!hasDebates ? <p className="m-0 text-muted-foreground">Generate pairings first.</p> : (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {debates.slice(0, 100).map((d) => (
                        <div key={d.id} className="rounded-2xl border border-border p-3.5">
                            <p className="m-0 font-heading text-lg font-bold text-primary">{d.room?.name || "Unallocated"}</p>
                            <p className="m-0 mt-0.5 text-sm font-semibold">{fullName(d.debater1)} vs {fullName(d.debater2)}</p>
                            <p className="m-0 mt-1 text-sm text-muted-foreground">Judge: {judgeOf(d) || "Unassigned"}</p>
                        </div>
                    ))}
                </div>
            )}
            {noJudge > 0 && <p className="m-0 text-sm text-muted-foreground">{noJudge} debate{noJudge === 1 ? "" : "s"} have no judge yet. <Link className="font-semibold text-primary underline underline-offset-2" to={`/admin/rounds/${roundId}`}>Assign in round tools</Link>.</p>}
        </div>
    );
}

function PublishPanel({checks, published}) {
    return (
        <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl font-bold">{published ? "The draw is public" : "Ready to publish?"}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {checks.map((c) => (
                    <li key={c.text} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-3", c.ok ? "ax-chip--ok" : "ax-chip--warn")} style={{borderRadius: 12}}>
                        <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-black/10 text-sm font-bold">{c.ok ? "✓" : "!"}</span>
                        <span className="text-[15px] font-semibold">{c.text}{!c.ok && c.optional ? " (optional)" : ""}</span>
                    </li>
                ))}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">Publishing sends every debater their room and opponent on their phone instantly. Use the button again to hide the draw.</p>
        </div>
    );
}

function ResultsPanel({done, total, pending, resultsPublished, roundId}) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between"><h2 className="font-heading text-xl font-bold">Ballots in</h2><p className="m-0 font-display text-3xl text-primary">{done} / {total}</p></div>
            <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#FF3EA5]" style={{width: `${pct}%`}} /></div>
            {pending.length === 0 ? (
                <p className="m-0 text-muted-foreground">{done === 0 ? "No debates to score yet." : resultsPublished ? "All ballots are in and results are public." : "All ballots are in. Publish results from the panel."} <Link className="font-semibold text-primary underline underline-offset-2" to={`/admin/rounds/${roundId}/promotion`}>Review & promote</Link></p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {pending.slice(0, 60).map((d) => (
                        <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                            <span className="w-14 shrink-0 font-heading font-bold text-primary">{d.room?.name || "—"}</span>
                            <span className="min-w-0 flex-1 truncate text-[15px]">{fullName(d.debater1)} vs {fullName(d.debater2)}</span>
                            <Link to={`/admin/results/${d.id}`} className="ax-ghost-btn !min-h-11">Enter result</Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
