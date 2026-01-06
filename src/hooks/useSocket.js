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

    useEffect(() => {
        if (!eventId) return;

        const unsubscribers = [];

        // Check-in count updates
        if (callbacks.onCheckInCount) {
            unsubscribers.push(
                subscribe(SocketEvents.CHECKIN_COUNT, callbacks.onCheckInCount)
            );
        }

        // Round status changes
        if (callbacks.onRoundStatusChange) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROUND_STATUS_CHANGE,
                    callbacks.onRoundStatusChange
                )
            );
        }

        // Pairings published
        if (callbacks.onPairingsPublished) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROUND_PAIRINGS_PUBLISHED,
                    callbacks.onPairingsPublished
                )
            );
        }

        // Pairings generated
        if (callbacks.onPairingsGenerated) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.PAIRINGS_GENERATED,
                    callbacks.onPairingsGenerated
                )
            );
        }

        // Rooms allocated
        if (callbacks.onRoomsAllocated) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROOMS_ALLOCATED,
                    callbacks.onRoomsAllocated
                )
            );
        }

        // Debate result
        if (callbacks.onDebateResult) {
            unsubscribers.push(
                subscribe(SocketEvents.DEBATE_RESULT, callbacks.onDebateResult)
            );
        }

        // Leaderboard update
        if (callbacks.onLeaderboardUpdate) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.LEADERBOARD_UPDATE,
                    callbacks.onLeaderboardUpdate
                )
            );
        }

        // Event enrollment
        if (callbacks.onEventEnrollment) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.EVENT_ENROLLMENT,
                    callbacks.onEventEnrollment
                )
            );
        }

        return () => {
            unsubscribers.forEach((unsub) => unsub?.());
        };
    }, [eventId, callbacks, subscribe]);
}

/**
 * Hook for round-specific real-time updates
 * Automatically joins the round room and provides callbacks for common events
 */
export function useRoundSocket(roundId, callbacks = {}) {
    const {subscribe} = useSocket({roundId});

    useEffect(() => {
        if (!roundId) return;

        const unsubscribers = [];

        // Check-in updates
        if (callbacks.onCheckInUpdate) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.CHECKIN_UPDATE,
                    callbacks.onCheckInUpdate
                )
            );
        }

        // Round status changes
        if (callbacks.onRoundStatusChange) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROUND_STATUS_CHANGE,
                    callbacks.onRoundStatusChange
                )
            );
        }

        // Pairings generated
        if (callbacks.onPairingsGenerated) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.PAIRINGS_GENERATED,
                    callbacks.onPairingsGenerated
                )
            );
        }

        // Pairings published
        if (callbacks.onPairingsPublished) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROUND_PAIRINGS_PUBLISHED,
                    callbacks.onPairingsPublished
                )
            );
        }

        // Rooms allocated
        if (callbacks.onRoomsAllocated) {
            unsubscribers.push(
                subscribe(
                    SocketEvents.ROOMS_ALLOCATED,
                    callbacks.onRoomsAllocated
                )
            );
        }

        // Debate result
        if (callbacks.onDebateResult) {
            unsubscribers.push(
                subscribe(SocketEvents.DEBATE_RESULT, callbacks.onDebateResult)
            );
        }

        return () => {
            unsubscribers.forEach((unsub) => unsub?.());
        };
    }, [roundId, callbacks, subscribe]);
}

export default useSocket;
