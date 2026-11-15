import {Link, NavLink, Outlet, useLocation, useNavigate} from "react-router-dom";
import {Activity, Flag, LogOut, Settings, Trophy, Users} from "lucide-react";
import {UserButton, useAuth, useUser} from "../auth/client.jsx";
import {clearApiCache} from "../services/api";
import {useSocketStatus} from "../hooks/useSocket";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import ThemeToggle from "../components/ui/ThemeToggle";
import LoadingIndicator from "../components/ui/LoadingIndicator";
import AdminEventProvider from "../contexts/AdminEventProvider";
import {useAdminEvent} from "../contexts/adminEvent";
import {cn} from "../lib/utils";

const GROUPS = [
    {
        title: "Organiser Desk",
        items: [
            {label: "Live Round", path: "/admin", icon: Activity, end: true},
            {label: "Events & Rooms", path: "/admin/events", icon: Flag, also: ["/admin/rounds", "/admin/rooms"]},
            {label: "Participants", path: "/admin/people", icon: Users, also: ["/admin/participants", "/admin/overview"]},
            {label: "Results & Standings", path: "/admin/results", icon: Trophy, also: ["/admin/leaderboard"]},
        ],
    },
];

function isActive(item, pathname) {
    if (item.end) return pathname === item.path;
    return [item.path, ...(item.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function EventSwitcher({className}) {
    const {events, event, setEventId, loading} = useAdminEvent();
    return (
        <label className={cn("block", className)}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#AAD2BA]">Event</span>
            <select
                value={event?.id || ""}
                onChange={(e) => setEventId(e.target.value)}
                disabled={loading || events.length === 0}
                aria-label="Switch event"
                className="h-11 w-full truncate rounded-xl border border-[#4A5646] bg-[#2F322A] px-3 text-sm font-semibold text-[#EAFBF5] disabled:opacity-70 md:text-[15px]"
            >
                {events.length === 0 && <option value="">{loading ? "Loading events…" : "No events yet"}</option>}
                {events.map((e) => <option key={e.id} value={e.id} className="text-[#141510]">{e.name}</option>)}
            </select>
        </label>
    );
}

function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    const {user, isLoaded} = useUser();
    const {signOut} = useAuth();
    const socketConnected = useSocketStatus();
    const hasSecretAdminSession =
        typeof window !== "undefined" &&
        sessionStorage.getItem("isAdminSession") === "true" &&
        Boolean(sessionStorage.getItem("adminSecretKey")?.trim());

    if (!isLoaded && !hasSecretAdminSession) return <LoadingIndicator fullScreen label="Loading admin workspace" />;

    const handleAdminSignOut = async () => {
        sessionStorage.removeItem("isAdminSession");
        sessionStorage.removeItem("adminSecretKey");
        sessionStorage.removeItem("adminAuthFlow");
        clearApiCache();
        window.dispatchEvent(new Event("axiom-admin-session-changed"));
        if (user) {
            await signOut().catch(() => {});
        }
        navigate("/", {replace: true});
    };

    const linkBase = "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-[15px] font-medium transition-colors";
    const [liveItem, eventsItem, peopleItem, resultsItem] = GROUPS[0].items;
    const tabs = [
        {label: "Live", path: "/admin", icon: Activity, active: isActive(liveItem, location.pathname)},
        {label: "Events", path: "/admin/events", icon: Flag, active: isActive(eventsItem, location.pathname)},
        {label: "People", path: "/admin/people", icon: Users, active: isActive(peopleItem, location.pathname)},
        {label: "Results", path: "/admin/results", icon: Trophy, active: isActive(resultsItem, location.pathname)},
    ];
    const settingsActive = location.pathname === "/admin/settings" || location.pathname.startsWith("/admin/settings/");

    return (
        <div className="axiom-workspace flex min-h-svh bg-background text-foreground">
            <a className="axiom-skip" href="#admin-main">Skip to content</a>

            {/* Desktop sidebar */}
            <nav aria-label="Organiser" className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[#1D1E18] px-3.5 py-5 text-[#EAFBF5] md:flex dark:bg-[#161710]">
                <div className="flex items-center gap-2.5 px-2 pb-4">
                    <Link to="/admin" aria-label="AXIOM 4.0 organiser home"><Axiom40Logo variant="nav" className="!w-24 text-[#EAFBF5]" /></Link>
                    <span className="rounded-md bg-[#B9F5D8] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#141510]">Organiser</span>
                </div>
                <EventSwitcher className="mb-3" />
                {GROUPS.map((group) => (
                    <div key={group.title} className="flex flex-col gap-1">
                        <p className="mx-2 mb-0.5 mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#AAD2BA]">{group.title}</p>
                        {group.items.map((item) => {
                            const active = isActive(item, location.pathname);
                            return (
                                <NavLink key={item.path} to={item.path} aria-current={active ? "page" : undefined} className={cn(linkBase, active ? "bg-[#EAFBF5] font-bold text-[#1D1E18]" : "text-[#EAFBF5] hover:bg-[#4A5646]")}>
                                    <span className="flex items-center gap-2.5"><item.icon size={18} aria-hidden="true" />{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
                <div className="mt-auto flex flex-col gap-3 border-t border-[#4A5646] pt-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-sm font-semibold">{user?.fullName || "Tournament Organiser"}</p>
                            <p className="m-0 text-xs text-[#AAD2BA]">{user ? "Organiser" : "Secret Key Session"}</p>
                        </div>
                        <Link
                            to="/admin/settings"
                            aria-label="Admin settings"
                            title="Settings"
                            aria-current={settingsActive ? "page" : undefined}
                            className={cn(
                                "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors",
                                settingsActive
                                    ? "border-[#B9F5D8] bg-[#B9F5D8] text-[#141510]"
                                    : "border-[#4A5646] bg-[#2F322A] text-[#EAFBF5] hover:bg-[#4A5646]"
                            )}
                        >
                            <Settings size={17} aria-hidden="true" />
                        </Link>
                        <ThemeToggle />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1 text-sm">
                        {user ? (
                            <>
                                <Link to="/dashboard" className="font-semibold text-[#EAFBF5] underline underline-offset-4">Participant view</Link>
                                <div className="text-[#EAFBF5] [&_button]:text-[#EAFBF5] [&_span]:text-[#EAFBF5]"><UserButton /></div>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleAdminSignOut}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#4A5646] bg-[#2F322A] px-3 py-1.5 text-xs font-semibold text-[#EAFBF5] transition hover:bg-[#4A5646]"
                            >
                                <LogOut size={14} aria-hidden="true" />
                                <span>Exit Admin</span>
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* Phone top bar */}
                <header className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-border bg-background px-3 py-2 md:hidden">
                    <div className="min-w-0 flex-1 [&_span]:hidden [&_select]:border-border [&_select]:bg-card [&_select]:text-foreground"><EventSwitcher /></div>
                    <div role="status" aria-label={socketConnected ? "Live sync on" : "Connecting"} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold", socketConnected ? "ax-signal-win bg-[#D4EDE1] text-[#1D1E18] dark:bg-[#3A3E34] dark:text-[#D4EDE1]" : "ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-300")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#1D1E18] dark:bg-[#B9F5D8] axiom-live-dot" : "bg-rose-500 animate-pulse")} />
                        {socketConnected ? "Live" : "…"}
                    </div>
                    <Link
                        to="/admin/settings"
                        aria-label="Admin settings"
                        title="Settings"
                        aria-current={settingsActive ? "page" : undefined}
                        className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors",
                            settingsActive
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-muted"
                        )}
                    >
                        <Settings size={17} aria-hidden="true" />
                    </Link>
                    <ThemeToggle />
                    {!user && (
                        <button
                            type="button"
                            onClick={handleAdminSignOut}
                            aria-label="Exit Admin"
                            title="Exit Admin"
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-muted"
                        >
                            <LogOut size={17} aria-hidden="true" />
                        </button>
                    )}
                </header>

                <div className="hidden items-center justify-end px-8 pt-4 md:flex">
                    <div role="status" className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", socketConnected ? "ax-signal-win bg-[#D4EDE1] text-[#1D1E18] dark:bg-[#3A3E34] dark:text-[#D4EDE1]" : "ax-signal-loss bg-rose-500/15 text-rose-700 dark:text-rose-300")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#1D1E18] dark:bg-[#B9F5D8] axiom-live-dot" : "bg-rose-500 animate-pulse")} />
                        {socketConnected ? "Live sync on" : "Connecting…"}
                    </div>
                </div>

                <main id="admin-main" className="min-w-0 flex-1 px-4 pb-44 pt-4 md:px-8 md:pb-10">
                    <div key={location.pathname} className="axiom-page-body"><Outlet /></div>
                </main>

                {/* Phone bottom tab bar — 4 unified destinations */}
                <nav aria-label="Organiser" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-[#4A5646] bg-[#1D1E18] pb-[env(safe-area-inset-bottom)] text-[#EAFBF5] md:hidden dark:bg-[#161710]">
                    {tabs.map((t) => (
                        <Link key={t.path} to={t.path} aria-current={t.active ? "page" : undefined} className={cn("flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-semibold", t.active ? "text-[#EAFBF5]" : "text-[#BDD9CA]")}>
                            <span className={cn("grid h-7 w-12 place-items-center rounded-full", t.active && "bg-[#4A5646]")}><t.icon size={18} aria-hidden="true" /></span>
                            <span className="truncate max-w-full px-1">{t.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}

export default function AdminLayout() {
    return <AdminEventProvider><Shell /></AdminEventProvider>;
}
