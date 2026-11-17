import {useEffect, useCallback, useRef, useSyncExternalStore} from "react";
import socketService, {SocketEvents} from "../services/socket";
import {clearApiCache} from "../services/api";

// Re-export SocketEvents for convenience
export {SocketEvents};

const VISIBILITY_RESYNC_MS = 30000;
const REALTIME_CACHE_PREFIXES = ["/events", "/rounds", "/debates", "/check-in", "/stats", "/admin"];

export function invalidateRealtimeCache() {
  REALTIME_CACHE_PREFIXES.forEach((prefix) => clearApiCache(prefix));
}

function invalidateSocketUpdate(handler, data, eventId, roundId) {
  if (handler === "onCheckInCount") return;
  if (handler === "onCheckInUpdate") {
    if (roundId) clearApiCache(`/check-in/round/${roundId}`);
    return;
  }
  if (handler === "onEventEnrollment" || handler === "onEventUpdated" || handler === "onEventDeleted") {
    if (eventId) clearApiCache(`/events/${eventId}`);
    return;
  }
  if (handler === "onLeaderboardUpdate") {
    clearApiCache((key) => key.includes("/stats/leaderboard") &&
      (!eventId || !key.includes("eventId=") || key.includes(`eventId=${eventId}"`)));
    return;
  }
  if (roundId) {
    clearApiCache(`/rounds/${roundId}`);
    clearApiCache(`/debates/round/${roundId}`);
  }
  if (eventId) {
    clearApiCache(`/events/${eventId}`);
    clearApiCache(`/rounds/event/${eventId}`);
  }
  if (handler.startsWith("onRound") || handler === "onPairingsPublished" || handler === "onResultsPublished") {
    clearApiCache("?view=dashboard");
  }
  if (handler.startsWith("onDebate") || handler === "onPairingsPublished" ||
      handler === "onRoomsAllocated" || handler === "onResultsPublished") {
    clearApiCache(eventId ? `/debates/my-debates?eventId=${eventId}` : "/debates/my-debates");
    if (data?.debateId) clearApiCache(`/debates/${data.debateId}`);
  }
}

/**
 * Keeps a view live even when WebSockets are disconnected or the browser tab was backgrounded:
 * - Refreshes on tab visibility return when hidden > 30s or the socket dropped meanwhile
 * - Refreshes once after the first room join (events between initial GET and join ack)
 * - Refreshes on socket reconnect after a disconnection
 * - Polls every `intervalMs` ONLY when the socket is disconnected and tab is visible
 */
export function useLiveRefresh(refreshFn, {
  enabled = true,
  intervalMs = 25000,
  jitterMs = 0,
  invalidateCache = true,
  eventId,
  roundId,
} = {}) {
  const refreshRef = useRef(refreshFn);
  useEffect(() => {
    refreshRef.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    let wasDisconnected = !socketService.isConnected();
    const hasRooms = Boolean(eventId || roundId);
    const roomsReady = () => socketService.isRoomReady("event", eventId) &&
      socketService.isRoomReady("round", roundId);
    // Events emitted between the page's initial GET and the room-join ack are
    // lost, so the first room-ready after mount triggers one resync.
    let needsRoomRefresh = hasRooms && !roomsReady();
    let hiddenAt = document.visibilityState === "visible" ? null : Date.now();
    let disconnectedWhileHidden = false;

    const triggerRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (invalidateCache) invalidateRealtimeCache();
      refreshRef.current?.();
    };

    const unsubConnect = socketService.on(SocketEvents.CONNECTION, () => {
      if (wasDisconnected) {
        wasDisconnected = false;
        if (hasRooms) needsRoomRefresh = true;
        else triggerRefresh();
      }
    });

    const unsubDisconnect = socketService.on(SocketEvents.DISCONNECT, () => {
      wasDisconnected = true;
      needsRoomRefresh = hasRooms;
      if (document.visibilityState !== "visible") disconnectedWhileHidden = true;
    });
    const unsubRoomReady = socketService.onRoomReady((type, id) => {
      if ((type === "event" ? id === eventId : id === roundId) && needsRoomRefresh && roomsReady()) {
        needsRoomRefresh = false;
        triggerRefresh();
      }
    });

    // Returning to the tab only resyncs when updates could have been missed:
    // the tab was hidden long enough for the browser to throttle/suspend the
    // socket, or the socket dropped meanwhile. A quick tab switch keeps caches.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        hiddenAt = Date.now();
        disconnectedWhileHidden = false;
        return;
      }
      const hiddenFor = hiddenAt == null ? 0 : Date.now() - hiddenAt;
      const missed = disconnectedWhileHidden || !socketService.isConnected() || !roomsReady();
      hiddenAt = null;
      disconnectedWhileHidden = false;
      if (hiddenFor > VISIBILITY_RESYNC_MS || missed) triggerRefresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let timer;
    const schedulePoll = () => {
      timer = window.setTimeout(() => {
        if (!socketService.isConnected() || !roomsReady()) {
          if (document.visibilityState === "visible") {
            needsRoomRefresh = hasRooms;
            socketService.retryRoom("event", eventId);
            socketService.retryRoom("round", roundId);
            triggerRefresh();
          }
        }
        schedulePoll();
      }, intervalMs + Math.random() * jitterMs);
    };
    schedulePoll();

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubRoomReady();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearTimeout(timer);
    };
  }, [enabled, intervalMs, jitterMs, invalidateCache, eventId, roundId]);
}

