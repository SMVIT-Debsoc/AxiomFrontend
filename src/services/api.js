const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// In local development call backend directly, otherwise use same-origin /api
// (which can be proxied by hosting platform rewrites).
const DEFAULT_API_BASE_URL = isLocalhost ? "http://localhost:3000/api" : "/api";
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

/**
 * Generic API fetch wrapper
 * @param {string} endpoint - The API endpoint (e.g., '/events')
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} [body] - Request body
 * @param {string} [token] - Clerk JWT token
 * @returns {Promise<any>}
 */
export async function apiRequest(
    endpoint,
    method = "GET",
    body = null,
    token = null,
) {
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const baseUrl = API_BASE_URL.endsWith("/")
            ? API_BASE_URL.slice(0, -1)
            : API_BASE_URL;
        const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = `${baseUrl}${path}`;

        console.log(`[API Request] Attempting to fetch URL: ${url}`);
        const response = await fetch(url, config);

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(
                `Expected JSON but received HTML. URL checked: ${url}. Status: ${response.status}. Response preview: ${text.substring(0, 50)}...`,
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                    data.message ||
                    `API request failed with status ${response.status}`,
            );
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// User Endpoints
export const UserApi = {
    getProfile: (token) => apiRequest("/users/me", "GET", null, token),
    updateProfile: (data, token) =>
        apiRequest("/users/profile", "PUT", data, token),
    getStats: (token) => apiRequest("/stats/my-stats", "GET", null, token),
    getById: (id, token) => apiRequest(`/users/${id}`, "GET", null, token),
    list: (token, limit = 50, offset = 0) =>
        apiRequest(
            `/users?limit=${limit}&offset=${offset}`,
            "GET",
            null,
            token,
        ),
    deleteParticipant: (id, token) =>
        apiRequest(`/users/${id}`, "DELETE", null, token),
};

// Event Endpoints
export const EventApi = {
    list: (token, status = null) =>
        apiRequest(
            `/events${status ? `?status=${status}` : ""}`,
            "GET",
            null,
            token,
        ),
    get: (id, token) => apiRequest(`/events/${id}`, "GET", null, token),
    getById: (id, token) => apiRequest(`/events/${id}`, "GET", null, token),
    getParticipants: (eventId, token) =>
        apiRequest(`/events/${eventId}/participants`, "GET", null, token),
    enroll: (id, token) =>
        apiRequest(`/events/${id}/enroll`, "POST", null, token),
    getEnrollmentStatus: (id, token) =>
        apiRequest(`/events/${id}/enrollment-status`, "GET", null, token),
};

// Round Endpoints
export const RoundApi = {
    listByEvent: (eventId, token) =>
        apiRequest(`/rounds/event/${eventId}`, "GET", null, token),
    get: (id, token) => apiRequest(`/rounds/${id}`, "GET", null, token),
    getById: (id, token) => apiRequest(`/rounds/${id}`, "GET", null, token),
};

// Check-In Endpoints
export const CheckInApi = {
    checkIn: (roundId, token) =>
        apiRequest("/check-in", "POST", {roundId}, token),
    getMyStatus: (roundId, token) =>
        apiRequest(`/check-in/round/${roundId}/me`, "GET", null, token),
};

// Debate Endpoints
export const DebateApi = {
    getMyDebates: (token) =>
        apiRequest("/debates/my-debates", "GET", null, token),
    getByRound: (roundId, token) =>
        apiRequest(`/debates/round/${roundId}`, "GET", null, token),
    getById: (id, token) => apiRequest(`/debates/${id}`, "GET", null, token),
};

// Stats Endpoints
export const StatsApi = {
    getMyStats: (token) => apiRequest("/stats/my-stats", "GET", null, token),
    getUserStats: (userId, token) =>
        apiRequest(`/stats/user/${userId}`, "GET", null, token),
    getLeaderboard: (token, eventId = null, limit = 50) => {
        let url = `/stats/leaderboard?limit=${limit}`;
        if (eventId) url += `&eventId=${eventId}`;
        return apiRequest(url, "GET", null, token);
    },
};

// Admin Endpoints
export const AdminApi = {
    apiRequest: apiRequest,
    getProfile: (token) => apiRequest("/admin/me", "GET", null, token),

    onboard: (secretKey, token) =>
        apiRequest("/admin/onboard", "POST", {secretKey}, token),
    getDashboard: (token) => apiRequest("/admin/dashboard", "GET", null, token),
    // Public endpoint - validates secret key before sign-in
    validateKey: (secretKey) =>
        apiRequest("/admin/validate-key", "POST", {secretKey}, null),

    // Advanced Admin Controls
    createEvent: (data, token) => apiRequest("/events", "POST", data, token),
    updateEvent: (id, data, token) =>
        apiRequest(`/events/${id}`, "PUT", data, token),
    deleteEvent: (id, token) =>
        apiRequest(`/events/${id}`, "DELETE", null, token),

    createRound: (data, token) => apiRequest("/rounds", "POST", data, token),
    updateRound: (id, data, token) =>
        apiRequest(`/rounds/${id}`, "PUT", data, token),
    deleteRound: (id, token) =>
        apiRequest(`/rounds/${id}`, "DELETE", null, token),

    createRoom: (data, token) => apiRequest("/rooms", "POST", data, token),
    updateRoom: (id, data, token) =>
        apiRequest(`/rooms/${id}`, "PUT", data, token),
    deleteRoom: (id, token) =>
        apiRequest(`/rooms/${id}`, "DELETE", null, token),

    // Matchmaking / Pairings
    previewPairings: (roundId, token) =>
        apiRequest(`/pairing/${roundId}/preview`, "GET", null, token),
    generateRound1Pairings: (roundId, token) =>
        apiRequest(`/pairing/${roundId}/round1`, "POST", null, token),
    generatePowerMatchPairings: (roundId, token) =>
        apiRequest(`/pairing/${roundId}/power-match`, "POST", null, token),
    allocateRooms: (roundId, timeSlots, token) =>
        apiRequest(
            `/pairing/${roundId}/allocate-rooms`,
            "POST",
            {timeSlots},
            token,
        ),

    submitResult: (debateId, data, token) =>
        apiRequest(`/debates/${debateId}/result`, "POST", data, token),
};
