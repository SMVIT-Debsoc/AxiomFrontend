
const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// In local development call backend directly, otherwise use same-origin /api
// (which can be proxied by hosting platform rewrites).
const DEFAULT_API_BASE_URL = isLocalhost ? `http://${window.location.hostname}:3000/api` : "/api";
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

// In-memory request caching for smooth navigation without re-fetching
const apiCache = new Map();
const CACHE_TTL_MS = 20000; // 20s client cache for fast tab switching
const RETURN_CACHE_TTL_MS = 120000;
let cacheGeneration = 0;
const MAX_CACHE_ENTRIES = 256;

const MUTATION_CACHE_TARGETS = {
    "check-in": ["check-in", "rounds"],
    pairing: ["pairing", "rounds", "debates", "events"],
    debates: ["debates", "rounds", "stats", "leaderboard", "events", "/users/me"],
    rounds: ["rounds", "events", "debates", "check-in", "stats", "leaderboard"],
    events: ["events", "rounds"],
    admin: ["admin", "rounds", "debates", "events", "stats", "leaderboard", "/users/me"],
};

function invalidateMutationCache(endpoint) {
    const cleanPath = (endpoint || "").split("?")[0];
    const resource = cleanPath.split("/")[1] || null;
    if (!resource) {
        clearApiCache(null);
        return;
    }

    const targets = new Set([resource]);
    for (const [key, prefixes] of Object.entries(MUTATION_CACHE_TARGETS)) {
        if (cleanPath.includes(`/${key}`)) {
            prefixes.forEach((p) => targets.add(p));
        }
    }
    targets.forEach((prefix) => clearApiCache(prefix));
}

export function clearApiCache(prefix = null) {
    cacheGeneration += 1;
    if (!prefix) {
        apiCache.clear();
        return;
    }
    for (const key of apiCache.keys()) {
        if (key.includes(prefix)) apiCache.delete(key);
    }
}

// Only route metadata can be shown past the normal cache lifetime. Publication
// flags and round motions must come from a fresh response.
function navigationPreview(data) {
    const round = (value) => {
        delete value.debates;
        delete value.checkIns;
        return {...value, motion: null, pairingsPublished: false, resultsPublished: false};
    };
    const event = (value) => ({...value, rounds: value.rounds?.map(round)});
    if (data.round) return {...data, round: round(data.round)};
    if (data.event) return {...data, event: event(data.event)};
    if (Array.isArray(data.events)) return {...data, events: data.events.map(event)};
    return data;
}

let authTokenProvider = null;
let authRefreshProvider = null;

export function setApiAuthTokenProvider(provider) {
    authTokenProvider = typeof provider === "function" ? provider : null;
}

