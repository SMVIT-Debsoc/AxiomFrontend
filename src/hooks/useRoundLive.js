import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {usePageRequests} from "./usePageRequests";
import {useAuth} from "../auth/client.jsx";
import {AdminApi, CLIENT_ID} from "../services/api";
import {useRoundSocket, useEventSocket, useSocket, SocketEvents, useLiveRefresh} from "./useSocket";
import {useToast} from "./useToast";
import {useAdminMutation} from "./useAdminMutation";
import {useDebouncedCallback} from "./useAdminRealtime";
import {
    createPatchLog, mergeEntities, mergeRecord, upsertEntity, isOwnEcho, applyListPayload,
    listPayloadIds, withoutMeta, adoptDebateCurrent, relabelDebateConflict,
} from "../lib/liveMerge";

const LIVE_ROUND_FIELDS = ["round", "performers"];
const LIVE_SUPPORT_FIELDS = ["rooms", "roster"];
export const BUSY_KEYS = ["generating", "allocating", "publishing", "results", "preview", "window", "status", "promoting"];
const PAIRINGS_PUBLISHED_PROMPT = "Draw already published — regenerate anyway? Debaters will see the new draw.";

// Stable callback identity for memoized children, always calling the latest closure.
export function useStableHandler(fn) {
    const ref = useRef(fn);
    useLayoutEffect(() => { ref.current = fn; });
    return useCallback((...args) => ref.current(...args), []);
}

const removeFromSet = (set, value) => {
    const next = new Set(set);
    next.delete(value);
    return next;
};

const sortRounds = (list) => list.slice().sort((a, b) => a.roundNumber - b.roundNumber);
const pickLiveRound = (list) => list.find((r) => String(r.status).toUpperCase() === "ONGOING")
    || list.find((r) => String(r.status).toUpperCase() !== "COMPLETED")
    || list[list.length - 1];

/**
 * One source of truth for the Live stations: rounds of the selected event, the
 * selected round with its debates / check-ins / performers, rooms and roster,
 * every socket subscription, the patch log that protects socket patches from
 * older refetches, and all round actions (each through useAdminMutation).
 *
 * Options:
 *  - eventId: selected event (from AdminEventProvider)
 *  - preferredRoundId: a round to select once the event's rounds are loaded (URL ?round=)
 *  - openDebateIdRef: ref holding the debate currently open in a sheet, so a
 *    socket deletion of it can be announced
 */