/**
 * Hook to manage socket connection and event subscriptions
 *
 * @param {Object} options - Configuration options
 * @param {string} options.eventId - Event ID to join (optional)
 * @param {string} options.roundId - Round ID to join (optional)
 * @param {boolean} options.autoConnect - Whether to auto-connect on mount (default: true)
 * @returns {Object} Socket utilities
 */
export function useSocket({eventId, roundId, autoConnect = true} = {}) {
  // Connect on mount
  useEffect(() => {
    if (autoConnect) {
      socketService.connect();
    }

    return () => {
      // Don't disconnect on unmount - let the singleton manage the connection
      // Just clean up any subscriptions
    };
  }, [autoConnect]);

  // Join/leave event room
  useEffect(() => {
    if (eventId) {
      socketService.joinEvent(eventId);
    }

    return () => {
      if (eventId) {
        socketService.leaveEvent(eventId);
      }
    };
  }, [eventId]);

  // Join/leave round room
  useEffect(() => {
    if (roundId) {
      socketService.joinRound(roundId);
    }

    return () => {
      if (roundId) {
        socketService.leaveRound(roundId);
      }
    };
  }, [roundId]);

  /**
   * Subscribe to a socket event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  const subscribe = useCallback((event, callback) => {
    return socketService.on(event, callback);
  }, []);

  /**
   * Unsubscribe from a socket event
   */
  const unsubscribe = useCallback((event, callback) => {
    socketService.off(event, callback);
  }, []);


  const joinEvent = useCallback((id) => socketService.joinEvent(id), []);
  const leaveEvent = useCallback((id) => socketService.leaveEvent(id), []);
  const joinRound = useCallback((id) => socketService.joinRound(id), []);
  const leaveRound = useCallback((id) => socketService.leaveRound(id), []);

  return {
    socket: socketService.getSocket(),
    subscribe,
    unsubscribe,
    isConnected: socketService.isConnected(),
    joinEvent,
    leaveEvent,
    joinRound,
    leaveRound,
    SocketEvents,
  };
}

function subscribeToStatus(onChange) {
  const unsubConnect = socketService.on(SocketEvents.CONNECTION, onChange);
  const unsubDisconnect = socketService.on(SocketEvents.DISCONNECT, onChange);
  return () => { unsubConnect(); unsubDisconnect(); };
}

/**
 * Subscribe to the socket's external connection state, including changes
 * between render and subscription, without a synchronous effect update.
 */
export function useSocketStatus() {
  return useSyncExternalStore(
    subscribeToStatus,
    () => socketService.isConnected(),
    () => false,
  );
}

/**
 * Hook for event-specific real-time updates
 * Automatically joins the event room and provides callbacks for common events
 */