export function setApiAuthRefreshProvider(provider) {
    authRefreshProvider = typeof provider === "function" ? provider : null;
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
 * @param {string} [token] - Clerk JWT token or auth token
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

    const hasSessionStorage = typeof sessionStorage !== "undefined";
    const adminSecretKey =
        isBrowser && hasSessionStorage && sessionStorage.getItem("isAdminSession") === "true"
            ? sessionStorage.getItem("adminSecretKey")?.trim() || null
            : null;
    if (adminSecretKey) {
        headers["X-Admin-Secret-Key"] = adminSecretKey;
    }

    let resolvedToken = token;
    if (!resolvedToken && authTokenProvider) {
        try {
            resolvedToken = await authTokenProvider();
        } catch {
            // fallback
        }
    }

    if (resolvedToken && !resolvedToken.startsWith("admin-secret:")) {
        headers["Authorization"] = `Bearer ${resolvedToken}`;
    } else if (!adminSecretKey && resolvedToken) {
        headers["Authorization"] = `Bearer ${resolvedToken}`;
    }
    void requireAuth;

    const config = {
        method,
        headers,
        credentials: "include",
        signal: options.signal,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const isGet = method.toUpperCase() === "GET";
    const sessionScope = resolvedToken && !resolvedToken.startsWith("admin-secret:") && !adminSecretKey
        ? options.sessionScope
        : null;
    const cacheKey = JSON.stringify([endpoint, sessionScope ? ["session", sessionScope] : resolvedToken, adminSecretKey]);
    const initialAuthorization = headers.Authorization;
    const requestGeneration = cacheGeneration;

    if (isBrowser && isGet && !options.skipCache) {
        const cached = apiCache.get(cacheKey);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            if (age < CACHE_TTL_MS) return JSON.parse(JSON.stringify(cached.data));
            if (sessionScope && options.onNavigationPreview && age < RETURN_CACHE_TTL_MS) {
                options.onNavigationPreview();
                return navigationPreview(JSON.parse(JSON.stringify(cached.data)));
            }
        }
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

        // Reject auth proxy redirects: API callers must always receive JSON.
        const wasRedirected = response.redirected && response.url.endsWith("/");
        if (retryAuthFailure && response.status === 401) {
            if (authTokenProvider) {
                const fresh = await getFreshToken();
                if (fresh) {
                    config.headers["Authorization"] = `Bearer ${fresh}`;
                    response = await fetch(url, config);
                }
            } else if (authRefreshProvider) {
                const sessionStillActive = await authRefreshProvider().catch(() => false);
                if (sessionStillActive) response = await fetch(url, config);
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
             } catch {
                 throw new Error(`Server returned unexpected response (${response.status}). URL: ${path}`);
             }
        } else if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            // No content type or something else
            const text = await response.text();
            try { data = JSON.parse(text); } catch {
                throw new Error(`API returned invalid content (${contentType || 'none'}). Status: ${response.status}`);
            }
        }

        if (!response.ok) {
            const failure = new Error(
                data.error ||
                    data.message ||
                    `API request failed with status ${response.status}`,
            );
            failure.status = response.status;
            throw failure;
        }

        // The backend uses both HTTP errors and {success:false} payloads; never
        // let a 200 response accidentally satisfy onboarding or enrollment.
        if (data?.success === false) {
            throw new Error(data.error || data.message || "The request was not completed.");
        }

        if (isGet) {
            if (isBrowser && requestGeneration === cacheGeneration && initialAuthorization === headers.Authorization) {
                apiCache.delete(cacheKey);
                if (apiCache.size >= MAX_CACHE_ENTRIES) {
                    apiCache.delete(apiCache.keys().next().value);
                }
                apiCache.set(cacheKey, {data, timestamp: Date.now()});
            }
        } else {
            // Invalidate related caches for mutations
            invalidateMutationCache(endpoint);
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// User Endpoints
export const UserApi = {
    checkEmail: (email) => apiRequest("/users/check-email", "POST", {email}, null, {requireAuth: false}),
    getProfile: (token, options = {}) => apiRequest("/users/me", "GET", null, token, options),
    updateProfile: (data, token) =>
        apiRequest("/users/profile", "PUT", data, token),
    getStats: (token, options = {}) => apiRequest("/stats/my-stats", "GET", null, token, options),
    getById: (id, token, options = {}) => apiRequest(`/users/${id}`, "GET", null, token, options),
    list: (token, limit = 500, offset = 0, options = {}) =>
        apiRequest(
            `/users?limit=${limit}&offset=${offset}`,
            "GET",
            null,
            token,
            options,
        ),
    deleteParticipant: (id, token) =>
        apiRequest(`/users/${id}`, "DELETE", null, token),
};

// Event Endpoints
export const EventApi = {
    list: (token, status = null, options = {}) =>
        apiRequest(
            `/events${status ? `?status=${status}` : options.dashboard ? "?view=dashboard" : ""}`,
            "GET",
            null,
            token,
            options,
        ),
    get: (id, token, options = {}) => apiRequest(`/events/${id}`, "GET", null, token, options),
    getById: (id, token, options = {}) => apiRequest(`/events/${id}`, "GET", null, token, options),
    getOverview: (id, token, options = {}) => apiRequest(`/events/${id}?view=overview`, "GET", null, token, options),
    getParticipants: (eventId, token, options = {}) =>
        apiRequest(`/events/${eventId}/participants`, "GET", null, token, options),
    enroll: (id, token) =>
        apiRequest(`/events/${id}/enroll`, "POST", null, token),
    getEnrollmentStatus: (id, token, options = {}) =>
        apiRequest(`/events/${id}/enrollment-status`, "GET", null, token, options),
    enrollUserManual: (eventId, userId, token) =>
        apiRequest(`/events/${eventId}/enroll-manual`, "POST", {userId}, token),
};

// Round Endpoints
export const RoundApi = {
    getSummary: (id, token, options = {}) =>
        apiRequest(`/rounds/${id}?view=summary`, "GET", null, token, options),
    listByEvent: (eventId, token, options = {}) =>
        apiRequest(`/rounds/event/${eventId}`, "GET", null, token, options),
    get: (id, token, options = {}) => apiRequest(`/rounds/${id}`, "GET", null, token, options),
    getById: (id, token, options = {}) => apiRequest(`/rounds/${id}`, "GET", null, token, options),
};

// Check-In Endpoints
export const CheckInApi = {
    checkIn: (roundId, token) =>
        apiRequest("/check-in", "POST", {roundId}, token),
    getMyStatus: (roundId, token, options = {}) =>
        apiRequest(`/check-in/round/${roundId}/me`, "GET", null, token, options),
};

// Debate Endpoints
export const DebateApi = {
    getMyDebates: (token, options = {}, eventId) =>
        apiRequest(`/debates/my-debates${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`, "GET", null, token, options),
    getByRound: (roundId, token, options = {}) =>
        apiRequest(`/debates/round/${roundId}`, "GET", null, token, options),
    getById: (id, token, options = {}) => apiRequest(`/debates/${id}`, "GET", null, token, options),
};

// Stats Endpoints
export const StatsApi = {
    getMyStats: (token, options = {}) => apiRequest("/stats/my-stats", "GET", null, token, options),
    getUserStats: (userId, token, options = {}) =>
        apiRequest(`/stats/user/${userId}`, "GET", null, token, options),
    getLeaderboard: (token, eventId = null, limit = 50, options = {}) => {
        let url = `/stats/leaderboard?limit=${limit}`;
        if (eventId) url += `&eventId=${eventId}`;
        return apiRequest(url, "GET", null, token, options);
    },
};

// Admin Endpoints
export const AdminApi = {
    apiRequest: apiRequest,
    validateKey: (secretKey) =>
        apiRequest("/admin/validate-key", "POST", {secretKey}, null, {requireAuth: false}),
    onboard: (data, token) => apiRequest("/admin/onboard", "POST", data, token),
    getProfile: (token) => apiRequest("/admin/me", "GET", null, token),

    getDashboard: (token) => apiRequest("/admin/dashboard", "GET", null, token),

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
