import {useEffect, useCallback, useRef} from "react";
import socketService, {SocketEvents} from "../services/socket";

// Re-export SocketEvents for convenience
export {SocketEvents};

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
  const subscribedRef = useRef(new Set());

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
    const unsubscribe = socketService.on(event, callback);
    subscribedRef.current.add({event, callback, unsubscribe});
    return unsubscribe;
  }, []);

  /**
   * Unsubscribe from a socket event
   */
  const unsubscribe = useCallback((event, callback) => {
    socketService.off(event, callback);
  }, []);

  /**
   * Check if socket is connected
   */
  const isConnected = useCallback(() => {
    return socketService.isConnected();
  }, []);

  return {
    socket: socketService.getSocket(),
    subscribe,
    unsubscribe,
    isConnected,
    joinEvent: socketService.joinEvent.bind(socketService),
    leaveEvent: socketService.leaveEvent.bind(socketService),
    joinRound: socketService.joinRound.bind(socketService),
    leaveRound: socketService.leaveRound.bind(socketService),
    SocketEvents,
  };
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

    // Helper to call current callback safely
    const callHandler = (handlerName, data) => {
      if (callbacksRef.current[handlerName]) {
        callbacksRef.current[handlerName](data);
      }
    };

    // Check-in count updates
    unsubscribers.push(
      subscribe(SocketEvents.CHECKIN_COUNT, (data) =>
        callHandler("onCheckInCount", data)
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

    // Helper to call current callback safely
    const callHandler = (handlerName, data) => {
      if (callbacksRef.current[handlerName]) {
        callbacksRef.current[handlerName](data);
      }
    };

    // Check-in updates
    unsubscribers.push(
      subscribe(SocketEvents.CHECKIN_UPDATE, (data) =>
        callHandler("onCheckInUpdate", data)
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
