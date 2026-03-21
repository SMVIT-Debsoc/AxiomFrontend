
const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// In local development call backend directly, otherwise use same-origin /api
// (which can be proxied by hosting platform rewrites).
const DEFAULT_API_BASE_URL = isLocalhost ? "http://localhost:3000/api" : "/api";
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

let authTokenProvider = null;

export function setApiAuthTokenProvider(provider) {
    authTokenProvider = typeof provider === "function" ? provider : null;
}

async function getFreshToken() {
    if (!authTokenProvider) return null;

    try {
        return (await authTokenProvider({skipCache: true})) || null;
    } catch (error) {
        console.error("[API Request] Failed to retrieve auth token", error);
        return null;
    }
}

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
    options = {},
) {
    const {requireAuth = true, retryAuthFailure = true} = options;

    const headers = {
        "Content-Type": "application/json",
    };

    let resolvedToken = token || (await getFreshToken());

    if (resolvedToken) {
        headers["Authorization"] = `Bearer ${resolvedToken}`;
    } else if (requireAuth) {
        const authError = new Error(
            "Authentication token missing. Please sign in again.",
        );
        authError.code = "AUTH_TOKEN_MISSING";
        throw authError;
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

        // Debug only in local dev
        if (isLocalhost) console.log(`[API] ${method} ${path}`);
        let response = await fetch(url, config);

        // 1. Check for Clerk Redirects (Native fetch follows 302, resulting in response.redirected or HTML response)
        const clerkStatus = response.headers.get("x-clerk-auth-status");
        const wasRedirected = response.redirected && response.url.endsWith("/");
        
        let needsRetry = false;
        if (retryAuthFailure && !token && authTokenProvider) {
            if (response.status === 401 || response.status === 403 || wasRedirected || clerkStatus === "signed-out") {
                needsRetry = true;
            }
        }

        if (needsRetry) {
            console.warn(`[API] Auth failure (${response.status}) or expired token detected during ${path}. Retrying with fresh token...`);
            const refreshedToken = await getFreshToken();

            if (refreshedToken) {
                resolvedToken = refreshedToken;
                config.headers["Authorization"] = `Bearer ${refreshedToken}`;
                response = await fetch(url, config);
            }
        }

        let data;
        const contentType = response.headers.get("content-type");
        
        // Handle HTML responses (often result of redirects to root or login)
        if (contentType && (contentType.includes("text/html") || contentType.includes("text/plain"))) {
             const text = await response.text();
             // If we got HTML but expected JSON, it's likely a redirect loop or server error
             if (text.includes("<!DOCTYPE") || text.includes("<html") || (response.status === 200 && wasRedirected)) {
                  throw new Error(`Session expired or connection lost during request. Please refresh and try again.`);
             }
             
             // Try to parse text as JSON just in case (sometimes mime is wrong)
             try {
                 data = JSON.parse(text);
             } catch (e) {
                 throw new Error(`Server returned unexpected response (${response.status}). URL: ${path}`);
             }
        } else if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            // No content type or something else
            const text = await response.text();
            try { data = JSON.parse(text); } catch(e) { 
                throw new Error(`API returned invalid content (${contentType || 'none'}). Status: ${response.status}`);
            }
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
    list: (token, limit = 500, offset = 0) =>
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
    enrollUserManual: (eventId, userId, token) =>
        apiRequest(`/events/${eventId}/enroll-manual`, "POST", {userId}, token),
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
        apiRequest("/admin/validate-key", "POST", {secretKey}, null, {
            requireAuth: false,
        }),

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
    allocateRooms: (roundId, config, token) =>
        apiRequest(
            `/pairing/${roundId}/allocate-rooms`,
            "POST",
            {
                ...config,
                roomIds: config.selectedRoomIds || config.roomIds
            },
            token,
        ),

    submitResult: (debateId, data, token) =>
        apiRequest(`/debates/${debateId}/result`, "POST", data, token),

    getRoundPerformers: (roundId, token) =>
        apiRequest(`/admin/rounds/${roundId}/performers`, "GET", null, token),
    promoteDebaters: (roundId, userIds, token) =>
        apiRequest(`/admin/rounds/${roundId}/promote`, "POST", {userIds}, token),
    publishResults: (roundId, published, token) =>
        apiRequest(`/admin/rounds/${roundId}/publish`, "POST", {published}, token),
};
