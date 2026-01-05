const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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
    token = null
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
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "API request failed");
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
            token
        ),
};

// Event Endpoints
export const EventApi = {
    list: (token, status = null) =>
        apiRequest(
            `/events${status ? `?status=${status}` : ""}`,
            "GET",
            null,
            token
        ),
    get: (id, token) => apiRequest(`/events/${id}`, "GET", null, token),
};

// Round Endpoints
export const RoundApi = {
    listByEvent: (eventId, token) =>
        apiRequest(`/rounds/event/${eventId}`, "GET", null, token),
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
    getProfile: (token) => apiRequest("/admin/me", "GET", null, token),
    onboard: (secretKey, token) =>
        apiRequest("/admin/onboard", "POST", {secretKey}, token),
    getDashboard: (token) => apiRequest("/admin/dashboard", "GET", null, token),
    // Public endpoint - validates secret key before sign-in
    validateKey: (secretKey) =>
        apiRequest("/admin/validate-key", "POST", {secretKey}, null),
};
