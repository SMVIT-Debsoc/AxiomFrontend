import {io, Socket} from "socket.io-client";

const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
const configuredApiUrl = import.meta.env.VITE_API_URL;
const configuredTransports = import.meta.env.VITE_SOCKET_TRANSPORTS;

const PRODUCTION_BACKEND_ORIGIN = "https://axiom26-aezg.onrender.com";

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
        return `http://${window.location.hostname}:3000`;
    }

    // Connect directly to the Render backend in production because Vercel rewrites
    // buffer/drop persistent WebSocket upgrade handshakes.
    return PRODUCTION_BACKEND_ORIGIN;
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

    // Try direct WebSocket first for lowest latency, with automatic fallback to
    // HTTP long-polling if a proxy/CDN/firewall blocks upgrade handshakes.
    return ["websocket", "polling"];
}

const SOCKET_TRANSPORTS = getSocketTransports();

/**
 * WebSocket Event Types - mirrors backend events
 */
export const SocketEvents = {
    // Connection events
    CONNECTION: "connect",
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
    ROUND_RESULTS_PUBLISHED: "round:resultsPublished",

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
    rooms = new Map();
    roomListeners = new Set();
    authRetries = 0;
    authRetryTimer = null;
    authProvider = null;

    setAuthProvider(provider) {
        this.authProvider = typeof provider === "function" ? provider : null;
    }

    /**
     * Re-run the handshake so the server sees the current identity (Google
     * sign-in or admin secret key). Rooms are rejoined on the next "connect".
     */
    refreshAuth() {
        if (!this.socket) return;
        clearTimeout(this.authRetryTimer);
        this.authRetryTimer = null;
        this.authRetries = 0;
        this.socket.disconnect();
        this.socket.connect();
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket?.connected) {
            return this.socket;
        }

        // If we already have a socket instance that's just disconnected, don't recreate
        if (this.socket) {
            if (!this.socket.active && !this.authRetryTimer) this.socket.connect();
            return this.socket;
        }

        this.socket = io(SOCKET_URL, {
            transports: SOCKET_TRANSPORTS,
            tryAllTransports: true,
            withCredentials: true,
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            forceNew: false,
            closeOnBeforeunload: true,
            auth: async (cb) => {
                const payload = {};
                if (typeof window !== "undefined" && sessionStorage.getItem("isAdminSession") === "true") {
                    const key = sessionStorage.getItem("adminSecretKey")?.trim();
                    if (key) payload.adminSecretKey = key;
                }
                if (this.authProvider) {
                    try {
                        const token = await this.authProvider(this.authRetries ? {skipCache: true} : undefined);
                        if (token) payload.token = token;
                    } catch {
                        // Ignore auth token lookup failure for socket handshake
                    }
                }
                cb(payload);
            },
        });

        // Re-attach any existing listeners registered before a disconnect/reconnect
        for (const [event, callbacks] of this.listeners.entries()) {
            callbacks.forEach((cb) => this.socket.on(event, cb));
        }

        // Add a global listener once to help close connections
        if (typeof window !== "undefined" && !this.beforeUnloadBound) {
            this.beforeUnloadBound = true;
            window.addEventListener("beforeunload", () => {
                if (this.socket) {
                    this.socket.close();
                }
            });
        }

        this.socket.on("connect", () => {
            console.log("[Socket] Connected:", this.socket.id);
            this.authRetries = 0;
            clearTimeout(this.authRetryTimer);
            this.authRetryTimer = null;
            for (const room of this.rooms.values()) this.requestRoom(room, true);
        });

        this.socket.on("disconnect", (reason) => {
            for (const room of this.rooms.values()) {
                room.ready = false;
                room.attempt = null;
                room.retryWhenSettled = false;
            }
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
            // Socket.IO retries transport failures. An auth denial needs an explicit reconnect.
            const socket = this.socket;
            if (socket && !socket.active && this.authProvider && this.authRetries < 3) {
                clearTimeout(this.authRetryTimer);
                const delay = 1000 * 2 ** this.authRetries;
                this.authRetryTimer = setTimeout(() => {
                    this.authRetryTimer = null;
                    if (this.socket !== socket || socket.connected || socket.active) return;
                    this.authRetries += 1;
                    socket.connect();
                }, delay);
            }
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
            this.rooms.clear();
            clearTimeout(this.authRetryTimer);
            this.authRetryTimer = null;
            this.authRetries = 0;
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

    acquireRoom(type, id) {
        if (!id) return;
        const key = type + ":" + id;
        let room = this.rooms.get(key);
        if (!room) {
            room = {key, type, id, subscribers: 0, ready: false, attempt: null, retryAt: 0};
            this.rooms.set(key, room);
        }
        room.subscribers += 1;
        this.connect();
        this.requestRoom(room);
    }

    releaseRoom(type, id) {
        const room = this.rooms.get(type + ":" + id);
        if (!room || --room.subscribers > 0) return;
        this.rooms.delete(room.key);
        if (this.socket?.connected) {
            this.socket.emit(type === "event" ? SocketEvents.LEAVE_EVENT : SocketEvents.LEAVE_ROUND, id);
        }
    }

    requestRoom(room, force = false) {
        const socket = this.socket;
        if (!room || !socket?.connected || room.ready) return;
        if (room.attempt) {
            if (force) room.retryWhenSettled = true;
            return;
        }
        if (!force && Date.now() < room.retryAt) return;
        const attempt = Symbol();
        room.attempt = attempt;
        room.retryAt = Date.now() + 20000;
        const event = room.type === "event" ? SocketEvents.JOIN_EVENT : SocketEvents.JOIN_ROUND;
        socket.timeout(4000).emit(event, room.id, (error, result) => {
            if (this.socket !== socket || this.rooms.get(room.key) !== room || room.attempt !== attempt) return;
            room.attempt = null;
            const retry = room.retryWhenSettled;
            room.retryWhenSettled = false;
            if (!error && result?.joined === true) {
                room.ready = true;
                this.roomListeners.forEach((listener) => listener(room.type, room.id));
            } else if (retry) {
                this.requestRoom(room, true);
            }
        });
    }

    isRoomReady(type, id) {
        return !id || Boolean(this.socket?.connected && this.rooms.get(type + ":" + id)?.ready);
    }

    retryRoom(type, id, force = false) {
        this.requestRoom(this.rooms.get(type + ":" + id), force);
    }

    onRoomReady(listener) {
        this.roomListeners.add(listener);
        return () => this.roomListeners.delete(listener);
    }

    joinEvent(id) { this.acquireRoom("event", id); }
    leaveEvent(id) { this.releaseRoom("event", id); }
    joinRound(id) { this.acquireRoom("round", id); }
    leaveRound(id) { this.releaseRoom("round", id); }

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
