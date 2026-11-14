import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Loader2, Search, X, Edit3, Check, Trophy, Plus, ChevronDown} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi, EventApi} from "../../services/api";
import {useRoundSocket, useLiveRefresh} from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast";
import {useAdminEvent} from "../../contexts/adminEvent";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import InlineResultSheet from "../../components/admin/InlineResultSheet";
import {cn} from "../../lib/utils";

const AllocateRoomsModal = lazy(() => import("./AdminRoundManagement").then((m) => ({default: m.AllocateRoomsModal})));

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
    const {events, event, eventId, setEventId, loading: eventsLoading} = useAdminEvent();

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
    const [showQuickRound, setShowQuickRound] = useState(false);
    const [scoringDebate, setScoringDebate] = useState(null);
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

    useLiveRefresh(() => fetchRound(true));

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
        onResultsPublished: (data) => setResultsPublished(Boolean(data.published)),
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
    const present = presentIds.size;
    const total = people.length;

    const hasDebates = debates.length > 0;
    const withRoom = debates.filter((d) => d.roomId && d.room).length;
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
            const nextVal = !published;
            const res = await AdminApi.apiRequest(`/rounds/${roundId}`, "PUT", {pairingsPublished: nextVal}, token);
            if (res.success) {
                setRound((r) => ({...r, pairingsPublished: nextVal}));
                toast.success("Visibility updated", nextVal ? "The draw is now visible to debaters." : "The draw is now hidden from debaters.");
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

    const saveMotion = async (newMotion) => {
        try {
            const token = await getToken();
            const res = await AdminApi.updateRound(roundId, {motion: newMotion}, token);
            if (res.success) {
                setRound((r) => ({...r, motion: newMotion}));
                toast.success("Motion Saved", "Round motion updated.");
            } else {
                toast.error("Error", res.error || "Failed to update motion");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Failed to update motion");
        }
    };

    const handleSaveResult = async ({debateId, debater1Score, debater2Score, winnerId, nextDebate}) => {
        const token = await getToken();
        const res = await AdminApi.submitResult(debateId, {debater1Score, debater2Score, winnerId}, token);
        if (!res.success) {
            throw new Error(res.error || "Failed to submit result");
        }
        setDebates((prev) => prev.map((d) => d.id === debateId ? {
            ...d,
            debater1Score,
            debater2Score,
            winnerId,
            status: "COMPLETED"
        } : d));
        toast.success("Result Saved", "Ballot recorded with winner tag.");
        if (nextDebate) {
            setScoringDebate(nextDebate);
        } else {
            setScoringDebate(null);
        }
        softRefetch();
    };

    const handleRoundCreated = (newRound) => {
        setRounds((prev) => [...prev, newRound].sort((a, b) => a.roundNumber - b.roundNumber));
        setRoundId(newRound.id);
        setShowQuickRound(false);
        toast.success("Round Created", `Switched to Round ${newRound.roundNumber}.`);
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
            body: `${pending.length} ballot${pending.length === 1 ? "" : "s"} outstanding. Higher score auto-tags winner.`,
            cta: "Score next debate", run: () => setScoringDebate(pending[0]),
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
    if (!rounds.length || !round) return (
        <div className="ax-card mx-auto mt-10 max-w-lg p-8 text-center space-y-4">
            <h1 className="font-display text-4xl font-normal text-primary">{event.name} has no rounds yet</h1>
            <p className="text-muted-foreground text-sm">Add the first round to begin tournament check-in, pairings, and ballots.</p>
            <button
                type="button"
                onClick={() => setShowQuickRound(true)}
                className="ax-primary-btn mx-auto"
            >
                + Add Round 1
            </button>
            {showQuickRound && (
                <QuickCreateRoundModal
                    eventId={event.id}
                    defaultRoundNumber={1}
                    onClose={() => setShowQuickRound(false)}
                    onCreated={handleRoundCreated}
                />
            )}
        </div>
    );

    const stepState = (i) => (i < currentStep ? "Done" : i === currentStep ? "Now" : "Next");
    const sideNote = [
        withRoom < debates.length && hasDebates ? {text: `${debates.length - withRoom} debate${debates.length - withRoom === 1 ? "" : "s"} without a room`, to: `/admin/rounds/${roundId}`, cta: "allocate"} : null,
        allRooms && noJudge ? {text: `${noJudge} debate${noJudge === 1 ? "" : "s"} without a judge`, to: `/admin/rounds/${roundId}`, cta: "assign"} : null,
    ].filter(Boolean);

    return (
        <div className="mx-auto max-w-[1180px] font-sans space-y-4">
            {/* Header: Event Switcher + Round Title */}
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Tournament</span>
                        {events?.length > 1 && (
                            <select
                                aria-label="Select tournament"
                                value={eventId || ""}
                                onChange={(e) => setEventId(e.target.value)}
                                className="h-7 px-2 rounded-md border border-border bg-card text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            >
                                {events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.name} ({ev.status})
                                    </option>
                                ))}
                            </select>
                        )}
                        {events?.length <= 1 && (
                            <span className="text-xs font-bold text-foreground">{event.name}</span>
                        )}
                    </div>
                    <h1 className="font-display text-[38px] md:text-[50px] font-normal leading-tight text-primary">
                        {round.name || `Round ${round.roundNumber}`} — {roundWord(round.status)}
                    </h1>
                </div>

                <label className="relative block w-full sm:w-72">
                    <span className="sr-only">Find a debater or room</span>
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find debater or room"
                        className="h-11 w-full rounded-xl border-[1.5px] border-input bg-card pl-9 pr-9 text-sm"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </label>
            </div>

            {/* Rounds selector pills + Quick Add Round */}
            <div role="tablist" aria-label="Rounds" className="no-scrollbar flex gap-2 overflow-x-auto pb-1 items-center">
                {rounds.map((r) => (
                    <button
                        key={r.id}
                        type="button"
                        role="tab"
                        aria-selected={r.id === roundId}
                        onClick={() => setRoundId(r.id)}
                        className={cn(
                            "min-h-11 shrink-0 rounded-full border px-4 text-xs sm:text-sm font-semibold transition-all",
                            r.id === roundId
                                ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#B9F5D8] dark:text-[#141510] shadow-xs"
                                : "border-input bg-card text-foreground hover:bg-muted"
                        )}
                    >
                        Round {r.roundNumber} · {roundWord(r.status)}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setShowQuickRound(true)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/50 bg-primary/5 px-4 text-xs sm:text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
                >
                    <Plus size={14} /> Add round
                </button>
            </div>

            {/* 5-step Pipeline indicator */}
            <ol aria-label="Round steps" className="m-0 grid list-none grid-cols-5 gap-1.5 p-0 md:gap-2.5">
                {STEPS.map((s, i) => {
                    const isCurrent = i === step;
                    return (
                        <li key={s.label} className="min-w-0">
                            <button
                                type="button"
                                onClick={() => setViewStep(i)}
                                aria-current={i === currentStep ? "step" : undefined}
                                className={cn(
                                    "flex min-h-12 w-full flex-col items-start gap-0.5 rounded-xl border px-1.5 py-2 text-left sm:px-2 md:px-3.5 transition-all",
                                    isCurrent
                                        ? "border-2 border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#3A3E34]"
                                        : i < currentStep
                                        ? "border-transparent bg-[#D4EDE1] text-[#141510] dark:bg-[#3A3E34] dark:text-[#D4EDE1]"
                                        : "border-border bg-card text-foreground"
                                )}
                            >
                                <span className="hidden text-[11px] font-bold uppercase tracking-[0.06em] opacity-80 md:block">
                                    0{i + 1} · {stepState(i)}
                                </span>
                                <span className="w-full truncate whitespace-nowrap text-[11px] font-bold sm:text-[12px] md:text-[14px]">
                                    <span className="md:hidden">{s.short}</span>
                                    <span className="hidden md:inline">{s.label}</span>
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-1 h-1 w-full rounded-full md:hidden",
                                        i <= currentStep ? "bg-[#B9F5D8]" : "bg-border"
                                    )}
                                />
                            </button>
                        </li>
                    );
                })}
            </ol>

            {/* Main Operational Surface + Next Action Sidebar */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section aria-label="Step detail" className="ax-card order-2 min-w-0 p-4 md:p-6 lg:order-1">
                    {step === 0 && (
                        <CheckInPanel
                            present={present}
                            total={total}
                            absent={absent.filter((u) => match(fullName(u), u.college, u.mobile, u.usn, u.email))}
                            busy={busy}
                            onMark={markPresent}
                            onPreview={previewPairings}
                        />
                    )}
                    {step === 1 && (
                        <PairingsPanel
                            round={round}
                            debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            onRegenerate={generatePairings}
                            onSaveMotion={saveMotion}
                            regenerating={busy === "generating"}
                            hasDebates={hasDebates}
                        />
                    )}
                    {step === 2 && (
                        <RoomsPanel
                            debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            onAllocate={() => setShowAllocate(true)}
                            hasDebates={hasDebates}
                            noJudge={noJudge}
                            roundId={roundId}
                        />
                    )}
                    {step === 3 && (
                        <PublishPanel
                            checks={[
                                {ok: Boolean(round.motion), text: round.motion ? `Motion: "${round.motion}"` : "Motion not set"},
                                {ok: hasDebates, text: `${debates.length} debate${debates.length === 1 ? "" : "s"} paired`},
                                {ok: allRooms, text: `${withRoom} of ${debates.length} rooms allocated`},
                                {ok: noJudge === 0, optional: true, text: `${debates.length - noJudge} of ${debates.length} judges assigned`},
                            ]}
                            published={published}
                            onSaveMotion={saveMotion}
                            currentMotion={round.motion}
                        />
                    )}
                    {step === 4 && (
                        <ResultsPanel
                            done={done.length}
                            total={debates.length}
                            pending={pending.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            completed={done.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            resultsPublished={resultsPublished}
                            roundId={roundId}
                            onScoreDebate={(d) => setScoringDebate(d)}
                            onPublishResults={publishResults}
                            busy={busy === "results"}
                        />
                    )}
                </section>

                <aside aria-label="Next action" className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
                    <div className="rounded-[20px] bg-[#1D1E18] p-5 text-[#EAFBF5] dark:bg-[#3A3E34] shadow-md">
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">Do this next</p>
                        <h2 className="mt-1.5 font-heading text-2xl font-bold leading-tight text-[#EAFBF5]">{next.title}</h2>
                        <p className="m-0 mt-2 text-[14px] leading-normal text-[#BDD9CA]">{next.body}</p>
                        <button
                            type="button"
                            onClick={next.run}
                            disabled={next.working || next.disabled}
                            className="mt-4 hidden min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#EAFBF5] px-4 text-sm font-bold text-[#1D1E18] hover:bg-white disabled:opacity-60 transition-colors md:flex shadow-xs"
                        >
                            {next.working && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                            {next.cta}
                        </button>
                    </div>

                    {sideNote.length > 0 && (
                        <div className="ax-card p-4 text-xs space-y-1.5">
                            <p className="m-0 mb-1 font-bold uppercase tracking-[0.08em] text-muted-foreground">Needs attention</p>
                            {sideNote.map((n) => (
                                <p key={n.text} className="m-0 text-foreground">
                                    {n.text} ·{" "}
                                    <Link className="font-semibold text-primary underline underline-offset-2" to={n.to}>
                                        {n.cta}
                                    </Link>
                                </p>
                            ))}
                        </div>
                    )}
                    <Link to={`/admin/rounds/${roundId}`} className="text-center text-xs font-semibold text-primary underline underline-offset-4">
                        Open advanced round tools →
                    </Link>
                </aside>
            </div>

            {/* Sticky primary action, phones only */}
            <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background px-4 py-3 md:hidden shadow-lg">
                <button
                    type="button"
                    onClick={next.run}
                    disabled={next.working || next.disabled}
                    className="ax-primary-btn w-full"
                >
                    {next.working && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    {next.cta}
                </button>
            </div>

            {/* Room allocation modal */}
            {showAllocate && (
                <Suspense fallback={null}>
                    <AllocateRoomsModal
                        onClose={() => setShowAllocate(false)}
                        onConfirm={allocateRooms}
                        totalDebates={debates.length}
                        rooms={rooms}
                        loading={busy === "allocating"}
                    />
                </Suspense>
            )}

            {/* Inline fast ballot scoring sheet with auto-winner */}
            {scoringDebate && (
                <InlineResultSheet
                    debate={scoringDebate}
                    debates={debates}
                    onSave={handleSaveResult}
                    onClose={() => setScoringDebate(null)}
                />
            )}

            {/* Quick create round modal */}
            {showQuickRound && (
                <QuickCreateRoundModal
                    eventId={event.id}
                    defaultRoundNumber={rounds.length + 1}
                    onClose={() => setShowQuickRound(false)}
                    onCreated={handleRoundCreated}
                />
            )}
        </div>
    );
}

function EmptyBlock({title, body, to, cta}) {
    return (
        <div className="ax-card mx-auto mt-10 max-w-lg p-8 text-center">
            <h1 className="font-display text-4xl font-normal text-primary">{title}</h1>
            <p className="mb-5 mt-2 text-muted-foreground text-sm">{body}</p>
            <Link to={to} className="ax-primary-btn">{cta}</Link>
        </div>
    );
}

function Stat({label, value, of}) {
    return (
        <div className="rounded-2xl bg-muted/60 p-3.5 border border-border/50">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
            <p className="m-0 mt-1 font-display text-3xl leading-none text-primary">
                {value}{of != null && <span className="font-sans text-xs text-muted-foreground"> / {of}</span>}
            </p>
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <h2 className="font-heading text-lg font-bold">Still to check in ({absent.length})</h2>
                <button type="button" onClick={onPreview} disabled={busy === "preview"} className="ax-ghost-btn !text-xs">
                    {busy === "preview" ? "Previewing…" : "Preview pairings"}
                </button>
            </div>
            {absent.length === 0 ? (
                <p className="m-0 text-muted-foreground text-sm">Everyone is checked in. Ready to pair.</p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0 max-h-[460px] overflow-y-auto">
                    {absent.slice(0, 60).map((u) => (
                        <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 bg-card/60">
                            <div className="min-w-0 flex-1">
                                <p className="m-0 truncate font-semibold text-sm">{fullName(u)}</p>
                                <p className="m-0 truncate text-xs text-muted-foreground">{u.college || "No college"}{u.usn ? ` · ${u.usn}` : ""}</p>
                                <p className="m-0 truncate text-xs text-muted-foreground tabular-nums">
                                    {u.mobile ? <a href={`tel:${u.mobile}`} className="font-medium text-foreground hover:underline">{u.mobile}</a> : "No phone"}
                                    {u.email ? ` · ${u.email}` : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onMark(u.id)}
                                disabled={busy === `checkin:${u.id}`}
                                className="ax-ghost-btn !min-h-10 !text-xs shrink-0"
                            >
                                {busy === `checkin:${u.id}` ? "…" : "Mark present"}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PairingsPanel({round, debates, onRegenerate, onSaveMotion, regenerating, hasDebates}) {
    const [editingMotion, setEditingMotion] = useState(false);
    const [motionDraft, setMotionDraft] = useState(round.motion || "");

    return (
        <div className="flex flex-col gap-4">
            {/* Inline Motion Editor */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Round Motion</span>
                    {!editingMotion && (
                        <button
                            type="button"
                            onClick={() => {
                                setMotionDraft(round.motion || "");
                                setEditingMotion(true);
                            }}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                        >
                            <Edit3 size={12} />
                            {round.motion ? "Edit Motion" : "Set Motion"}
                        </button>
                    )}
                </div>

                {editingMotion ? (
                    <div className="space-y-2">
                        <textarea
                            value={motionDraft}
                            onChange={(e) => setMotionDraft(e.target.value)}
                            placeholder="e.g. This House would abolish carbon offsets."
                            className="w-full p-2.5 text-sm rounded-lg border border-input bg-card text-foreground font-medium outline-none"
                            rows={2}
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditingMotion(false)}
                                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await onSaveMotion(motionDraft.trim());
                                    setEditingMotion(false);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                            >
                                Save Motion
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-foreground">
                        {round.motion || <span className="text-muted-foreground italic">No motion set yet</span>}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <h2 className="font-heading text-lg font-bold">
                    {round.roundNumber === 1 ? "Draft pairings" : "Draft pairings · power-matched"} ({debates.length})
                </h2>
                {hasDebates && (
                    <button type="button" onClick={onRegenerate} disabled={regenerating} className="ax-ghost-btn !text-xs">
                        {regenerating ? "Regenerating…" : "Regenerate pairings"}
                    </button>
                )}
            </div>

            {!hasDebates ? (
                <p className="m-0 text-muted-foreground text-sm">No pairings yet. Close check-in to generate them.</p>
            ) : (
                <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-[0.06em] text-muted-foreground border-b border-border">
                                <th scope="col" className="py-2 pr-3">#</th>
                                <th scope="col" className="py-2 pr-3">Proposition</th>
                                <th scope="col" className="py-2 pr-3">Opposition</th>
                                <th scope="col" className="py-2">Room</th>
                            </tr>
                        </thead>
                        <tbody>
                            {debates.slice(0, 100).map((d, i) => (
                                <tr key={d.id} className="border-b border-border/40 hover:bg-muted/30">
                                    <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                                    <td className="py-2.5 pr-3 font-semibold text-foreground">{fullName(d.debater1)}</td>
                                    <td className="py-2.5 pr-3 font-semibold text-foreground">{fullName(d.debater2)}</td>
                                    <td className="py-2.5">{d.room?.name || <span className="ax-chip ax-chip--warn">None</span>}</td>
                                </tr>
                            ))}
                        </tbody>
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
                <h2 className="font-heading text-lg font-bold">Rooms &amp; Venues</h2>
                {hasDebates && (
                    <button type="button" onClick={onAllocate} className="ax-ghost-btn !text-xs">
                        Allocate rooms
                    </button>
                )}
            </div>
            {!hasDebates ? (
                <p className="m-0 text-muted-foreground text-sm">Generate pairings first.</p>
            ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 max-h-[460px] overflow-y-auto">
                    {debates.slice(0, 100).map((d) => (
                        <div key={d.id} className="rounded-xl border border-border p-3.5 bg-card/60">
                            <p className="m-0 font-heading text-base font-bold text-primary">{d.room?.name || "Unallocated"}</p>
                            <p className="m-0 mt-0.5 text-xs font-semibold truncate">{fullName(d.debater1)} vs {fullName(d.debater2)}</p>
                            <p className="m-0 mt-1 text-xs text-muted-foreground truncate">Judge: {judgeOf(d) || "Unassigned"}</p>
                        </div>
                    ))}
                </div>
            )}
            {noJudge > 0 && (
                <p className="m-0 text-xs text-muted-foreground">
                    {noJudge} debate{noJudge === 1 ? "" : "s"} have no judge yet.{" "}
                    <Link className="font-semibold text-primary underline" to={`/admin/rounds/${roundId}`}>
                        Assign in round tools
                    </Link>.
                </p>
            )}
        </div>
    );
}

function PublishPanel({checks, published, onSaveMotion, currentMotion}) {
    const [editingMotion, setEditingMotion] = useState(false);
    const [motionDraft, setMotionDraft] = useState(currentMotion || "");

    return (
        <div className="flex flex-col gap-4">
            <h2 className="font-heading text-lg font-bold">
                {published ? "The draw is live and visible to participants" : "Ready to publish draw?"}
            </h2>

            {!currentMotion && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
                    <p className="font-bold text-amber-700 dark:text-amber-300">Motion not set for this round.</p>
                    {editingMotion ? (
                        <div className="space-y-2">
                            <input
                                value={motionDraft}
                                onChange={(e) => setMotionDraft(e.target.value)}
                                placeholder="Enter round motion"
                                className="w-full p-2 text-xs rounded border border-border bg-card"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await onSaveMotion(motionDraft.trim());
                                        setEditingMotion(false);
                                    }}
                                    className="px-3 py-1 bg-primary text-primary-foreground font-bold rounded text-xs"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingMotion(false)}
                                    className="px-2 py-1 text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setMotionDraft(currentMotion || "");
                                setEditingMotion(true);
                            }}
                            className="font-bold text-primary underline"
                        >
                            Set motion now →
                        </button>
                    )}
                </div>
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {checks.map((c) => (
                    <li
                        key={c.text}
                        className={cn(
                            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold border",
                            c.ok
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        )}
                    >
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-black/10 text-xs font-bold shrink-0">
                            {c.ok ? "✓" : "!"}
                        </span>
                        <span className="truncate">{c.text}{!c.ok && c.optional ? " (optional)" : ""}</span>
                    </li>
                ))}
            </ul>
            <p className="m-0 text-xs text-muted-foreground">
                Publishing sends each debater their room, side, and opponent instantly on their dashboard.
            </p>
        </div>
    );
}

function ResultsPanel({done, total, pending, completed, resultsPublished, roundId, onScoreDebate, onPublishResults, busy}) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
                <div>
                    <h2 className="font-heading text-lg font-bold text-foreground">Ballot Scorecards</h2>
                    <p className="text-xs text-muted-foreground">Higher score automatically receives winner tag.</p>
                </div>
                <p className="m-0 font-display text-2xl sm:text-3xl text-primary">
                    {done} / {total}
                </p>
            </div>

            <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-[#B9F5D8] transition-all duration-300"
                    style={{width: `${pct}%`}}
                />
            </div>

            {/* Pending ballots */}
            {pending.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Pending Ballots ({pending.length})
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 max-h-[320px] overflow-y-auto">
                        {pending.slice(0, 60).map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 bg-card/60">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-primary font-mono">{d.room?.name || "Room TBD"}</span>
                                        {d.judgeName && <span className="text-[11px] text-muted-foreground">({d.judgeName})</span>}
                                    </div>
                                    <p className="m-0 truncate text-sm font-semibold text-foreground">
                                        {fullName(d.debater1)} vs {fullName(d.debater2)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onScoreDebate(d)}
                                    className="ax-ghost-btn !min-h-10 !text-xs shrink-0 font-bold"
                                >
                                    Score ballot →
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Completed ballots list with quick edit */}
            {completed.length > 0 && (
                <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Scored Ballots ({completed.length})
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 max-h-[200px] overflow-y-auto">
                        {completed.slice(0, 40).map((d) => {
                            const w1 = d.winnerId === d.debater1Id;
                            const w2 = d.winnerId === d.debater2Id;
                            return (
                                <li key={d.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-muted/20 border border-border/40">
                                    <div className="min-w-0 flex-1 truncate">
                                        <span className={w1 ? "font-bold text-emerald-600" : ""}>{fullName(d.debater1)} ({d.debater1Score})</span>
                                        {" vs "}
                                        <span className={w2 ? "font-bold text-emerald-600" : ""}>{fullName(d.debater2)} ({d.debater2Score})</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onScoreDebate(d)}
                                        className="text-primary hover:underline font-semibold shrink-0"
                                    >
                                        Edit
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* All ballots done actions */}
            {pending.length === 0 && total > 0 && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                        <Trophy size={16} /> All {total} ballots scored and verified!
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {resultsPublished
                            ? "Results are public. Review qualified debaters and promote to the next round."
                            : "Make results visible to participants or review promotion list."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onPublishResults}
                            disabled={busy}
                            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                        >
                            {resultsPublished ? "Hide Results" : "Publish Results"}
                        </button>
                        <Link
                            to={`/admin/rounds/${roundId}/promotion`}
                            className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted"
                        >
                            Review &amp; Promote →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

function QuickCreateRoundModal({eventId, defaultRoundNumber, onClose, onCreated}) {
    const {getToken} = useAuth();
    const [roundNumber, setRoundNumber] = useState(defaultRoundNumber);
    const [name, setName] = useState(`Round ${defaultRoundNumber}`);
    const [motion, setMotion] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await AdminApi.createRound({
                eventId,
                roundNumber: Number(roundNumber),
                name: name.trim() || `Round ${roundNumber}`,
                motion: motion.trim() || null
            }, token);

            if (res.success && res.round) {
                onCreated(res.round);
            } else {
                setError(res.error || "Failed to create round");
            }
        } catch (err) {
            setError(err?.message || "Failed to create round");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-heading font-bold text-lg text-foreground">Add New Round</h3>
                    <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <div>
                        <label className="font-semibold block mb-1 text-foreground">Round Number</label>
                        <input
                            type="number"
                            min="1"
                            value={roundNumber}
                            onChange={(e) => {
                                setRoundNumber(e.target.value);
                                if (!name || name.startsWith("Round ")) setName(`Round ${e.target.value}`);
                            }}
                            className="w-full h-10 px-3 rounded-lg border border-input bg-background font-mono text-foreground font-bold"
                            required
                        />
                    </div>

                    <div>
                        <label className="font-semibold block mb-1 text-foreground">Round Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Preliminary Round 2"
                            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div>
                        <label className="font-semibold block mb-1 text-foreground">Motion (Optional)</label>
                        <textarea
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                            placeholder="Enter the debate motion or topic..."
                            rows={3}
                            className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border text-foreground font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            Create Round
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
