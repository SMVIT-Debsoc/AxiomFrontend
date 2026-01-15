import {io, Socket} from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";

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

    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
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
      console.error("[Socket] Connection error:", error);
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
