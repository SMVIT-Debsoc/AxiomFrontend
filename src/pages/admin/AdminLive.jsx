import {usePageRequests} from "../../hooks/usePageRequests";
import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link} from "react-router-dom";
import {Loader2, Search, X, Edit3, Trophy, Plus, Clock, ShieldCheck, DoorOpen} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi} from "../../services/api";
import {useRoundSocket, useEventSocket, useSocket, SocketEvents, useLiveRefresh} from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast";
import {useAdminEvent} from "../../contexts/adminEvent";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import InlineResultSheet from "../../components/admin/InlineResultSheet";
import {cn, formatTimeIST, toISTDateTimeLocal, toISTISOString, addMinutesToISTDateTime, getCurrentISTDateTimeLocal} from "../../lib/utils";

const AllocateRoomsModal = lazy(() => import("./AdminRoundManagement").then((m) => ({default: m.AllocateRoomsModal})));
const PairingPreviewModal = lazy(() => import("./AdminRoundManagement").then((m) => ({default: m.PairingPreviewModal})));
const toISTDateTimeString = toISTDateTimeLocal;

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

const LIVE_ROUND_FIELDS = ["round", "performers"];
const LIVE_SUPPORT_FIELDS = ["rooms", "roster"];

export default function AdminLive() {
    const {getToken} = useAuth();
    const toast = useToast();
    const {events, event, eventId, setEventId, loading: eventsLoading} = useAdminEvent();

    const [rounds, setRounds] = useState([]);
    const [roundId, setRoundId] = useState(null);
    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [performers, setPerformers] = useState([]);
    const [eliminatedIds, setEliminatedIds] = useState(() => new Set());
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(""); // generating | allocating | publishing | results | preview | window | status
    const [pendingCheckIns, setPendingCheckIns] = useState(() => new Set());
    const [promotingIds, setPromotingIds] = useState(() => new Set());
    const [savingJudgeId, setSavingJudgeId] = useState(null);
    const [showAllocate, setShowAllocate] = useState(false);
    const [showQuickRound, setShowQuickRound] = useState(false);
    const [showQuickRoom, setShowQuickRoom] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [scoringDebate, setScoringDebate] = useState(null);
    const [viewStep, setViewStep] = useState(null);
    const [search, setSearch] = useState("");
    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
    const activeRound = useRef(roundId);
    useEffect(() => { activeRound.current = roundId; }, [roundId]);
    const selectedEvent = useRef(eventId);
    useEffect(() => { selectedEvent.current = eventId; }, [eventId]);

    // Rounds of the selected event
    const refreshRoundsList = useCallback(async (selectPreferred = false) => {
        if (!eventId) return;
        try {
            const token = await getTokenRef.current();
            const res = await AdminApi.apiRequest(`/rounds/event/${eventId}?view=summary`, "GET", null, token, {skipCache: true});
            if (selectedEvent.current !== eventId) return;
            const list = (res.success ? res.rounds || [] : []).slice().sort((a, b) => a.roundNumber - b.roundNumber);
            setRounds(list);
            if (selectPreferred || (activeRound.current && !list.some((r) => r.id === activeRound.current))) {
                const live = list.find((r) => String(r.status).toUpperCase() === "ONGOING")
                    || list.find((r) => String(r.status).toUpperCase() !== "COMPLETED")
                    || list[list.length - 1];
                setRoundId(live?.id || null);
                if (!live) setLoading(false);
            }
        } catch {
            toast.error("Error", "Failed to load rounds");
            setLoading(false);
        }
    }, [eventId, toast]);

    useEffect(() => {
        setRounds([]);
        setRoundId(null);
        setLoading(Boolean(eventId));
        if (!eventId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const token = await getTokenRef.current();
                const res = await AdminApi.apiRequest(`/rounds/event/${eventId}?view=summary`, "GET", null, token);
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

    useEffect(() => {
        setViewStep(null);
        setRound(null);
        setPerformers([]);
        setEliminatedIds(new Set());
        setResultsPublished(false);
    }, [roundId]);

    const refreshRound = usePageRequests(LIVE_ROUND_FIELDS, async (field, token, options, isCurrent) => {
        if (!roundId) return;
        if (field === "round" && !options.skipCache) setLoading(true);
        try {
            const url = field === "round" ? `/rounds/${roundId}` : `/admin/rounds/${roundId}/performers`;
            const response = await AdminApi.apiRequest(url, "GET", null, token, options);
            if (!isCurrent() || !response.success) return;
            if (field === "round" && response.round.eventId === eventId) {
                setRound(response.round);
                setCheckIns(response.round.checkIns || []);
                setDebates(response.round.debates || []);
                setEliminatedIds(new Set(response.round.eliminatedUserIds || []));
                setResultsPublished(Boolean(response.round.resultsPublished));
            } else if (field === "performers") {
                setPerformers(response.performers || []);
            }
        } catch {
            if (isCurrent() && field === "round" && !options.skipCache) toast.error("Error", "Failed to load round data");
        } finally {
            if (isCurrent() && field === "round") setLoading(false);
        }
    }, undefined, eventId + "/" + roundId);

    useEffect(() => { setUsers([]); }, [eventId]);
    const refreshSupport = usePageRequests(LIVE_SUPPORT_FIELDS, async (field, token, options, isCurrent) => {
        if (!eventId) return;
        const url = field === "rooms" ? "/rooms" : `/events/${eventId}/participants`;
        const response = await AdminApi.apiRequest(url, "GET", null, token, options);
        if (!isCurrent() || !response.success) return;
        if (field === "rooms") setRooms(response.rooms || []);
        else setUsers(response.participants || []);
    }, undefined, eventId);

    const softRefetch = useCallback(() => refreshRound(...LIVE_ROUND_FIELDS), [refreshRound]);
    useLiveRefresh(() => {
        softRefetch();
        refreshSupport(...LIVE_SUPPORT_FIELDS);
        refreshRoundsList();
    }, {eventId, roundId, jitterMs: 3000, invalidateCache: false});

    const handleRealtimeCheckIn = useCallback((data) => {
        const targetUserId = data?.userId || data?.user?.id;
        if (!targetUserId) {
            softRefetch();
            return;
        }
        setCheckIns((prev) => {
            const exists = prev.some((c) => c.userId === targetUserId);
            if (exists) {
                return prev.map((c) =>
                    c.userId === targetUserId
                        ? {...c, status: data.status, ...(data.user ? {user: data.user} : {})}
                        : c
                );
            }
            if (data.user) {
                return [...prev, {userId: targetUserId, status: data.status, user: data.user}];
            }
            softRefetch();
            return [...prev, {userId: targetUserId, status: data.status}];
        });
        if (data.user) {
            setUsers((prev) => (prev.some((u) => u.id === targetUserId) ? prev : [...prev, data.user]));
        }
    }, [softRefetch]);

    const handleRealtimeWindow = useCallback((data) => {
        if (data && data.roundId && data.roundId !== roundId) return;
        setRound((prev) => prev ? {
            ...prev,
            checkInStartTime: data?.checkInStartTime !== undefined ? data.checkInStartTime : prev.checkInStartTime,
            checkInEndTime: data?.checkInEndTime !== undefined ? data.checkInEndTime : prev.checkInEndTime,
        } : prev);
        softRefetch();
    }, [roundId, softRefetch]);

    useRoundSocket(roundId, {
        onCheckInUpdate: handleRealtimeCheckIn,
        onPairingsGenerated: (data) => (data?.debates ? setDebates(data.debates) : softRefetch()),
        onRoomsAllocated: softRefetch,
        onDebateResult: (data) => {
            setDebates((prev) => prev.map((d) => d.id === data.debateId
                ? {...d, winnerId: data.winnerId, debater1Score: data.debater1Score, debater2Score: data.debater2Score, status: "COMPLETED"} : d));
            refreshRound("performers");
        },
        onRoundStatusChange: (data) => {
            setRound((prev) => (prev ? {...prev, ...data} : prev));
            setRounds((prev) => prev.map((r) => (r.id === (data?.roundId || roundId) ? {...r, status: data?.status ?? r.status} : r)));
        },
        onPairingsPublished: (data) => setRound((prev) => (prev ? {...prev, pairingsPublished: data.published} : prev)),
        onResultsPublished: (data) => setResultsPublished(Boolean(data.published)),
        onRoundUpdated: (data) => { if (data?.round) setRound((prev) => ({...prev, ...data.round})); },
        onDebateCreated: softRefetch,
        onDebateUpdated: softRefetch,
        onDebateDeleted: softRefetch,
    });

    useEventSocket(eventId, {
        onRoundCreated: (data) => {
            if (data?.round) {
                setRounds((prev) => (
                    prev.some((r) => r.id === data.round.id)
                        ? prev.map((r) => (r.id === data.round.id ? {...r, ...data.round} : r))
                        : [...prev, data.round].sort((a, b) => a.roundNumber - b.roundNumber)
                ));
            } else {
                refreshRoundsList(false);
            }
        },
        onRoundDeleted: (data) => {
            const deletedId = data?.roundId || data?.id;
            if (deletedId) {
                setRounds((prev) => prev.filter((r) => r.id !== deletedId));
            }
            if (!deletedId || deletedId === roundId) {
                refreshRoundsList(true);
            }
        },
        onEventEnrollment: (data) => {
            if (data?.user?.id) {
                setUsers((prev) => (prev.some((u) => u.id === data.user.id) ? prev : [...prev, data.user]));
            }
            refreshSupport("roster");
        },
        onRoundStatusChange: (data) => {
            if (data?.roundId === roundId) {
                setRound((prev) => (prev ? {...prev, status: data.status} : prev));
            }
            if (data?.roundId) {
                setRounds((prev) => prev.map((r) => (r.id === data.roundId ? {...r, status: data.status} : r)));
            }
        },
    });

    const {subscribe: subscribeLive} = useSocket();
    useEffect(() => {
        if (!eventId && !roundId) return undefined;
        return subscribeLive(SocketEvents.ROUND_CHECKIN_WINDOW, handleRealtimeWindow);
    }, [subscribeLive, eventId, roundId, handleRealtimeWindow]);

    // ----- derived round state -----
    const people = useMemo(() => {
        const merged = [...users];
        const known = new Set(users.map((user) => user.id));
        for (const checkIn of checkIns) {
            if (!checkIn.user || known.has(checkIn.userId)) continue;
            merged.push(checkIn.user);
            known.add(checkIn.userId);
        }
        return merged;
    }, [users, checkIns]);
    const presentIds = useMemo(() => new Set(checkIns.filter((c) => c.status === "PRESENT").map((c) => c.userId)), [checkIns]);
    const eliminatedSet = useMemo(() => {
        const set = new Set(eliminatedIds);
        for (const p of performers) {
            if (p.won === false && !p.isPromoted) set.add(p.userId);
        }
        return set;
    }, [eliminatedIds, performers]);
    const checkedInUsers = useMemo(() => people.filter((u) => presentIds.has(u.id)), [people, presentIds]);
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
    const toggleCheckIn = async (userId, nextStatus = "PRESENT") => {
        if (pendingCheckIns.has(userId)) return;

        if (nextStatus === "PRESENT" && eliminatedSet.has(userId)) {
            toast.error("Participant Eliminated", "Eliminated debaters cannot check in for subsequent rounds.");
            return;
        }

        setPendingCheckIns((prev) => new Set(prev).add(userId));

        let rollback = null;
        setCheckIns((prev) => {
            rollback = prev;
            const exists = prev.some((c) => c.userId === userId);
            if (exists) {
                return prev.map((c) => (c.userId === userId ? {...c, status: nextStatus} : c));
            }
            const userObj = people.find((u) => u.id === userId);
            return [...prev, {userId, status: nextStatus, ...(userObj ? {user: userObj} : {})}];
        });

        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/check-in/round/${roundId}/user/${userId}`, "PUT", {status: nextStatus}, token);
            if (activeRound.current !== roundId) return;
            if (res.success) {
                toast.success("Check-in updated", nextStatus === "PRESENT" ? "Marked present." : "Marked absent.");
                softRefetch();
            } else {
                if (rollback) setCheckIns(rollback);
                toast.error("Check-in failed", res.error || "Failed to update check-in status");
            }
        } catch (err) {
            if (rollback) setCheckIns(rollback);
            toast.error("Error", err?.message || "Failed to update check-in status");
        } finally {
            setPendingCheckIns((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    const updateCheckInWindow = async ({checkInStartTime, checkInEndTime}) => {
        setBusy("window");
        try {
            const token = await getToken();
            const res = await AdminApi.updateRound(roundId, {checkInStartTime, checkInEndTime}, token);
            if (res.success) {
                setRound((prev) => (prev ? {...prev, checkInStartTime, checkInEndTime, ...(res.round || {})} : prev));
                toast.success("Check-in window updated", "Timing saved in IST.");
                softRefetch();
                return true;
            }
            toast.error("Update failed", res.error || "Could not update check-in window");
            return false;
        } catch (err) {
            toast.error("Error", err?.message || "Could not update check-in window");
            return false;
        } finally {
            setBusy("");
        }
    };

    const updateRoundStatus = async (status) => {
        if (!round || round.status === status || busy === "status") return;
        setBusy("status");
        try {
            const token = await getToken();
            const res = await AdminApi.updateRound(roundId, {status}, token);
            if (res.success) {
                setRound((prev) => (prev ? {...prev, status} : prev));
                setRounds((prev) => prev.map((r) => (r.id === roundId ? {...r, status} : r)));
                toast.success("Round status updated", `Round marked ${status}.`);
            } else {
                toast.error("Update failed", res.error || "Could not update round status");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Could not update round status");
        } finally {
            setBusy("");
        }
    };

    const assignJudge = async (debateId, judgeName) => {
        setSavingJudgeId(debateId);
        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/debates/${debateId}`, "PUT", {judgeName}, token);
            if (res.success) {
                setDebates((prev) => prev.map((d) => (d.id === debateId ? {...d, judgeName, adjudicator: null, adjudicatorId: null} : d)));
                toast.success("Judge assigned", judgeName ? `Assigned ${judgeName}.` : "Cleared judge.");
                softRefetch();
            } else {
                toast.error("Assignment failed", res.error || "Could not assign judge");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Could not assign judge");
        } finally {
            setSavingJudgeId(null);
        }
    };

    const togglePromotePerformer = async (userId) => {
        if (promotingIds.has(userId)) return;
        const nextSelected = new Set(performers.filter((p) => p.isPromoted).map((p) => p.userId));
        if (nextSelected.has(userId)) nextSelected.delete(userId);
        else nextSelected.add(userId);

        setPromotingIds((prev) => new Set(prev).add(userId));
        const previousPerformers = performers;
        setPerformers((prev) => prev.map((p) => (p.userId === userId ? {...p, isPromoted: nextSelected.has(userId)} : p)));
        try {
            const token = await getToken();
            const res = await AdminApi.promoteDebaters(roundId, Array.from(nextSelected), token);
            if (res.success) {
                toast.success("Promotion updated", nextSelected.has(userId) ? "Debater promoted." : "Promotion removed.");
                softRefetch();
            } else {
                setPerformers(previousPerformers);
                toast.error("Promotion failed", res.error || "Could not update promotion");
            }
        } catch (err) {
            setPerformers(previousPerformers);
            toast.error("Error", err?.message || "Could not update promotion");
        } finally {
            setPromotingIds((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    const promoteAllWinners = async () => {
        const winnerIds = performers.filter((p) => p.won || p.isPromoted).map((p) => p.userId);
        if (winnerIds.length === 0) return;
        setBusy("promoting");
        const previousPerformers = performers;
        const winnerSet = new Set(winnerIds);
        setPerformers((prev) => prev.map((p) => ({...p, isPromoted: winnerSet.has(p.userId)})));
        try {
            const token = await getToken();
            const res = await AdminApi.promoteDebaters(roundId, winnerIds, token);
            if (res.success) {
                toast.success("Winners promoted", `Promoted ${winnerIds.length} qualifying debaters.`);
                softRefetch();
            } else {
                setPerformers(previousPerformers);
                toast.error("Promotion failed", res.error || "Could not promote winners");
            }
        } catch (err) {
            setPerformers(previousPerformers);
            toast.error("Error", err?.message || "Could not promote winners");
        } finally {
            setBusy("");
        }
    };

    const previewPairings = async () => {
        setBusy("preview");
        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/pairing/${roundId}/preview`, "GET", null, token, {skipCache: true});
            if (res.success) setPreviewData(res);
            else toast.error("Preview failed", res.error || "Could not preview pairings");
        } catch (err) { toast.error("Error", err?.message || "Could not preview pairings"); } finally { setBusy(""); }
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
                softRefetch();
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
                if (res.data?.debates) setDebates(res.data.debates); else softRefetch();
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

    const handleResultSaved = ({debateId, debater1Score, debater2Score, winnerId, nextDebate}, saved) => {
        setDebates((prev) => prev.map((d) => d.id === debateId ? {
            ...d,
            debater1Score: saved?.debater1Score ?? debater1Score,
            debater2Score: saved?.debater2Score ?? debater2Score,
            winnerId: saved?.winnerId ?? winnerId,
            status: "COMPLETED"
        } : d));
        toast.success("Result Saved", "Ballot recorded with winner tag.");
        if (nextDebate) {
            setScoringDebate(nextDebate);
        } else {
            setScoringDebate(null);
        }
        const hasOtherPending = debates.some((debate) => debate.id !== debateId && debate.status !== "COMPLETED");
        if (hasOtherPending) refreshRound("performers");
        else softRefetch();
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
            body: resultsPublished ? "Results are public. Toggle qualifiers inline below and advance to the next round." : "All ballots are in. Make results public, then promote.",
            cta: resultsPublished ? "Review & promote" : "Publish results",
            run: resultsPublished
                ? () => {
                    setViewStep(4);
                    window.setTimeout(() => {
                        document.getElementById("inline-promotion-panel")?.scrollIntoView({behavior: "smooth", block: "start"});
                    }, 50);
                }
                : publishResults,
            working: busy === "results",
        };
    })();

    // ----- render -----
    if (eventsLoading || (loading && !round)) return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Loading live round" /></div>;
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
        withRoom < debates.length && hasDebates ? {text: `${debates.length - withRoom} debate${debates.length - withRoom === 1 ? "" : "s"} without a room`, step: 2, cta: "allocate"} : null,
        allRooms && noJudge ? {text: `${noJudge} debate${noJudge === 1 ? "" : "s"} without a judge`, step: 2, cta: "assign"} : null,
    ].filter(Boolean);

    return (
        <div className="mx-auto max-w-[1180px] font-sans space-y-4">
            {/* Header: Event Switcher + Round Title + Quick Status */}
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Tournament</span>
                        {events?.length > 1 && (
                            <select
                                aria-label="Select tournament"
                                value={eventId || ""}
                                onChange={(e) => setEventId(e.target.value)}
                                className="h-9 px-2.5 rounded-md border border-border bg-card text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                    <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-tight text-primary">
                        {round.name || `Round ${round.roundNumber}`} — {roundWord(round.status)}
                    </h1>
                    {/* Inline Round Status quick pill selector */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label="Round status">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
                        {["UPCOMING", "ONGOING", "COMPLETED"].map((statusOption) => {
                            const active = String(round.status).toUpperCase() === statusOption;
                            return (
                                <button
                                    key={statusOption}
                                    type="button"
                                    disabled={busy === "status"}
                                    aria-pressed={active}
                                    onClick={() => updateRoundStatus(statusOption)}
                                    className={cn(
                                        "min-h-9 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all",
                                        active
                                            ? statusOption === "ONGOING"
                                                ? "ax-signal-win border-emerald-500/50 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100"
                                                : statusOption === "COMPLETED"
                                                ? "ax-signal-info border-indigo-500/45 bg-indigo-500/15 text-indigo-800 dark:text-indigo-100"
                                                : "ax-signal-warn border-orange-500/45 bg-orange-500/20 text-orange-800 dark:text-orange-100"
                                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    {statusOption}
                                </button>
                            );
                        })}
                    </div>
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

            {/* Inline Check-In Window Strip (always visible & interactive at top of Live Round) */}
            <CheckInWindowStrip round={round} busy={busy} onUpdateWindow={updateCheckInWindow} />

            {/* Main Operational Surface + Next Action Sidebar */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section aria-label="Step detail" className="ax-card order-2 min-w-0 p-4 md:p-6 lg:order-1">
                    {step === 0 && (
                        <CheckInPanel
                            present={present}
                            total={total}
                            absent={absent.filter((u) => match(fullName(u), u.college, u.mobile, u.usn, u.email))}
                            checkedInUsers={checkedInUsers.filter((u) => match(fullName(u), u.college, u.mobile, u.usn, u.email))}
                            eliminatedSet={eliminatedSet}
                            busy={busy}
                            pendingCheckIns={pendingCheckIns}
                            onToggleCheckIn={toggleCheckIn}
                            onPreview={previewPairings}
                        />
                    )}
                    {step === 1 && (
                        <PairingsPanel
                            round={round}
                            debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            onRegenerate={generatePairings}
                            onSaveMotion={saveMotion}
                            onPreview={previewPairings}
                            previewing={busy === "preview"}
                            regenerating={busy === "generating"}
                            hasDebates={hasDebates}
                        />
                    )}
                    {step === 2 && (
                        <RoomsPanel
                            debates={debates.filter((d) => match(fullName(d.debater1), fullName(d.debater2), d.room?.name))}
                            onAllocate={() => setShowAllocate(true)}
                            onAssignJudge={assignJudge}
                            savingJudgeId={savingJudgeId}
                            onOpenQuickRoom={() => setShowQuickRoom(true)}
                            hasDebates={hasDebates}
                            noJudge={noJudge}
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
                            performers={performers}
                            promotingIds={promotingIds}
                            promotingAll={busy === "promoting"}
                            onTogglePromote={togglePromotePerformer}
                            onPromoteWinners={promoteAllWinners}
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
                                    <button
                                        type="button"
                                        onClick={() => setViewStep(n.step)}
                                        className="font-semibold text-primary underline underline-offset-2"
                                    >
                                        {n.cta}
                                    </button>
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

            {/* Pairing preview modal */}
            {previewData && (
                <Suspense fallback={null}>
                    <PairingPreviewModal
                        preview={previewData}
                        roundNumber={round.roundNumber}
                        onClose={() => setPreviewData(null)}
                        generating={busy === "generating"}
                        onGenerate={() => {
                            setPreviewData(null);
                            generatePairings();
                        }}
                    />
                </Suspense>
            )}

            {/* Inline quick room creator modal */}
            {showQuickRoom && (
                <QuickRoomModal
                    onClose={() => setShowQuickRoom(false)}
                    onCreated={(newRoom) => {
                        setShowQuickRoom(false);
                        if (newRoom) setRooms((prev) => [...prev, newRoom]);
                        refreshSupport("rooms");
                    }}
                />
            )}

            {/* Inline fast ballot scoring sheet with auto-winner */}
            {scoringDebate && (
                <InlineResultSheet
                    debate={scoringDebate}
                    debates={debates}
                    onSaved={handleResultSaved}
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

function CheckInWindowStrip({round, busy, onUpdateWindow}) {
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [editing, setEditing] = useState(false);
    const [startVal, setStartVal] = useState("");
    const [endVal, setEndVal] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const hasWindow = Boolean(round?.checkInStartTime && round?.checkInEndTime);
    const startMs = hasWindow ? new Date(round.checkInStartTime).getTime() : NaN;
    const endMs = hasWindow ? new Date(round.checkInEndTime).getTime() : NaN;
    const isValid = hasWindow && Number.isFinite(startMs) && Number.isFinite(endMs);

    const status = !isValid
        ? "NOT_CONFIGURED"
        : nowMs < startMs
        ? "UPCOMING"
        : nowMs <= endMs
        ? "OPEN"
        : "CLOSED";

    const statusMeta = {
        OPEN: {
            label: "OPEN",
            cls: "ax-signal-win border-emerald-500/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.22)]",
        },
        CLOSED: {
            label: "CLOSED",
            cls: "ax-signal-loss border-rose-500/45 bg-rose-500/20 text-rose-700 dark:text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
        },
        UPCOMING: {
            label: "UPCOMING",
            cls: "ax-signal-warn border-orange-500/45 bg-orange-500/18 text-orange-800 dark:text-orange-200",
        },
        NOT_CONFIGURED: {
            label: "NOT CONFIGURED",
            cls: "ax-signal-loss border-rose-500/50 bg-rose-500/20 text-rose-700 dark:text-rose-200",
        },
    }[status];

    const openEditor = () => {
        setStartVal(toISTDateTimeString(round?.checkInStartTime || new Date()));
        setEndVal(toISTDateTimeString(round?.checkInEndTime || new Date(Date.now() + 20 * 60000)));
        setErr("");
        setEditing((v) => !v);
    };

    const handleSaveCustom = async (e) => {
        e.preventDefault();
        setErr("");
        const startIso = toISTISOString(startVal);
        const endIso = toISTISOString(endVal);
        if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
            setErr("Closing time must be after opening time.");
            return;
        }
        const ok = await onUpdateWindow({checkInStartTime: startIso, checkInEndTime: endIso});
        if (ok) setEditing(false);
    };

    const windowBusy = busy === "window";

    return (
        <div
            className={cn(
                "rounded-xl border p-3.5 space-y-3",
                status === "NOT_CONFIGURED"
                    ? "ax-signal-loss border-rose-500/40 bg-rose-500/10"
                    : status === "OPEN"
                    ? "border-emerald-500/35 bg-emerald-500/5"
                    : "border-border bg-muted/30"
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Clock size={15} className="text-primary shrink-0" aria-hidden="true" />
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border", statusMeta.cls)}>
                        {statusMeta.label}
                    </span>
                    {isValid ? (
                        <span className="text-xs font-semibold text-foreground">
                            Opens: <span className="font-mono">{formatTimeIST(round.checkInStartTime)} IST</span>
                            {" · "}
                            Closes: <span className="font-mono">{formatTimeIST(round.checkInEndTime)} IST</span>
                        </span>
                    ) : (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                            Check-in window is not configured — open a 20m window so debaters can check in.
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        disabled={windowBusy}
                        onClick={() =>
                            onUpdateWindow({
                                checkInStartTime: new Date().toISOString(),
                                checkInEndTime: new Date(Date.now() + 20 * 60000).toISOString(),
                            })
                        }
                        className="min-h-11 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        Open 20m Now
                    </button>
                    <button
                        type="button"
                        disabled={windowBusy}
                        onClick={() => {
                            const baseEnd = isValid ? Math.max(Date.now(), endMs) : Date.now();
                            onUpdateWindow({
                                checkInStartTime: isValid ? round.checkInStartTime : new Date().toISOString(),
                                checkInEndTime: new Date(baseEnd + 10 * 60000).toISOString(),
                            });
                        }}
                        className="min-h-11 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                        +10m Extend
                    </button>
                    {status === "OPEN" && (
                        <button
                            type="button"
                            disabled={windowBusy}
                            onClick={() =>
                                onUpdateWindow({
                                    checkInStartTime: isValid ? round.checkInStartTime : new Date(Date.now() - 60000).toISOString(),
                                    checkInEndTime: new Date(Date.now() - 1000).toISOString(),
                                })
                            }
                            className="min-h-11 px-3 py-1.5 rounded-lg ax-signal-loss border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-50 transition-colors"
                        >
                            Close Now
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={openEditor}
                        aria-expanded={editing}
                        className="min-h-11 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors"
                    >
                        {editing ? "Cancel" : "Edit Times"}
                    </button>
                </div>
            </div>

            {editing && (
                <form onSubmit={handleSaveCustom} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-end pt-2 border-t border-border/60">
                    {err && (
                        <p className="sm:col-span-3 m-0 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">
                            {err}
                        </p>
                    )}
                    <label className="text-xs">
                        <span className="block font-semibold text-foreground mb-1">Opens (IST)</span>
                        <input
                            type="datetime-local"
                            required
                            value={startVal}
                            onChange={(e) => setStartVal(e.target.value)}
                            className="w-full min-h-11 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs"
                        />
                    </label>
                    <label className="text-xs">
                        <span className="block font-semibold text-foreground mb-1">Closes (IST)</span>
                        <input
                            type="datetime-local"
                            required
                            value={endVal}
                            onChange={(e) => setEndVal(e.target.value)}
                            className="w-full min-h-11 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={windowBusy}
                        className="min-h-11 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                    >
                        {windowBusy ? "Saving…" : "Save Window"}
                    </button>
                    <div className="sm:col-span-3 flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-muted-foreground text-[11px] font-medium mr-1">Window duration:</span>
                        {[15, 20, 30, 45, 60].map((mins) => (
                            <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                    const baseStart = startVal || getCurrentISTDateTimeLocal();
                                    if (!startVal) setStartVal(baseStart);
                                    setEndVal(addMinutesToISTDateTime(baseStart, mins));
                                    setErr(null);
                                }}
                                className="min-h-9 px-2.5 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted text-foreground font-semibold text-[11px] transition-colors"
                            >
                                {mins}m
                            </button>
                        ))}
                    </div>
                </form>
            )}
        </div>
    );
}

function CheckInPanel({present, total, absent, checkedInUsers, eliminatedSet = new Set(), busy, pendingCheckIns, onToggleCheckIn, onPreview}) {
    const [tab, setTab] = useState("absent"); // "absent" | "present"
    const [hideEliminated, setHideEliminated] = useState(true);

    const eliminatedCount = eliminatedSet?.size || 0;
    const eligibleAbsent = useMemo(() => absent.filter((u) => !eliminatedSet.has(u.id)), [absent, eliminatedSet]);
    const visibleAbsent = hideEliminated ? eligibleAbsent : absent;
    const visibleList = tab === "absent" ? visibleAbsent : checkedInUsers;
    const eligibleTotal = Math.max(total - eliminatedCount, present);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Stat label="Present" value={present} of={eligibleTotal} />
                <Stat label="To check in" value={Math.max(eligibleTotal - present, 0)} />
                <Stat label="Eligible debaters" value={eligibleTotal} />
                <Stat label="Eliminated" value={eliminatedCount} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 border border-border p-1" role="tablist" aria-label="Check-in lists">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "absent"}
                        onClick={() => setTab("absent")}
                        className={cn(
                            "min-h-11 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                            tab === "absent" ? "bg-card text-foreground shadow-xs border border-border/70" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Still to check in ({visibleAbsent.length})
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "present"}
                        onClick={() => setTab("present")}
                        className={cn(
                            "min-h-11 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                            tab === "present" ? "bg-card text-foreground shadow-xs border border-border/70" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Checked in ({checkedInUsers.length})
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {eliminatedCount > 0 && tab === "absent" && (
                        <button
                            type="button"
                            onClick={() => setHideEliminated((prev) => !prev)}
                            className={cn(
                                "min-h-11 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                                hideEliminated
                                    ? "border-border bg-card text-foreground hover:bg-muted"
                                    : "ax-signal-loss border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                            )}
                        >
                            {hideEliminated ? `Hiding ${eliminatedCount} Eliminated (Show)` : `Showing Eliminated (${eliminatedCount} - Hide)`}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onPreview}
                        disabled={busy === "preview"}
                        className="ax-ghost-btn min-h-11 !text-xs font-bold"
                    >
                        {busy === "preview" ? "Previewing…" : "Preview pairings"}
                    </button>
                </div>
            </div>

            {visibleList.length === 0 ? (
                <p className="m-0 text-muted-foreground text-sm py-4 text-center">
                    {tab === "absent"
                        ? "Everyone matching this filter is checked in. Ready to pair."
                        : "No participants checked in yet."}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0 max-h-[460px] overflow-y-auto">
                    {visibleList.map((u) => {
                        const isPending = pendingCheckIns.has(u.id);
                        const isPresentTab = tab === "present";
                        const isEliminated = eliminatedSet.has(u.id);
                        return (
                            <li
                                key={u.id}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-card/60 transition-colors",
                                    isPresentTab
                                        ? "border-emerald-500/35"
                                        : isEliminated
                                        ? "border-rose-500/35 bg-rose-500/5 opacity-85"
                                        : "border-border"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="m-0 truncate font-semibold text-sm">{fullName(u)}</p>
                                        {isPresentTab && (
                                            <span className="ax-signal-win inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
                                                Present
                                            </span>
                                        )}
                                        {isEliminated && (
                                            <span className="ax-signal-loss inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-200">
                                                Eliminated
                                            </span>
                                        )}
                                    </div>
                                    <p className="m-0 truncate text-xs text-muted-foreground">{u.college || "No college"}{u.usn ? ` · ${u.usn}` : ""}</p>
                                    <p className="m-0 truncate text-xs text-muted-foreground tabular-nums">
                                        {u.mobile ? <a href={`tel:${u.mobile}`} className="font-medium text-foreground hover:underline">{u.mobile}</a> : "No phone"}
                                        {u.email ? ` · ${u.email}` : ""}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onToggleCheckIn(u.id, isPresentTab ? "ABSENT" : "PRESENT")}
                                    disabled={isPending || (!isPresentTab && isEliminated)}
                                    className={cn(
                                        "min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 border transition-colors disabled:opacity-50",
                                        isPresentTab
                                            ? "ax-signal-loss border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-200 hover:bg-rose-500/20"
                                            : isEliminated
                                            ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed"
                                            : "border-border bg-card text-foreground hover:bg-muted"
                                    )}
                                >
                                    {isPending ? "Saving…" : isPresentTab ? "Mark absent" : isEliminated ? "Check-in Off" : "Mark present"}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function PairingsPanel({round, debates, onRegenerate, onSaveMotion, onPreview, previewing, regenerating, hasDebates}) {
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
                            className="min-h-11 px-2 text-xs text-primary font-semibold hover:underline flex items-center gap-1"
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
                                className="min-h-11 px-3 py-1.5 rounded-lg border text-xs font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await onSaveMotion(motionDraft.trim());
                                    setEditingMotion(false);
                                }}
                                className="min-h-11 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
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
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onPreview} disabled={previewing} className="ax-ghost-btn min-h-11 !text-xs">
                        {previewing ? "Previewing…" : "Preview pairings"}
                    </button>
                    {hasDebates && (
                        <button type="button" onClick={onRegenerate} disabled={regenerating} className="ax-ghost-btn min-h-11 !text-xs">
                            {regenerating ? "Regenerating…" : "Regenerate pairings"}
                        </button>
                    )}
                </div>
            </div>

            {!hasDebates ? (
                <p className="m-0 text-muted-foreground text-sm">No pairings yet. Close check-in to generate them.</p>
            ) : (
                <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-[0.06em] text-muted-foreground border-b border-border">
                                <th scope="col" className="py-2 pr-3">#</th>
                                <th scope="col" className="py-2 pr-3">Proposition (GOV)</th>
                                <th scope="col" className="py-2 pr-3">Opposition (OPP)</th>
                                <th scope="col" className="py-2">Room</th>
                            </tr>
                        </thead>
                        <tbody>
                            {debates.slice(0, 100).map((d, i) => (
                                <tr key={d.id} className="border-b border-border/40 hover:bg-muted/30">
                                    <td className="py-2.5 pr-3 text-muted-foreground">{i + 1}</td>
                                    <td className="py-2.5 pr-3 font-semibold text-foreground">
                                        <span className="ax-chip ax-chip--gov mr-1.5 inline-block text-[10px] font-bold">
                                            GOV
                                        </span>
                                        {fullName(d.debater1)}
                                    </td>
                                    <td className="py-2.5 pr-3 font-semibold text-foreground">
                                        <span className="ax-chip ax-chip--opp mr-1.5 inline-block text-[10px] font-bold">
                                            OPP
                                        </span>
                                        {fullName(d.debater2)}
                                    </td>
                                    <td className="py-2.5">
                                        {d.room?.name || (
                                            <span className="ax-signal-warn inline-block px-2 py-0.5 rounded border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 text-[11px] font-semibold">
                                                Unallocated
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function RoomsPanel({debates, onAllocate, onAssignJudge, savingJudgeId, onOpenQuickRoom, hasDebates, noJudge}) {
    const [judgeDrafts, setJudgeDrafts] = useState({});

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="font-heading text-lg font-bold">Rooms &amp; Adjudicators</h2>
                    {noJudge > 0 && (
                        <p className="m-0 text-xs text-orange-700 dark:text-orange-300 font-medium">
                            {noJudge} debate{noJudge === 1 ? "" : "s"} still need an adjudicator assigned.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={onOpenQuickRoom}
                        className="ax-ghost-btn min-h-11 inline-flex items-center gap-1.5 !text-xs"
                    >
                        <DoorOpen size={14} aria-hidden="true" />
                        <span>+ Add Room</span>
                    </button>
                    {hasDebates && (
                        <button type="button" onClick={onAllocate} className="ax-ghost-btn min-h-11 !text-xs">
                            Allocate rooms
                        </button>
                    )}
                </div>
            </div>
            {!hasDebates ? (
                <p className="m-0 text-muted-foreground text-sm">Generate pairings first.</p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-h-[500px] overflow-y-auto">
                    {debates.slice(0, 100).map((d) => {
                        const currentJudge = judgeOf(d);
                        const draft = judgeDrafts[d.id] !== undefined ? judgeDrafts[d.id] : currentJudge;
                        const isDirty = draft.trim() !== currentJudge.trim();
                        const isSaving = savingJudgeId === d.id;

                        return (
                            <div key={d.id} className="rounded-xl border border-border p-3.5 bg-card/60 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="m-0 font-heading text-base font-bold text-primary truncate">
                                        {d.room?.name || "Unallocated"}
                                    </p>
                                    {!d.room && (
                                        <span className="ax-signal-warn px-1.5 py-0.5 rounded border border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200 text-[10px] font-bold">
                                            TBD
                                        </span>
                                    )}
                                </div>
                                <p className="m-0 text-xs font-semibold truncate text-foreground">
                                    {fullName(d.debater1)} vs {fullName(d.debater2)}
                                </p>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        onAssignJudge(d.id, draft.trim());
                                    }}
                                    className="flex items-center gap-1.5 pt-1 border-t border-border/50"
                                >
                                    <input
                                        type="text"
                                        aria-label={`Judge for ${fullName(d.debater1)} vs ${fullName(d.debater2)}`}
                                        value={draft}
                                        onChange={(e) => setJudgeDrafts((prev) => ({...prev, [d.id]: e.target.value}))}
                                        placeholder="Assign judge name..."
                                        className="min-w-0 flex-1 min-h-11 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs outline-none focus:border-primary"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSaving || (!isDirty && Boolean(currentJudge))}
                                        className={cn(
                                            "min-h-11 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-45",
                                            isDirty
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "border border-border bg-muted/40 text-foreground"
                                        )}
                                    >
                                        {isSaving ? "…" : "Save"}
                                    </button>
                                </form>
                            </div>
                        );
                    })}
                </div>
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
                <div className="ax-signal-warn p-3.5 rounded-xl border border-orange-500/40 bg-orange-500/15 text-xs space-y-2">
                    <p className="font-bold text-orange-800 dark:text-orange-200">Motion not set for this round.</p>
                    {editingMotion ? (
                        <div className="space-y-2">
                            <input
                                value={motionDraft}
                                onChange={(e) => setMotionDraft(e.target.value)}
                                placeholder="Enter round motion"
                                className="w-full min-h-11 p-2 text-xs rounded border border-border bg-card"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await onSaveMotion(motionDraft.trim());
                                        setEditingMotion(false);
                                    }}
                                    className="min-h-11 px-3 py-1 bg-primary text-primary-foreground font-bold rounded text-xs"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingMotion(false)}
                                    className="min-h-11 px-3 py-1 text-xs"
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
                            className="min-h-11 font-bold text-primary underline"
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
                                ? "ax-signal-win bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/35"
                                : "ax-signal-warn bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/40"
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

function ResultsPanel({
    done,
    total,
    pending,
    completed,
    performers,
    promotingIds,
    promotingAll,
    onTogglePromote,
    onPromoteWinners,
    resultsPublished,
    roundId,
    onScoreDebate,
    onPublishResults,
    busy,
}) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const promotedCount = performers.filter((p) => p.isPromoted).length;
    const sortedPerformers = useMemo(
        () =>
            [...performers].sort((a, b) => {
                if (Boolean(a.won) !== Boolean(b.won)) return a.won ? -1 : 1;
                return (b.score || 0) - (a.score || 0);
            }),
        [performers]
    );

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
                                    className="ax-ghost-btn min-h-11 !text-xs shrink-0 font-bold"
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
                            const hasWinner = Boolean(d.winnerId);
                            const w1 = d.winnerId === d.debater1Id;
                            const w2 = d.winnerId === d.debater2Id;
                            return (
                                <li key={d.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-muted/20 border border-border/40">
                                    <div className="min-w-0 flex-1 truncate flex items-center gap-2">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md transition-colors",
                                            hasWinner && w1 && "ax-signal-win bg-emerald-500/25 border border-emerald-500/50 text-emerald-800 dark:text-emerald-100 font-bold",
                                            hasWinner && !w1 && "ax-signal-loss bg-rose-500/25 border border-rose-500/50 text-rose-800 dark:text-rose-100 font-semibold"
                                        )}>
                                            {fullName(d.debater1)} ({d.debater1Score}) {hasWinner && (w1 ? "✓ WIN" : "✗ LOSS")}
                                        </span>
                                        <span className="text-muted-foreground font-semibold text-[11px]">vs</span>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md transition-colors",
                                            hasWinner && w2 && "ax-signal-win bg-emerald-500/25 border border-emerald-500/50 text-emerald-800 dark:text-emerald-100 font-bold",
                                            hasWinner && !w2 && "ax-signal-loss bg-rose-500/25 border border-rose-500/50 text-rose-800 dark:text-rose-100 font-semibold"
                                        )}>
                                            {fullName(d.debater2)} ({d.debater2Score}) {hasWinner && (w2 ? "✓ WIN" : "✗ LOSS")}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onScoreDebate(d)}
                                        className="min-h-11 px-2.5 text-primary hover:underline font-semibold shrink-0"
                                    >
                                        Edit
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Publish Results Banner */}
            {pending.length === 0 && total > 0 && (
                <div className="ax-signal-win p-4 rounded-xl border border-emerald-500/35 bg-emerald-500/15 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-200 font-bold text-sm">
                        <Trophy size={16} /> All {total} ballots scored and verified!
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {resultsPublished
                            ? "Results are public. Promote qualifiers below for the next round."
                            : "Publish results for participants and select qualifying debaters below."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onPublishResults}
                            disabled={busy}
                            className="min-h-11 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                        >
                            {resultsPublished ? "Hide Results" : "Publish Results"}
                        </button>
                        <Link
                            to={`/admin/rounds/${roundId}/promotion`}
                            className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted"
                        >
                            Full promotion view →
                        </Link>
                    </div>
                </div>
            )}

            {/* Inline Qualifiers & Promotion Panel */}
            {sortedPerformers.length > 0 && (
                <div id="inline-promotion-panel" className="space-y-3 border-t border-border/60 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                                <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
                                <span>Qualifiers &amp; Promotion ({promotedCount}/{sortedPerformers.length})</span>
                            </h3>
                            <p className="text-xs text-muted-foreground m-0">
                                Toggle qualifiers directly without leaving Live Round. Winners are highlighted in green, defeated debaters in red.
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={promotingAll}
                            onClick={onPromoteWinners}
                            className="min-h-11 px-3.5 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-100 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                            {promotingAll ? "Promoting…" : "Promote All Winners"}
                        </button>
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 max-h-[280px] overflow-y-auto">
                        {sortedPerformers.map((p) => {
                            const saving = promotingIds.has(p.userId);
                            return (
                                <li
                                    key={p.userId}
                                    className={cn(
                                        "flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors",
                                        p.won
                                            ? "ax-signal-win border-emerald-500/50 bg-emerald-500/20 text-foreground"
                                            : "ax-signal-loss border-rose-500/40 bg-rose-500/15 text-foreground"
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-semibold text-foreground truncate">{fullName(p)}</span>
                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded border text-[10px] font-bold uppercase",
                                                    p.won
                                                        ? "border-emerald-500/50 bg-emerald-500/30 text-emerald-800 dark:text-emerald-100"
                                                        : "border-rose-500/50 bg-rose-500/30 text-rose-800 dark:text-rose-100"
                                                )}
                                            >
                                                {p.won ? "✓ Winner" : "✗ Lost"}
                                            </span>
                                            <span className="font-mono font-bold text-muted-foreground">
                                                {p.score ?? 0} pts
                                            </span>
                                        </div>
                                        <p className="m-0 text-[11px] text-muted-foreground truncate">{p.college || p.email || ""}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => onTogglePromote(p.userId)}
                                        className={cn(
                                            "min-h-11 px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 transition-colors disabled:opacity-50",
                                            p.isPromoted
                                                ? "ax-signal-win border-emerald-500/45 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100"
                                                : "border-border bg-muted/40 text-foreground hover:bg-muted"
                                        )}
                                    >
                                        {saving ? "…" : p.isPromoted ? "Promoted ✓" : "Promote"}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

function QuickRoomModal({onClose, onCreated}) {
    const {getToken} = useAuth();
    const toast = useToast();
    const [name, setName] = useState("");
    const [capacity, setCapacity] = useState(2);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await AdminApi.createRoom({name: name.trim(), capacity: Number(capacity) || 2}, token);
            if (res.success) {
                toast.success("Room created", `${name.trim()} is ready for allocation.`);
                onCreated(res.room);
            } else {
                toast.error("Failed", res.error || "Could not create room");
            }
        } catch (err) {
            toast.error("Error", err?.message || "Could not create room");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-heading font-bold text-lg text-foreground">Quick Add Room</h3>
                    <button type="button" onClick={onClose} className="min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <label className="block">
                        <span className="font-semibold block mb-1 text-foreground">Room Name</span>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Hall B, Lecture Room 204"
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </label>
                    <label className="block">
                        <span className="font-semibold block mb-1 text-foreground">Capacity</span>
                        <input
                            type="number"
                            required
                            min="2"
                            value={capacity}
                            onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 2)}
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-mono"
                        />
                    </label>
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border font-semibold">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5">
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            Add Room
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function QuickCreateRoundModal({eventId, defaultRoundNumber, onClose, onCreated}) {
    const {getToken} = useAuth();
    const [roundNumber, setRoundNumber] = useState(defaultRoundNumber);
    const [name, setName] = useState(`Round ${defaultRoundNumber}`);
    const [motion, setMotion] = useState("");
    const [checkInStartTime, setCheckInStartTime] = useState(() => toISTDateTimeString(new Date()));
    const [checkInEndTime, setCheckInEndTime] = useState(() => toISTDateTimeString(new Date(Date.now() + 20 * 60000)));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const applyPreset = (mins) => {
        const baseStart = checkInStartTime || getCurrentISTDateTimeLocal();
        if (!checkInStartTime) setCheckInStartTime(baseStart);
        setCheckInEndTime(addMinutesToISTDateTime(baseStart, mins));
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!motion.trim()) {
            setError("Debate motion is required. Motion cannot be left blank.");
            return;
        }
        const startIso = toISTISOString(checkInStartTime);
        const endIso = toISTISOString(checkInEndTime);
        if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
            setError("Check-in end time must be after check-in start time.");
            return;
        }
        setSubmitting(true);
        try {
            const token = await getToken();
            const res = await AdminApi.createRound({
                eventId,
                roundNumber: Number(roundNumber),
                name: name.trim() || `Round ${roundNumber}`,
                motion: motion.trim(),
                checkInStartTime: startIso,
                checkInEndTime: endIso,
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
            <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-heading font-bold text-lg text-foreground">Add New Round</h3>
                    <button type="button" onClick={onClose} className="min-h-11 min-w-11 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="ax-signal-loss p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-medium" role="alert">
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
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background font-mono text-foreground font-bold"
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
                            className="w-full min-h-11 px-3 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="block">
                            <span className="font-semibold block mb-1 text-foreground">Check-in Start (IST)</span>
                            <input
                                type="datetime-local"
                                required
                                value={checkInStartTime}
                                onChange={(e) => setCheckInStartTime(e.target.value)}
                                className="w-full min-h-11 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                            />
                        </label>
                        <label className="block">
                            <span className="font-semibold block mb-1 text-foreground">Check-in End (IST)</span>
                            <input
                                type="datetime-local"
                                required
                                value={checkInEndTime}
                                onChange={(e) => setCheckInEndTime(e.target.value)}
                                className="w-full min-h-11 px-2.5 rounded-lg border border-input bg-background text-foreground text-xs"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-medium">Window duration:</span>
                        {[15, 20, 30, 45, 60].map((mins) => (
                            <button
                                key={mins}
                                type="button"
                                onClick={() => applyPreset(mins)}
                                className="min-h-11 px-3 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground font-semibold transition-colors"
                            >
                                {mins}m
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="font-semibold block mb-1 text-foreground">
                            Debate Motion <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <textarea
                            required
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                            placeholder="Enter the required debate motion or topic..."
                            rows={3}
                            className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 px-4 py-2 rounded-lg border text-foreground font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="min-h-11 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5"
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
