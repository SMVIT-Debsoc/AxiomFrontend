export const dashboardRoutes = {
  home: () => import("../pages/dashboard/DashboardHome"),
  events: () => import("../pages/dashboard/DashboardEvents"),
  event: () => import("../pages/dashboard/EventDetails"),
  round: () => import("../pages/dashboard/RoundDetails"),
  results: () => import("../pages/dashboard/Results"),
  participants: () => import("../pages/dashboard/Participants"),
  profile: () => import("../pages/dashboard/Profile"),
};

const prefetched = new Set();

export function preloadDashboardRoute(to) {
  if (typeof to !== "string") return;
  const connection = navigator.connection;
  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType)) return;

  const path = to.split(/[?#]/, 1)[0].replace(/\/$/, "");
  let route;
  if (path === "/dashboard") route = "home";
  else if (path === "/dashboard/events") route = "events";
  else if (path === "/dashboard/profile") route = "profile";
  else if (/^\/dashboard\/events\/[^/]+$/.test(path)) route = "event";
  else if (/^\/dashboard\/events\/[^/]+\/rounds\/[^/]+$/.test(path)) route = "round";
  else if (/^\/dashboard\/events\/[^/]+\/results$/.test(path)) route = "results";
  else if (/^\/dashboard\/events\/[^/]+\/participants$/.test(path)) route = "participants";

  if (!route || prefetched.has(route)) return;
  prefetched.add(route);
  void dashboardRoutes[route]().catch(() => prefetched.delete(route));
}