export function useEventSocket(eventId, callbacks = {}) {
  const {subscribe} = useSocket({eventId});

  // Use ref to keep callbacks current without triggering re-effects
  const callbacksRef = useRef(callbacks);

  // Update ref whenever callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!eventId) return;

    const unsubscribers = [];

    // Helper to invalidate stale cached GET responses and call current callback safely
    const callHandler = (handlerName, data) => {
      if (data?.eventId && data.eventId !== eventId) return;
      const handler = callbacksRef.current[handlerName];
      if (!handler) return;
      invalidateSocketUpdate(handlerName, data, eventId, data?.roundId);
      handler(data);
    };

    // Check-in count updates
    unsubscribers.push(
      subscribe(SocketEvents.CHECKIN_COUNT, (data) =>
        callHandler("onCheckInCount", data)
      )
    );

    // Check-in window updates
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_CHECKIN_WINDOW, (data) =>
        callHandler("onRoundCheckInWindow", data)
      )
    );

    // Round created
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_CREATED, (data) =>
        callHandler("onRoundCreated", data)
      )
    );

    // Round status changes
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_STATUS_CHANGE, (data) =>
        callHandler("onRoundStatusChange", data)
      )
    );

    // Pairings published
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_PAIRINGS_PUBLISHED, (data) =>
        callHandler("onPairingsPublished", data)
      )
    );

    // Results published
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_RESULTS_PUBLISHED, (data) =>
        callHandler("onResultsPublished", data)
      )
    );

    // Pairings generated
    unsubscribers.push(
      subscribe(SocketEvents.PAIRINGS_GENERATED, (data) =>
        callHandler("onPairingsGenerated", data)
      )
    );

    // Rooms allocated
    unsubscribers.push(
      subscribe(SocketEvents.ROOMS_ALLOCATED, (data) =>
        callHandler("onRoomsAllocated", data)
      )
    );

    // Debate result
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_RESULT, (data) =>
        callHandler("onDebateResult", data)
      )
    );

    // Leaderboard update
    unsubscribers.push(
      subscribe(SocketEvents.LEADERBOARD_UPDATE, (data) =>
        callHandler("onLeaderboardUpdate", data)
      )
    );

    // Event enrollment
    unsubscribers.push(
      subscribe(SocketEvents.EVENT_ENROLLMENT, (data) =>
        callHandler("onEventEnrollment", data)
      )
    );

    // Event updated needs to be handled too if we added it?
    // Wait, the hook didn't have EVENT_UPDATED before.
    // I should add it now since I added it to backend.

    // Event updated
    unsubscribers.push(
      subscribe(SocketEvents.EVENT_UPDATED, (data) =>
        callHandler("onEventUpdated", data)
      )
    );

    // Round updated
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_UPDATED, (data) =>
        callHandler("onRoundUpdated", data)
      )
    );

    // Round deleted
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_DELETED, (data) =>
        callHandler("onRoundDeleted", data)
      )
    );

    // Debate created
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_CREATED, (data) =>
        callHandler("onDebateCreated", data)
      )
    );
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_UPDATED, (data) => callHandler("onDebateUpdated", data)),
      subscribe(SocketEvents.DEBATE_DELETED, (data) => callHandler("onDebateDeleted", data))
    );

    // Event deleted
    unsubscribers.push(
      subscribe(SocketEvents.EVENT_DELETED, (data) =>
        callHandler("onEventDeleted", data)
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [eventId, subscribe]); // Removed callbacks from dependency
}

/**
 * Hook for round-specific real-time updates
 * Automatically joins the round room and provides callbacks for common events
 */
export function useRoundSocket(roundId, callbacks = {}) {
  const {subscribe} = useSocket({roundId});

  // Use ref to keep callbacks current without triggering re-effects
  const callbacksRef = useRef(callbacks);

  // Update ref whenever callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!roundId) return;

    const unsubscribers = [];

    // Helper to invalidate stale cached GET responses and call current callback safely
    const callHandler = (handlerName, data) => {
      if (data?.roundId && data.roundId !== roundId) return;
      const handler = callbacksRef.current[handlerName];
      if (!handler) return;
      invalidateSocketUpdate(handlerName, data, data?.eventId, roundId);
      handler(data);
    };

    // Check-in updates
    unsubscribers.push(
      subscribe(SocketEvents.CHECKIN_UPDATE, (data) =>
        callHandler("onCheckInUpdate", data)
      )
    );

    // Check-in count updates
    unsubscribers.push(
      subscribe(SocketEvents.CHECKIN_COUNT, (data) =>
        callHandler("onCheckInCount", data)
      )
    );

    // Check-in window updates
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_CHECKIN_WINDOW, (data) =>
        callHandler("onRoundCheckInWindow", data)
      )
    );

    // Round status changes
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_STATUS_CHANGE, (data) =>
        callHandler("onRoundStatusChange", data)
      )
    );

    // Pairings generated
    unsubscribers.push(
      subscribe(SocketEvents.PAIRINGS_GENERATED, (data) =>
        callHandler("onPairingsGenerated", data)
      )
    );

    // Pairings published
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_PAIRINGS_PUBLISHED, (data) =>
        callHandler("onPairingsPublished", data)
      )
    );

    // Results published
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_RESULTS_PUBLISHED, (data) =>
        callHandler("onResultsPublished", data)
      )
    );

    // Rooms allocated
    unsubscribers.push(
      subscribe(SocketEvents.ROOMS_ALLOCATED, (data) =>
        callHandler("onRoomsAllocated", data)
      )
    );

    // Debate result
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_RESULT, (data) =>
        callHandler("onDebateResult", data)
      )
    );

    // Round updated (generic)
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_UPDATED, (data) =>
        callHandler("onRoundUpdated", data)
      )
    );

    // Round deleted
    unsubscribers.push(
      subscribe(SocketEvents.ROUND_DELETED, (data) =>
        callHandler("onRoundDeleted", data)
      )
    );

    // Debate created
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_CREATED, (data) =>
        callHandler("onDebateCreated", data)
      )
    );

    // Debate updated
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_UPDATED, (data) =>
        callHandler("onDebateUpdated", data)
      )
    );

    // Debate deleted
    unsubscribers.push(
      subscribe(SocketEvents.DEBATE_DELETED, (data) =>
        callHandler("onDebateDeleted", data)
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [roundId, subscribe]);
}

export default useSocket;