export function useRoundLive({eventId, preferredRoundId = null, openDebateIdRef} = {}) {
    const {getToken} = useAuth();
    const toast = useToast();
    const {run, isBusy} = useAdminMutation();
    // Every local/socket patch bumps this log so an older refetch can't wipe it.
    const [patchLog] = useState(createPatchLog);

    const [rounds, setRounds] = useState([]);
    const [roundId, setRoundIdState] = useState(null);
    const [round, setRound] = useState(null);
    const [checkIns, setCheckIns] = useState([]);
    const [debates, setDebates] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [performers, setPerformers] = useState([]);
    const [eliminatedIds, setEliminatedIds] = useState(() => new Set());
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [roundsLoaded, setRoundsLoaded] = useState(false);
    const [pendingCheckIns, setPendingCheckIns] = useState(() => new Set());
    const [promotingIds, setPromotingIds] = useState(() => new Set());
    const [savingDebateId, setSavingDebateId] = useState(null);
    const busy = BUSY_KEYS.find((key) => isBusy(key)) || "";

    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
    const activeRound = useRef(roundId);
    useEffect(() => { activeRound.current = roundId; }, [roundId]);
    const selectedEvent = useRef(eventId);
    useEffect(() => { selectedEvent.current = eventId; }, [eventId]);
    const preferredRef = useRef(preferredRoundId);
    useEffect(() => { preferredRef.current = preferredRoundId; }, [preferredRoundId]);
    const userChoseRound = useRef(false);

    const setRoundId = useCallback((id) => {
        userChoseRound.current = true;
        setRoundIdState(id);
    }, []);

    const choose = useCallback((list) => {
        const preferred = preferredRef.current && list.find((r) => r.id === preferredRef.current);
        return preferred || pickLiveRound(list);
    }, []);

    // Rounds of the selected event
    const refreshRoundsList = useCallback(async (selectPreferred = false) => {
        if (!eventId) return;
        try {
            const token = await getTokenRef.current();
            const res = await AdminApi.apiRequest(`/rounds/event/${eventId}?view=summary`, "GET", null, token, {skipCache: true});
            if (selectedEvent.current !== eventId) return;
            const list = sortRounds(res.success ? res.rounds || [] : []);
            setRounds(list);
            if (selectPreferred || (activeRound.current && !list.some((r) => r.id === activeRound.current))) {
                const live = choose(list);
                setRoundIdState(live?.id || null);
                if (!live) setLoading(false);
            }
        } catch {
            toast.error("Error", "Failed to load rounds");
            setLoading(false);
        }
    }, [eventId, toast, choose]);

    useEffect(() => {
        setRounds([]);
        setRoundIdState(null);
        setRoundsLoaded(false);
        userChoseRound.current = false;
        setLoading(Boolean(eventId));
        if (!eventId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const token = await getTokenRef.current();
                const res = await AdminApi.apiRequest(`/rounds/event/${eventId}?view=summary`, "GET", null, token);
                if (cancelled) return;
                const list = sortRounds(res.success ? res.rounds || [] : []);
                setRounds(list);
                const live = choose(list);
                setRoundIdState(live?.id || null);
                if (!live) setLoading(false);
            } catch {
                if (!cancelled) { toast.error("Error", "Failed to load rounds"); setLoading(false); }
            } finally {
                if (!cancelled) setRoundsLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [eventId, toast, choose]);

    // A deep link / URL change to another round of this event.
    useEffect(() => {
        if (!preferredRoundId || preferredRoundId === activeRound.current) return;
        if (rounds.some((r) => r.id === preferredRoundId)) setRoundIdState(preferredRoundId);
    }, [preferredRoundId, rounds]);

    useEffect(() => {
        setRound(null);
        setCheckIns([]);
        setDebates([]);
        setPerformers([]);
        setEliminatedIds(new Set());
        setResultsPublished(false);
    }, [roundId]);

    const refreshRound = usePageRequests(LIVE_ROUND_FIELDS, async (field, token, options, isCurrent) => {
        if (!roundId) return;
        if (field === "round" && !options.skipCache) setLoading(true);
        // Patches applied after this point win over this (older) snapshot.
        const startedAt = patchLog.begin();
        try {
            const url = field === "round" ? `/rounds/${roundId}` : `/admin/rounds/${roundId}/performers`;
            const response = await AdminApi.apiRequest(url, "GET", null, token, options);
            if (!isCurrent() || !response.success) return;
            if (field === "round" && response.round.eventId === eventId) {
                const fresh = response.round;
                const roundPatched = patchLog.since(startedAt, "round");
                setRound((prev) => mergeRecord(fresh, prev?.id === fresh.id ? prev : null, roundPatched));
                setCheckIns((prev) => mergeEntities(fresh.checkIns || [], prev, patchLog.since(startedAt, "checkIn"), "userId"));
                setDebates((prev) => mergeEntities(fresh.debates || [], prev, patchLog.since(startedAt, "debate")));
                setEliminatedIds(new Set(fresh.eliminatedUserIds || []));
                if (!roundPatched?.has("resultsPublished")) setResultsPublished(Boolean(fresh.resultsPublished));
            } else if (field === "performers") {
                setPerformers((prev) => mergeEntities(response.performers || [], prev, patchLog.since(startedAt, "performer"), "userId"));
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
    const debouncedRefetch = useDebouncedCallback(softRefetch, 800);
    // A socket echo of this admin's own mutation is already applied locally.
    const refetchUnlessOwn = useCallback((data) => {
        if (!isOwnEcho(data, CLIENT_ID)) softRefetch();
    }, [softRefetch]);
    const patchDebates = useCallback((ids, updater) => {
        (Array.isArray(ids) ? ids : [ids]).forEach((id) => patchLog.mark("debate", id));
        setDebates(updater);
    }, [patchLog]);
    const patchRound = useCallback((fields, updater) => {
        fields.forEach((field) => patchLog.mark("round", field));
        setRound((prev) => (prev ? updater(prev) : prev));
    }, [patchLog]);
    const patchCheckIn = useCallback((userId, updater) => {
        patchLog.mark("checkIn", userId);
        setCheckIns(updater);
    }, [patchLog]);
    const patchPerformers = useCallback((userIds, updater) => {
        userIds.forEach((id) => patchLog.mark("performer", id));
        setPerformers(updater);
    }, [patchLog]);
    useLiveRefresh(() => {
        softRefetch();
        refreshSupport(...LIVE_SUPPORT_FIELDS);
        refreshRoundsList();
    }, {eventId, roundId, jitterMs: 3000, invalidateCache: false});

    const knownUserIds = useRef(new Set());
    const handleRealtimeCheckIn = useCallback((data) => {
        const targetUserId = data?.userId || data?.user?.id;
        if (!targetUserId) {
            softRefetch();
            return;
        }
        patchCheckIn(targetUserId, (prev) => {
            const exists = prev.some((c) => c.userId === targetUserId);
            const patch = {status: data.status, ...(data.user ? {user: data.user} : {}), ...(data.updatedAt ? {updatedAt: data.updatedAt} : {})};
            if (exists) {
                return prev.map((c) => (c.userId === targetUserId ? {...c, ...patch} : c));
            }
            return [...prev, {userId: targetUserId, ...patch}];
        });
        // Unknown participant without profile data: fetch the roster, not the whole round.
        if (!data.user && !knownUserIds.current.has(targetUserId)) refreshSupport("roster");
        if (data.user) {
            setUsers((prev) => (prev.some((u) => u.id === targetUserId) ? prev : [...prev, data.user]));
        }
    }, [softRefetch, patchCheckIn, refreshSupport]);

    const handleRealtimeWindow = useCallback((data) => {
        if (data && data.roundId && data.roundId !== roundId) return;
        patchRound(["checkInStartTime", "checkInEndTime"], (prev) => ({
            ...prev,
            checkInStartTime: data?.checkInStartTime !== undefined ? data.checkInStartTime : prev.checkInStartTime,
            checkInEndTime: data?.checkInEndTime !== undefined ? data.checkInEndTime : prev.checkInEndTime,
        }));
    }, [roundId, patchRound]);

    const awaitingPairings = useRef(false);
    useRoundSocket(roundId, {
        onCheckInUpdate: handleRealtimeCheckIn,
        onPairingsGenerated: (data) => {
            if (Array.isArray(data?.debates)) {
                // Replace only when the server marks the list complete; else upsert.
                const complete = data.complete === true;
                patchDebates(listPayloadIds(data.debates, {complete}), (prev) => applyListPayload(prev, data.debates, {complete}));
                if (awaitingPairings.current) softRefetch();
            } else {
                softRefetch();
            }
            awaitingPairings.current = false;
        },
        onRoomsAllocated: (data) => {
            if (Array.isArray(data?.debates) && data.debates.length) {
                const complete = data.complete === true;
                patchDebates(listPayloadIds(data.debates, {complete}), (prev) => applyListPayload(prev, data.debates, {complete}));
            } else {
                refetchUnlessOwn(data);
            }
        },
        onDebateResult: (data) => {
            patchDebates(data.debateId, (prev) => prev.map((d) => d.id === data.debateId
                ? {
                    ...d,
                    winnerId: data.winnerId,
                    debater1Score: data.debater1Score,
                    debater2Score: data.debater2Score,
                    status: "COMPLETED",
                    ...(data.ballotFlags !== undefined ? {ballotFlags: data.ballotFlags} : {}),
                    ...(data.resultSource !== undefined ? {resultSource: data.resultSource} : {}),
                    ...(data.updatedAt ? {updatedAt: data.updatedAt} : {}),
                } : d));
            refreshRound("performers");
        },
        onRoundStatusChange: (data) => {
            const fields = withoutMeta(data);
            patchRound(Object.keys(fields), (prev) => ({...prev, ...fields}));
            setRounds((prev) => prev.map((r) => (r.id === (data?.roundId || roundId) ? {...r, status: data?.status ?? r.status} : r)));
        },
        onPairingsPublished: (data) => patchRound(["pairingsPublished"], (prev) => ({
            ...prev,
            pairingsPublished: data.published,
            ...(data.pairingsPublishedAt !== undefined ? {pairingsPublishedAt: data.pairingsPublishedAt} : {}),
        })),
        onResultsPublished: (data) => {
            patchLog.mark("round", "resultsPublished");
            setResultsPublished(Boolean(data.published));
        },
        onRoundUpdated: (data) => {
            if (data?.round) patchRound(Object.keys(data.round), (prev) => ({...prev, ...data.round}));
        },
        onDebateCreated: (data) => {
            if (data?.debate?.id) patchDebates(data.debate.id, (prev) => upsertEntity(prev, data.debate));
            else refetchUnlessOwn(data);
        },
        onDebateUpdated: (data) => {
            if (data?.debate?.id) patchDebates(data.debate.id, (prev) => upsertEntity(prev, data.debate));
            else refetchUnlessOwn(data);
        },
        onDebateDeleted: (data) => {
            if (!data?.debateId) { softRefetch(); return; }
            patchDebates(data.debateId, (prev) => prev.filter((d) => d.id !== data.debateId));
            if (openDebateIdRef?.current && data.debateId === openDebateIdRef.current) {
                toast.error("Ballot closed", "This debate was removed (the draw was regenerated).");
            }
        },
    });

    useEventSocket(eventId, {
        onRoundCreated: (data) => {
            if (data?.round) {
                setRounds((prev) => (
                    prev.some((r) => r.id === data.round.id)
                        ? prev.map((r) => (r.id === data.round.id ? {...r, ...data.round} : r))
                        : sortRounds([...prev, data.round])
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

    // Another admin added/edited/removed a room.
    useEffect(() => subscribeLive(SocketEvents.ROOMS_UPDATED, () => refreshSupport("rooms")), [subscribeLive, refreshSupport]);

    // A judge's e-ballot landed: apply flags now, then pick up scores (debate:result
    // normally follows; a debounced refetch covers servers that only send this).
    useEffect(() => {
        if (!roundId || !SocketEvents.BALLOT_SUBMITTED) return undefined;
        return subscribeLive(SocketEvents.BALLOT_SUBMITTED, (data) => {
            if (!data?.debateId || (data.roundId && data.roundId !== roundId)) return;
            patchDebates(data.debateId, (prev) => prev.map((d) => (d.id === data.debateId ? {
                ...d,
                ...(data.flags !== undefined ? {ballotFlags: data.flags} : {}),
                ...(data.source ? {resultSource: String(data.source).toUpperCase()} : {}),
            } : d)));
            debouncedRefetch();
        });
    }, [subscribeLive, roundId, patchDebates, debouncedRefetch]);

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
    useLayoutEffect(() => { knownUserIds.current = new Set(people.map((u) => u.id)); }, [people]);
    const presentIds = useMemo(() => new Set(checkIns.filter((c) => c.status === "PRESENT").map((c) => c.userId)), [checkIns]);
    const eliminatedSet = useMemo(() => {
        const set = new Set(eliminatedIds);
        for (const p of performers) {
            if (p.won === false && !p.isPromoted) set.add(p.userId);
        }
        return set;
    }, [eliminatedIds, performers]);

    const promotionsAt = useRef(0);
    const applyPromotedIds = (promotedIds, updatedAt) => {
        const at = updatedAt ? Date.parse(updatedAt) : NaN;
        if (Number.isFinite(at)) {
            if (at < promotionsAt.current) return; // older than what we already show
            promotionsAt.current = at;
        } else if (promotionsAt.current > 0) {
            // Unversioned (older server) and a versioned list is already shown: it
            // may be older than that list, so let the newer one stand.
            return;
        }
        const promoted = new Set(promotedIds);
        const touched = new Set([...promoted, ...performers.filter((p) => p.isPromoted).map((p) => p.userId)]);
        patchPerformers([...touched], (prev) => prev.map((p) => (
            Boolean(p.isPromoted) === promoted.has(p.userId) ? p : {...p, isPromoted: promoted.has(p.userId)}
        )));
    };
    const applyPromotedIdsRef = useRef(applyPromotedIds);
    useLayoutEffect(() => { applyPromotedIdsRef.current = applyPromotedIds; });
    const [promotionsVersion, setPromotionsVersion] = useState(0);

    // Promotion changes from any admin: promotedIds is the full, current list.
    useEffect(() => { promotionsAt.current = 0; }, [roundId]);
    useEffect(() => {
        if (!roundId) return undefined;
        return subscribeLive(SocketEvents.ROUND_PROMOTIONS, (data) => {
            if (data?.roundId !== roundId || !Array.isArray(data.promotedIds)) return;
            applyPromotedIdsRef.current(data.promotedIds, data.updatedAt);
            setPromotionsVersion((v) => v + 1);
        });
    }, [subscribeLive, roundId]);

    // ----- actions -----
    // Check-ins come in bursts: trust the PUT result + socket, no refetch/toast per tap.
    const toggleCheckIn = useStableHandler(async (userId, nextStatus = "PRESENT") => {
        if (pendingCheckIns.has(userId)) return;

        if (nextStatus === "PRESENT" && eliminatedSet.has(userId)) {
            toast.error("Debater eliminated", "Eliminated debaters cannot check in for later rounds.");
            return;
        }

        const requestRoundId = roundId;
        const previousEntry = checkIns.find((c) => c.userId === userId) || null;
        setPendingCheckIns((prev) => new Set(prev).add(userId));
        const userObj = people.find((u) => u.id === userId);
        patchCheckIn(userId, (prev) => (
            prev.some((c) => c.userId === userId)
                ? prev.map((c) => (c.userId === userId ? {...c, status: nextStatus} : c))
                : [...prev, {userId, status: nextStatus, ...(userObj ? {user: userObj} : {})}]
        ));
        // Revert only this user, and only if nobody changed them since.
        const rollback = () => {
            if (activeRound.current !== requestRoundId) return;
            patchCheckIn(userId, (prev) => {
                const current = prev.find((c) => c.userId === userId);
                if (!current || current.status !== nextStatus) return prev;
                return previousEntry
                    ? prev.map((c) => (c.userId === userId ? previousEntry : c))
                    : prev.filter((c) => c.userId !== userId);
            });
        };

        try {
            const token = await getToken();
            const res = await AdminApi.apiRequest(`/check-in/round/${requestRoundId}/user/${userId}`, "PUT", {status: nextStatus}, token);
            if (activeRound.current !== requestRoundId) return;
            const saved = res.checkIn || res.data?.checkIn;
            if (saved?.userId === userId) {
                patchCheckIn(userId, (prev) => prev.map((c) => (c.userId === userId ? {...c, ...saved, user: c.user || saved.user} : c)));
            }
        } catch (err) {
            rollback();
            if (err?.code === "DEBATE_LOCKED") {
                toast.error("Can't mark absent", err.message || "Their debate has already started or been scored. Showing the latest state.");
                softRefetch();
            } else {
                toast.error("Check-in failed", err?.message || "Failed to update check-in status");
            }
        } finally {
            setPendingCheckIns((prev) => removeFromSet(prev, userId));
        }
    });

    /** Apply a check-in the server already recorded (scan result). */
    const applyCheckIn = useStableHandler((checkIn, user) => {
        const userId = checkIn?.userId || user?.id;
        if (!userId || activeRound.current !== roundId) return;
        patchCheckIn(userId, (prev) => (
            prev.some((c) => c.userId === userId)
                ? prev.map((c) => (c.userId === userId ? {...c, status: "PRESENT", ...checkIn, user: c.user || user || checkIn?.user} : c))
                : [...prev, {userId, status: "PRESENT", ...checkIn, ...(user ? {user} : {})}]
        ));
        if (user) setUsers((prev) => (prev.some((u) => u.id === userId) ? prev : [...prev, user]));
    });

    const updateCheckInWindow = useStableHandler(async ({checkInStartTime, checkInEndTime}) => {
        const res = await run("window", async () => {
            const token = await getToken();
            return AdminApi.updateRound(roundId, {checkInStartTime, checkInEndTime}, token);
        }, {
            success: "Check-in window updated",
            onSuccess: (result) => patchRound(["checkInStartTime", "checkInEndTime"], (prev) => ({
                ...prev, checkInStartTime, checkInEndTime, ...(result?.round || {}),
            })),
            onConflict: softRefetch,
        });
        return Boolean(res);
    });

    const updateRoundStatus = useStableHandler(async (status) => {
        if (!round || round.status === status) return;
        await run("status", async () => {
            const token = await getToken();
            return AdminApi.updateRound(roundId, {status}, token);
        }, {
            confirm: status === "COMPLETED"
                ? `Mark ${round.name || `Round ${round.roundNumber}`} as COMPLETED? Debaters will see the round as finished.`
                : undefined,
            success: `Round marked ${status}`,
            onSuccess: () => {
                patchRound(["status"], (prev) => ({...prev, status}));
                setRounds((prev) => prev.map((r) => (r.id === roundId ? {...r, status} : r)));
            },
            onConflict: softRefetch,
        });
    });

    // Judge / room edits share one conflict-safe path (expectedUpdatedAt + 409 adopt).
    const updateDebateFields = useStableHandler(async (debateId, fields, {success} = {}) => {
        setSavingDebateId(debateId);
        const expectedUpdatedAt = debates.find((d) => d.id === debateId)?.updatedAt;
        try {
            const res = await run(`debate:${debateId}`, async () => {
                const token = await getToken();
                try {
                    return await AdminApi.updateDebate(debateId, fields, token, {expectedUpdatedAt});
                } catch (err) {
                    throw relabelDebateConflict(err);
                }
            }, {
                success,
                onSuccess: (result) => patchDebates(debateId, (prev) => prev.map((d) => {
                    if (d.id !== debateId) return d;
                    const next = {...d, ...fields, ...(result?.debate?.updatedAt ? {updatedAt: result.debate.updatedAt} : {})};
                    if ("judgeName" in fields) { next.adjudicator = null; next.adjudicatorId = null; }
                    if ("roomId" in fields) next.room = fields.roomId ? rooms.find((r) => r.id === fields.roomId) || result?.debate?.room || null : null;
                    return next;
                })),
                onConflict: (err) => {
                    const current = err?.data?.current;
                    if (current?.id === debateId) {
                        patchDebates(debateId, (prev) => prev.map((d) => (d.id === debateId ? adoptDebateCurrent(d, current, {rooms}) : d)));
                    }
                    softRefetch();
                },
            });
            return Boolean(res);
        } finally {
            setSavingDebateId((current) => (current === debateId ? null : current));
        }
    });

    const assignJudge = useStableHandler((debateId, judgeName) => updateDebateFields(debateId, {judgeName}, {
        success: judgeName ? `Assigned ${judgeName}` : "Judge cleared",
    }));
    const assignRoom = useStableHandler((debateId, roomId) => updateDebateFields(debateId, {roomId: roomId || null}, {
        success: roomId ? `Moved to ${rooms.find((r) => r.id === roomId)?.name || "room"}` : "Room cleared",
    }));

    // Send only this admin's change ({add}/{remove}) so concurrent toggles merge on the server.
    const togglePromotePerformer = useStableHandler(async (userId) => {
        if (promotingIds.has(userId)) return;
        const performer = performers.find((p) => p.userId === userId);
        const promote = !performer?.isPromoted;
        setPromotingIds((prev) => new Set(prev).add(userId));
        patchPerformers([userId], (prev) => prev.map((p) => (p.userId === userId ? {...p, isPromoted: promote} : p)));
        const revert = () => patchPerformers([userId], (prev) => prev.map((p) => (
            p.userId === userId && p.isPromoted === promote ? {...p, isPromoted: !promote} : p
        )));
        try {
            await run(`promote:${userId}`, async () => {
                const token = await getToken();
                return AdminApi.updatePromotions(roundId, promote ? {add: [userId]} : {remove: [userId]}, token);
            }, {
                success: promote ? "Debater advanced" : "Advance removed",
                onSuccess: (res) => { if (Array.isArray(res?.promotedIds)) applyPromotedIds(res.promotedIds, res.updatedAt); },
                onError: revert,
                onConflict: () => refreshRound("performers"),
            });
        } finally {
            setPromotingIds((prev) => removeFromSet(prev, userId));
        }
    });

    /** Apply a delta {add, remove} (Advance panel's cut line). Optimistic, rolled back on error. */
    const applyPromotionDelta = useStableHandler(async ({add = [], remove = []}) => {
        if (!add.length && !remove.length) {
            toast.info("Nothing to change", "Everyone above the line is already advanced.");
            return false;
        }
        const addSet = new Set(add);
        const removeSet = new Set(remove);
        const touched = [...add, ...remove];
        patchPerformers(touched, (prev) => prev.map((p) => (
            addSet.has(p.userId) ? {...p, isPromoted: true} : removeSet.has(p.userId) ? {...p, isPromoted: false} : p
        )));
        const res = await run("promoting", async () => {
            const token = await getToken();
            return AdminApi.updatePromotions(roundId, {add, remove}, token);
        }, {
            success: `Advanced ${add.length}${remove.length ? `, removed ${remove.length}` : ""}`,
            onSuccess: (r) => { if (Array.isArray(r?.promotedIds)) applyPromotedIds(r.promotedIds, r.updatedAt); },
            onError: () => patchPerformers(touched, (prev) => prev.map((p) => (
                addSet.has(p.userId) && p.isPromoted ? {...p, isPromoted: false} : removeSet.has(p.userId) && !p.isPromoted ? {...p, isPromoted: true} : p
            ))),
            onConflict: () => refreshRound("performers"),
        });
        return Boolean(res);
    });

    const promoteAllWinners = useStableHandler(async () => {
        const add = performers.filter((p) => p.won && !p.isPromoted).map((p) => p.userId);
        if (add.length === 0) {
            toast.info("Nothing to advance", "Every winner is already advanced.");
            return;
        }
        await applyPromotionDelta({add});
    });

    const previewPairings = useStableHandler(async () => run("preview", async () => {
        const token = await getToken();
        return AdminApi.apiRequest(`/pairing/${roundId}/preview`, "GET", null, token, {skipCache: true});
    }));

    const generatePairings = useStableHandler(async () => {
        const hasDebates = debates.length > 0;
        const isRound1 = round?.roundNumber === 1;
        const message = hasDebates
            ? "Regenerate the draw? This DELETES every debate in this round that is not completed. This cannot be undone."
            : `Generate the ${isRound1 ? "round 1 (random)" : "power-matched"} draw? This ends check-in.`;
        const requestRoundId = roundId;
        const generate = async (force) => {
            const token = await getToken();
            return isRound1
                ? AdminApi.generateRound1Pairings(requestRoundId, token, {force})
                : AdminApi.generatePowerMatchPairings(requestRoundId, token, {force});
        };
        const res = await run("generating", async () => {
            try {
                return await generate(false);
            } catch (err) {
                if (err?.code === "PAIRINGS_PUBLISHED") {
                    if (!window.confirm(PAIRINGS_PUBLISHED_PROMPT)) return null;
                    return generate(true);
                }
                if (err?.code === "PAIRING_IN_PROGRESS") {
                    // The other admin's pairings:generated event will refresh this page.
                    awaitingPairings.current = true;
                    toast.info("Draw in progress", "Another admin is generating the draw. This page updates when they finish.");
                    return null;
                }
                throw err;
            }
        }, {confirm: message, onConflict: softRefetch});
        if (!res || activeRound.current !== requestRoundId) return false;
        toast.success("Draw generated", `Created ${res.data?.pairingsCreated ?? 0} debates.`);
        softRefetch();
        return true;
    });

    // onlyUnassigned fills only debates without a room, so manual room edits
    // (possibly by another admin) are not overwritten.
    const allocateRooms = useStableHandler(async (formData, {onlyUnassigned = false} = {}) => {
        const res = await run("allocating", async () => {
            const token = await getToken();
            return AdminApi.allocateRooms(roundId, formData, token, {onlyUnassigned});
        }, {
            success: (r) => `Allocated rooms for ${r?.data?.debatesAllocated || 0} debates.`,
            onSuccess: (r) => {
                if (Array.isArray(r?.data?.debates)) {
                    const complete = r.data.complete === true;
                    patchDebates(listPayloadIds(r.data.debates, {complete}), (prev) => applyListPayload(prev, r.data.debates, {complete}));
                } else softRefetch();
            },
            onConflict: softRefetch,
        });
        return Boolean(res);
    });

    const togglePublish = useStableHandler(async () => {
        const nextVal = !round?.pairingsPublished;
        const res = await run("publishing", async () => {
            const token = await getToken();
            return AdminApi.apiRequest(`/rounds/${roundId}`, "PUT", {pairingsPublished: nextVal}, token);
        }, {
            confirm: nextVal ? undefined : "Unpublish the draw? Debaters will stop seeing their rooms and opponents.",
            success: nextVal ? "The draw is now visible to debaters." : "The draw is now hidden from debaters.",
            onSuccess: (r) => patchRound(["pairingsPublished"], (prev) => ({
                ...prev,
                pairingsPublished: nextVal,
                ...(r?.round?.pairingsPublishedAt !== undefined ? {pairingsPublishedAt: r.round.pairingsPublishedAt} : {}),
                ...(r?.round?.updatedAt ? {updatedAt: r.round.updatedAt} : {}),
            })),
            onConflict: softRefetch,
        });
        return Boolean(res);
    });

    const publishResults = useStableHandler(async () => {
        const nextVal = !resultsPublished;
        await run("results", async () => {
            const token = await getToken();
            return AdminApi.publishResults(roundId, nextVal, token);
        }, {
            confirm: nextVal ? undefined : "Hide results? Debaters will no longer see this round's results.",
            success: nextVal ? "Results are now public." : "Results are hidden again.",
            onSuccess: () => {
                patchLog.mark("round", "resultsPublished");
                setResultsPublished(nextVal);
            },
            onConflict: softRefetch,
        });
    });

    // Resolves true only when the motion was saved, so editors close on success only.
    const saveMotion = useStableHandler(async (newMotion) => {
        const res = await run("motion", async () => {
            const token = await getToken();
            return AdminApi.updateRound(roundId, {motion: newMotion}, token);
        }, {
            success: "Motion updated",
            onSuccess: () => patchRound(["motion"], (r) => ({...r, motion: newMotion})),
            onConflict: softRefetch,
        });
        return Boolean(res);
    });

    /** InlineResultSheet / paper entry onSaved: patch the debate, refresh performers. */
    const applyResultSaved = useStableHandler(({debateId, debater1Score, debater2Score, winnerId}, saved) => {
        patchDebates(debateId, (prev) => prev.map((d) => d.id === debateId ? {
            ...d,
            debater1Score: saved?.debater1Score ?? debater1Score,
            debater2Score: saved?.debater2Score ?? debater2Score,
            winnerId: saved?.winnerId ?? winnerId,
            status: "COMPLETED",
            ...(saved?.ballotFlags !== undefined ? {ballotFlags: saved.ballotFlags} : {}),
            ...(saved?.resultSource !== undefined ? {resultSource: saved.resultSource} : {}),
            ...(saved?.updatedAt ? {updatedAt: saved.updatedAt} : {}),
        } : d));
        const hasOtherPending = debates.some((debate) => debate.id !== debateId && debate.status !== "COMPLETED");
        if (hasOtherPending) refreshRound("performers");
        else softRefetch();
    });

    const ballotReplaced = useStableHandler((err) => {
        toast.error("Ballot not saved", err?.message || "This debate was replaced by a new draw.");
        softRefetch();
    });

    const addRound = useStableHandler((newRound) => {
        setRounds((prev) => sortRounds([...prev.filter((r) => r.id !== newRound.id), newRound]));
        setRoundId(newRound.id);
    });
    const addRoom = useStableHandler((newRoom) => {
        if (newRoom) setRooms((prev) => (prev.some((r) => r.id === newRoom.id) ? prev : [...prev, newRoom]));
        refreshSupport("rooms");
    });

    return {
        // data
        rounds, roundId, setRoundId, round, debates, checkIns, rooms, people, performers,
        presentIds, eliminatedSet, resultsPublished, loading, roundsLoaded,
        pendingCheckIns, promotingIds, savingDebateId, busy, isBusy, promotionsVersion,
        // refresh
        softRefetch, refreshRound, refreshSupport, refreshRoundsList,
        // actions
        toggleCheckIn, applyCheckIn, updateCheckInWindow, updateRoundStatus, assignJudge, assignRoom,
        togglePromotePerformer, applyPromotionDelta, promoteAllWinners, previewPairings, generatePairings,
        allocateRooms, togglePublish, publishResults, saveMotion, applyResultSaved, ballotReplaced,
        addRound, addRoom,
    };
}
