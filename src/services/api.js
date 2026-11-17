
const isBrowser = typeof window !== "undefined";
const isLocalhost =
    isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// In local development call backend directly, otherwise use same-origin /api
// (which can be proxied by hosting platform rewrites).
const DEFAULT_API_BASE_URL = isLocalhost ? `http://${window.location.hostname}:3000/api` : "/api";
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

// Per-tab id sent as X-Client-Id on every request. The server echoes it as
// `actorClientId` in socket payloads, so a tab skips only its own echoes (not
// those of the same admin working in another tab).
function makeClientId() {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    } catch {
        // fall through
    }
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
export const CLIENT_ID = makeClientId();

// In-memory request caching for smooth navigation without re-fetching
const apiCache = new Map();
const CACHE_TTL_MS = 20000; // 20s client cache for fast tab switching
const RETURN_CACHE_TTL_MS = 120000;
const pendingCacheReads = new Set();
const MAX_CACHE_ENTRIES = 256;
// Identical GETs that are already on the wire (same endpoint + same auth) share
// one network request. Several live-page sections and socket-driven refreshes
// often ask for the same round at the same moment.
const inflightGets = new Map();

const MUTATION_CACHE_TARGETS = {
    "check-in": ["check-in", "rounds"],
    pairing: ["pairing", "rounds", "debates", "events"],
    debates: ["debates", "rounds", "stats", "leaderboard", "events", "/users/me"],
    rounds: ["rounds", "events", "debates", "check-in", "stats", "leaderboard"],
    events: ["events", "rounds"],
    admin: ["admin", "rounds", "debates", "events", "stats", "leaderboard", "/users/me"],
    rooms: ["rooms", "debates", "rounds"],
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
    const matches = typeof prefix === "function" ? prefix : (key) => !prefix || key.includes(prefix);
    for (const key of apiCache.keys()) {
        if (matches(key)) apiCache.delete(key);
    }
    for (const read of pendingCacheReads) {
        if (matches(read.key)) read.invalidated = true;
    }
    // A GET that started before a mutation/realtime change must not be joined
    // by callers asking after it; they start a fresh request instead.
    for (const key of inflightGets.keys()) {
        if (matches(key)) inflightGets.delete(key);
    }
}

function cloneData(data) {
    return data == null ? data : JSON.parse(JSON.stringify(data));
}

/** Build the Error thrown for a failed API call, keeping the server's code and payload. */
export function apiFailure(message, status, data) {
    const failure = new Error(message);
    failure.status = status;
    failure.code = data?.code;
    failure.data = data;
    return failure;
}

// Attach one caller (with its own optional AbortSignal) to a shared request.
// The shared fetch is only aborted once every caller that can abort has done so.
function joinShared(entry, signal) {
    entry.waiters += 1;
    if (!signal) return entry.promise;
    if (signal.aborted) {
        entry.waiters -= 1;
        return Promise.reject(signal.reason);
    }
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            entry.waiters -= 1;
            if (entry.waiters <= 0) entry.controller?.abort(signal.reason);
            reject(signal.reason);
        };
        signal.addEventListener("abort", onAbort, {once: true});
        entry.promise.then(
            (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
            (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
        );
    });
}

/**
 * Hands out increasing tickets so a caller can tell whether a response is
 * still the latest one it asked for (drop out-of-order responses).
 */
export function createRequestSequencer() {
    let latest = 0;
    return {
        next: () => ++latest,
        isLatest: (ticket) => ticket === latest,
    };
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
        "X-Client-Id": CLIENT_ID,
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

    if (isGet && !options.noDedup) {
        const dedupKey = JSON.stringify([endpoint, initialAuthorization || null, adminSecretKey]);
        let entry = inflightGets.get(dedupKey);
        if (entry) {
            return joinShared(entry, options.signal).then(cloneData);
        }
        // Only make the shared request abortable when its first caller can abort.
        const controller = options.signal ? new AbortController() : null;
        entry = {controller, waiters: 0, promise: null};
        entry.promise = executeRequest(endpoint, method, {...config, signal: controller?.signal}, {
            isGet, cacheKey, initialAuthorization, headers, retryAuthFailure,
        }).finally(() => {
            if (inflightGets.get(dedupKey) === entry) inflightGets.delete(dedupKey);
        });
        // Avoid unhandled rejections when every caller aborted.
        entry.promise.catch(() => {});
        inflightGets.set(dedupKey, entry);
        return joinShared(entry, options.signal);
    }

    return executeRequest(endpoint, method, config, {isGet, cacheKey, initialAuthorization, headers, retryAuthFailure});
}

