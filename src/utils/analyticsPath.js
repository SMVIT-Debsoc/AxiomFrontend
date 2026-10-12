const DYNAMIC_ROUTE_PATTERNS = [
    [/^\/dashboard\/events\/[^/]+\/participants$/, "/dashboard/events/[eventId]/participants"],
    [/^\/dashboard\/events\/[^/]+\/rounds\/[^/]+$/, "/dashboard/events/[eventId]/rounds/[roundId]"],
    [/^\/dashboard\/events\/[^/]+\/results$/, "/dashboard/events/[eventId]/results"],
    [/^\/dashboard\/events\/[^/]+$/, "/dashboard/events/[eventId]"],
    [/^\/admin\/events\/[^/]+$/, "/admin/events/[eventId]"],
    [/^\/admin\/rounds\/[^/]+\/promotion$/, "/admin/rounds/[roundId]/promotion"],
    [/^\/admin\/rounds\/[^/]+$/, "/admin/rounds/[roundId]"],
    [/^\/admin\/results\/[^/]+$/, "/admin/results/[resultId]"],
];

const STATIC_ROUTES = new Set([
    "/",
    "/about",
    "/login-select",
    "/get-started",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/auth-redirect",
    "/complete-profile",
    "/dashboard",
    "/dashboard/events",
    "/dashboard/profile",
    "/dashboard/settings",
    "/admin",
    "/admin/events",
    "/admin/rounds",
    "/admin/participants",
    "/admin/rooms",
    "/admin/leaderboard",
    "/admin/results",
    "/admin/settings",
]);

export function getAnalyticsPath(pathname) {
    const normalizedPath = pathname.replace(/\/$/, "") || "/";

    for (const [pattern, route] of DYNAMIC_ROUTE_PATTERNS) {
        if (pattern.test(normalizedPath)) return route;
    }

    if (normalizedPath.startsWith("/sign-in/")) {
        return "/sign-in";
    }
    if (normalizedPath.startsWith("/sign-up/")) {
        return "/sign-up";
    }

    return STATIC_ROUTES.has(normalizedPath) ? normalizedPath : "/other";
}
