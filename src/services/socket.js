import {io, Socket} from "socket.io-client";

const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
const configuredApiUrl = import.meta.env.VITE_API_URL;
const configuredTransports = import.meta.env.VITE_SOCKET_TRANSPORTS;

function getSocketUrl() {
    if (configuredSocketUrl) {
        return configuredSocketUrl;
    }

    // If API URL is absolute, derive socket origin from it.
    if (configuredApiUrl && /^https?:\/\//i.test(configuredApiUrl)) {
        return configuredApiUrl.replace(/\/api\/?$/, "");
    }

    // Local dev should hit local backend directly.
    if (isLocalhost) {
        return "http://localhost:3000";
    }

    // In deployed frontend, use same-origin and rely on host rewrites/proxy for /socket.io.
    return "";
}

const SOCKET_URL = getSocketUrl();

function getSocketTransports() {
    if (configuredTransports) {
        const parsed = configuredTransports
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

        if (parsed.length > 0) {
            return parsed;
        }
    }

    // Always allow both transports so the client can fall back to polling
    // if websocket upgrade fails behind a proxy/CDN/load-balancer.
    return ["polling", "websocket"];
}

const SOCKET_TRANSPORTS = getSocketTransports();

/**
 * WebSocket Event Types - mirrors backend events
 */
export const SocketEvents = {
    // Connection events
    CONNECTION: "connection",
    DISCONNECT: "disconnect",

    // Room events (for scoping updates)
    JOIN_EVENT: "join:event",
    LEAVE_EVENT: "leave:event",
    JOIN_ROUND: "join:round",
    LEAVE_ROUND: "leave:round",

    // Check-in events
    CHECKIN_UPDATE: "checkin:update",
    CHECKIN_COUNT: "checkin:count",

    // Round events
    ROUND_CREATED: "round:created",
    ROUND_STATUS_CHANGE: "round:status",
    ROUND_CHECKIN_WINDOW: "round:checkinWindow",
    ROUND_PAIRINGS_PUBLISHED: "round:pairingsPublished",

    // Debate events
    PAIRINGS_GENERATED: "pairings:generated",
    ROOMS_ALLOCATED: "rooms:allocated",
    DEBATE_RESULT: "debate:result",
    DEBATE_UPDATE: "debate:update",

    // Leaderboard events
    LEADERBOARD_UPDATE: "leaderboard:update",

    // Event enrollment
    EVENT_ENROLLMENT: "event:enrollment",
    EVENT_UPDATE: "event:update",
    EVENT_UPDATED: "event:updated",
    EVENT_DELETED: "event:deleted",

    // Global events for lists
    EVENT_CREATED: "event:created",
    EVENT_UPDATED_GLOBAL: "event:updated:global",
    EVENT_DELETED_GLOBAL: "event:deleted:global",

    // User events
    USER_UPDATED: "user:updated",
    USER_DELETED: "user:deleted",

    // Round extra events
    ROUND_UPDATED: "round:updated",
    ROUND_DELETED: "round:deleted",

    // Debate events extended
    DEBATE_CREATED: "debate:created",
    DEBATE_UPDATED: "debate:updated",
    DEBATE_DELETED: "debate:deleted",
};

class SocketService {
    socket = null;
    listeners = new Map();
    connectedRooms = new Set();

    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket?.connected) {
            return this.socket;
        }

        // If we already have a socket instance that's just disconnected, don't recreate
        if (this.socket) {
            this.socket.connect();
            return this.socket;
        }

        console.log("[Socket] Connecting to:", SOCKET_URL || "same-origin", "transports:", SOCKET_TRANSPORTS);

        this.socket = io(SOCKET_URL, {
            transports: SOCKET_TRANSPORTS,
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: Infinity, // Never stop trying
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 30000,
            autoConnect: true,
            forceNew: false,
        });

        this.socket.on("connect", () => {
            console.log("[Socket] Connected:", this.socket.id);
            // Rejoin rooms after reconnection
            this.connectedRooms.forEach((room) => {
                const [type, id] = room.split(":");
                if (type === "event") {
                    this.socket.emit(SocketEvents.JOIN_EVENT, id);
                } else if (type === "round") {
                    this.socket.emit(SocketEvents.JOIN_ROUND, id);
                }
            });
        });

        this.socket.on("disconnect", (reason) => {
            console.log("[Socket] Disconnected:", reason);
        });

        this.socket.on("connect_error", (error) => {
            console.error("[Socket] Connection error:", {
                message: error?.message,
                description: error?.description,
                context: error?.context,
                socketUrl: SOCKET_URL || "same-origin",
                transports: SOCKET_TRANSPORTS,
            });
        });

        return this.socket;
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connectedRooms.clear();
        }
    }

    /**
     * Get the socket instance
     */
    getSocket() {
        return this.socket;
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.socket?.connected || false;
    }

    /**
     * Join an event room to receive event-specific updates
     */
    joinEvent(eventId) {
        if (!eventId) return;

        this.connect();
        this.socket?.emit(SocketEvents.JOIN_EVENT, eventId);
        this.connectedRooms.add(`event:${eventId}`);
        console.log("[Socket] Joined event:", eventId);
    }

    /**
     * Leave an event room
     */
    leaveEvent(eventId) {
        if (!eventId) return;

        this.socket?.emit(SocketEvents.LEAVE_EVENT, eventId);
        this.connectedRooms.delete(`event:${eventId}`);
        console.log("[Socket] Left event:", eventId);
    }

    /**
     * Join a round room to receive round-specific updates
     */
    joinRound(roundId) {
        if (!roundId) return;

        this.connect();
        this.socket?.emit(SocketEvents.JOIN_ROUND, roundId);
        this.connectedRooms.add(`round:${roundId}`);
        console.log("[Socket] Joined round:", roundId);
    }

    /**
     * Leave a round room
     */
    leaveRound(roundId) {
        if (!roundId) return;

        this.socket?.emit(SocketEvents.LEAVE_ROUND, roundId);
        this.connectedRooms.delete(`round:${roundId}`);
        console.log("[Socket] Left round:", roundId);
    }

    /**
     * Subscribe to a socket event
     * Returns an unsubscribe function
     */
    on(event, callback) {
        this.connect();

        this.socket?.on(event, callback);

        // Track listener for cleanup
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            this.socket?.off(event, callback);
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Remove a specific event listener
     */
    off(event, callback) {
        this.socket?.off(event, callback);
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Remove all listeners for an event
     */
    removeAllListeners(event) {
        if (event) {
            this.socket?.removeAllListeners(event);
            this.listeners.delete(event);
        } else {
            this.socket?.removeAllListeners();
            this.listeners.clear();
        }
    }

    /**
     * Emit an event to the server
     */
    emit(event, data) {
        this.socket?.emit(event, data);
    }
}

// Export singleton instance
export const socketService = new SocketService();

export default socketService;