async function executeRequest(endpoint, method, config, {isGet, cacheKey, initialAuthorization, headers, retryAuthFailure}) {
    const cacheRead = isBrowser && isGet ? {key: cacheKey, invalidated: false} : null;
    if (cacheRead) pendingCacheReads.add(cacheRead);
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
            throw apiFailure(
                data?.error ||
                    data?.message ||
                    `API request failed with status ${response.status}`,
                response.status,
                data,
            );
        }

        // The backend uses both HTTP errors and {success:false} payloads; never
        // let a 200 response accidentally satisfy onboarding or enrollment.
        if (data?.success === false) {
            throw apiFailure(data.error || data.message || "The request was not completed.", response.status, data);
        }

        if (isGet) {
            if (cacheRead && !cacheRead.invalidated && initialAuthorization === headers.Authorization) {
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
    } finally {
        if (cacheRead) pendingCacheReads.delete(cacheRead);
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
    getSavedBallot: (id, token, signal) =>
        apiRequest(`/debates/${id}?view=ballot`, "GET", null, token, {skipCache: true, signal}),
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
    // `force` regenerates even when the draw is already published (409 PAIRINGS_PUBLISHED otherwise).
    generateRound1Pairings: (roundId, token, {force = false} = {}) =>
        apiRequest(`/pairing/${roundId}/round1`, "POST", force ? {force: true} : null, token),
    generatePowerMatchPairings: (roundId, token, {force = false} = {}) =>
        apiRequest(`/pairing/${roundId}/power-match`, "POST", force ? {force: true} : null, token),
    // `onlyUnassigned: true` fills only debates without a room (keeps manual room edits).
    allocateRooms: (roundId, config, token, {onlyUnassigned = false} = {}) =>
        apiRequest(
            `/pairing/${roundId}/allocate-rooms`,
            "POST",
            {
                ...config,
                roomIds: config?.selectedRoomIds || config?.roomIds,
                ...(onlyUnassigned ? {onlyUnassigned: true} : {}),
            },
            token,
        ),
    // Partial debate edit (judge/room/time). Pass the debate's updatedAt so a
    // concurrent edit answers 409 BALLOT_CONFLICT instead of being overwritten.
    updateDebate: (debateId, fields, token, {expectedUpdatedAt} = {}) =>
        apiRequest(
            `/debates/${debateId}`,
            "PUT",
            expectedUpdatedAt ? {...fields, expectedUpdatedAt} : fields,
            token,
        ),

    submitResult: (debateId, data, token, {summary = false, signal} = {}) =>
        apiRequest(`/debates/${debateId}/result${summary ? "?view=summary" : ""}`, "POST", data, token, {signal}),

    getRoundPerformers: (roundId, token) =>
        apiRequest(`/admin/rounds/${roundId}/performers`, "GET", null, token),
    promoteDebaters: (roundId, userIds, token, {expectedPromotedIds} = {}) =>
        apiRequest(
            `/admin/rounds/${roundId}/promote`,
            "POST",
            expectedPromotedIds ? {userIds, expectedPromotedIds} : {userIds},
            token,
        ),
    // Preferred: send only what this admin changed so concurrent toggles merge.
    updatePromotions: (roundId, {add = [], remove = []}, token) =>
        apiRequest(`/admin/rounds/${roundId}/promote`, "POST", {add, remove}, token),
    publishResults: (roundId, published, token) =>
        apiRequest(`/admin/rounds/${roundId}/publish`, "POST", {published}, token),
};

// ---------------------------------------------------------------------------
// Tournament operations (stations redesign). Contract shared with backend
// branch admin-multiuser-hardening. Public endpoints pass requireAuth:false.
// ---------------------------------------------------------------------------
export const OpsApi = {
    // E-ballots: one private token per debate (backend Debate.ballotToken)
    getBallotLinks: (roundId, token) =>
        apiRequest(`/admin/rounds/${roundId}/ballot-links`, "GET", null, token),
    getPublicBallot: (ballotToken) =>
        apiRequest(`/ballot/${encodeURIComponent(ballotToken)}`, "GET", null, null, {requireAuth: false, skipCache: true}),
    submitPublicBallot: (ballotToken, {debater1Score, debater2Score, winnerId, judgeName}) =>
        apiRequest(`/ballot/${encodeURIComponent(ballotToken)}`, "POST", {debater1Score, debater2Score, winnerId, judgeName}, null, {requireAuth: false}),

    // Venue check-in: rotating short code shown as a QR on Display / Desk
    getVenueCode: (roundId, token) =>
        apiRequest(`/admin/rounds/${roundId}/venue-code`, "GET", null, token, {skipCache: true}),
    venueCheckIn: (roundId, code, token) =>
        apiRequest(`/check-in/venue`, "POST", {roundId, code}, token),
    // Personal pass: participant shows it, Desk scans or types the short code
    getMyCheckInPass: (token) =>
        apiRequest(`/users/me/checkin-pass`, "GET", null, token, {skipCache: true}),
    scanCheckIn: (roundId, pass, token) =>
        apiRequest(`/check-in/scan`, "POST", {roundId, pass}, token),

    // Promotions: ranked best-loser proposal with a cut line
    getPromotionProposal: (roundId, token, {targetSize} = {}) =>
        apiRequest(`/admin/rounds/${roundId}/promotion-proposal${targetSize ? `?targetSize=${Number(targetSize)}` : ""}`, "GET", null, token, {skipCache: true}),

    // Activity feed (audit log)
    getActivity: ({eventId, roundId, limit = 50, before} = {}, token) => {
        const q = new URLSearchParams();
        if (eventId) q.set("eventId", eventId);
        if (roundId) q.set("roundId", roundId);
        if (limit) q.set("limit", String(limit));
        if (before) q.set("before", before);
        return apiRequest(`/admin/activity?${q.toString()}`, "GET", null, token, {skipCache: true});
    },
};
