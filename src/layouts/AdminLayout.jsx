import {useEffect, useState} from "react";
import {Link, NavLink, Outlet, useLocation} from "react-router-dom";
import {Activity, ChartColumn, ClipboardList, DoorOpen, Flag, LayoutDashboard, Medal, Ellipsis, Settings, Users, X} from "lucide-react";
import {UserButton, useUser} from "../auth/client.jsx";
import {useSocketStatus} from "../hooks/useSocket";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import ThemeToggle from "../components/ui/ThemeToggle";
import ModalSurface from "../components/ui/ModalSurface";
import LoadingIndicator from "../components/ui/LoadingIndicator";
import AdminEventProvider from "../contexts/AdminEventProvider";
import {useAdminEvent} from "../contexts/adminEvent";
import {cn} from "../lib/utils";

const GROUPS = [
    {
        title: "Run the event",
        items: [
            {label: "Live round", path: "/admin", icon: Activity, end: true},
            {label: "People", path: "/admin/people", icon: Users},
            {label: "Rooms", path: "/admin/rooms", icon: DoorOpen},
        ],
    },
    {
        title: "Outcomes",
        items: [
            {label: "Ballots & results", path: "/admin/results", icon: ClipboardList},
            {label: "Standings", path: "/admin/leaderboard", icon: Medal},
        ],
    },
    {
        title: "Setup",
        items: [
            {label: "Event & rounds", path: "/admin/events", icon: Flag, also: ["/admin/rounds"]},
            {label: "Overview", path: "/admin/overview", icon: ChartColumn},
            {label: "Settings", path: "/admin/settings", icon: Settings},
        ],
    },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function isActive(item, pathname) {
    if (item.end) return pathname === item.path;
    return [item.path, ...(item.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function EventSwitcher({className}) {
    const {events, event, setEventId, loading} = useAdminEvent();
    return (
        <label className={cn("block", className)}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A9BDB4]">Event</span>
            <select
                value={event?.id || ""}
                onChange={(e) => setEventId(e.target.value)}
                disabled={loading || events.length === 0}
                aria-label="Switch event"
                className="h-11 w-full rounded-xl border border-[#2D5A4A] bg-[#0A3E31] px-3 text-[15px] font-semibold text-[#F4F1EB] disabled:opacity-70"
            >
                {events.length === 0 && <option value="">{loading ? "Loading events…" : "No events yet"}</option>}
                {events.map((e) => <option key={e.id} value={e.id} className="text-[#0F2A22]">{e.name}</option>)}
            </select>
        </label>
    );
}

function Shell() {
    const [moreOpen, setMoreOpen] = useState(false);
    const location = useLocation();
    const {user, isLoaded} = useUser();
    const socketConnected = useSocketStatus();

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 768px)");
        const close = (event) => { if (event.matches) setMoreOpen(false); };
        desktop.addEventListener("change", close);
        return () => desktop.removeEventListener("change", close);
    }, []);

    if (!isLoaded) return <LoadingIndicator fullScreen label="Loading admin workspace" />;

    const linkBase = "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-[15px] font-medium transition-colors";
    const tabs = [
        {label: "Live", path: "/admin", icon: Activity, active: location.pathname === "/admin"},
        {label: "People", path: "/admin/people", icon: Users, active: location.pathname.startsWith("/admin/people") || location.pathname.startsWith("/admin/participants")},
        {label: "Standings", path: "/admin/leaderboard", icon: Medal, active: location.pathname.startsWith("/admin/leaderboard")},
    ];
    const moreActive = !tabs.some((t) => t.active);
    const moreItems = ALL_ITEMS.filter((i) => !["/admin", "/admin/people", "/admin/leaderboard"].includes(i.path));

    return (
        <div className="axiom-workspace flex min-h-svh bg-background text-foreground">
            <a className="axiom-skip" href="#admin-main">Skip to content</a>

            {/* Desktop sidebar */}
            <nav aria-label="Organiser" className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[#0D4C3C] px-3.5 py-5 text-[#F4F1EB] md:flex dark:bg-[#071A15]">
                <div className="flex items-center gap-2.5 px-2 pb-4">
                    <Link to="/admin" aria-label="AXIOM 4.0 organiser home"><Axiom40Logo variant="nav" className="!w-24 text-[#F4F1EB]" /></Link>
                    <span className="rounded-md bg-[#7BA05B] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F2A22]">Organiser</span>
                </div>
                <EventSwitcher className="mb-3" />
                {GROUPS.map((group) => (
                    <div key={group.title} className="flex flex-col gap-1">
                        <p className="mx-2 mb-0.5 mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#A9BDB4]">{group.title}</p>
                        {group.items.map((item) => {
                            const active = isActive(item, location.pathname);
                            return (
                                <NavLink key={item.path} to={item.path} aria-current={active ? "page" : undefined} className={cn(linkBase, active ? "bg-[#F4F1EB] font-bold text-[#0D4C3C]" : "text-[#F4F1EB] hover:bg-[#2D5A4A]")}>
                                    <span className="flex items-center gap-2.5"><item.icon size={18} aria-hidden="true" />{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
                <div className="mt-auto flex flex-col gap-3 border-t border-[#2D5A4A] pt-4">
                    <div className="flex items-center gap-2.5 px-1">
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-sm font-semibold">{user?.fullName || "Organiser"}</p>
                            <p className="m-0 text-xs text-[#A9BDB4]">Organiser</p>
                        </div>
                        <ThemeToggle />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1 text-sm">
                        <Link to="/dashboard" className="font-semibold text-[#F4F1EB] underline underline-offset-4">Participant view</Link>
                        <div className="text-[#F4F1EB] [&_button]:text-[#F4F1EB] [&_span]:text-[#F4F1EB]"><UserButton /></div>
                    </div>
                </div>
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* Phone top bar */}
                <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background px-3 py-2 md:hidden">
                    <div className="min-w-0 flex-1 [&_span]:hidden [&_select]:h-10 [&_select]:border-border [&_select]:bg-card [&_select]:text-foreground"><EventSwitcher /></div>
                    <div role="status" aria-label={socketConnected ? "Live sync on" : "Connecting"} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", socketConnected ? "bg-[#E6EEDB] text-[#0D4C3C] dark:bg-[#1C4A3A] dark:text-[#E6EEDB]" : "bg-destructive/10 text-destructive")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#0D4C3C] dark:bg-[#7BA05B] axiom-live-dot" : "bg-destructive animate-pulse")} />
                        {socketConnected ? "Live" : "…"}
                    </div>
                    <ThemeToggle />
                </header>

                <div className="hidden items-center justify-end px-8 pt-4 md:flex">
                    <div role="status" className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", socketConnected ? "bg-[#E6EEDB] text-[#0D4C3C] dark:bg-[#1C4A3A] dark:text-[#E6EEDB]" : "bg-destructive/10 text-destructive")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#0D4C3C] dark:bg-[#7BA05B] axiom-live-dot" : "bg-destructive animate-pulse")} />
                        {socketConnected ? "Live sync on" : "Connecting…"}
                    </div>
                </div>

                <main id="admin-main" className="min-w-0 flex-1 px-4 pb-44 pt-4 md:px-8 md:pb-10">
                    <div key={location.pathname} className="axiom-page-body"><Outlet /></div>
                </main>

                {/* Phone bottom tab bar */}
                <nav aria-label="Organiser" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-[#2D5A4A] bg-[#0D4C3C] pb-[env(safe-area-inset-bottom)] text-[#F4F1EB] md:hidden dark:bg-[#071A15]">
                    {tabs.map((t) => (
                        <Link key={t.path} to={t.path} aria-current={t.active ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-0.5 text-xs font-semibold", t.active ? "text-[#F4F1EB]" : "text-[#C9D3CC]")}>
                            <span className={cn("grid h-7 w-12 place-items-center rounded-full", t.active && "bg-[#2D5A4A]")}><t.icon size={18} aria-hidden="true" /></span>{t.label}
                        </Link>
                    ))}
                    <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-current={moreActive ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-0.5 text-xs font-semibold", moreActive ? "text-[#F4F1EB]" : "text-[#C9D3CC]")}>
                        <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-[#2D5A4A]")}><Ellipsis size={18} aria-hidden="true" /></span>More
                    </button>
                </nav>

                {moreOpen && (
                    <ModalSurface onDismiss={() => setMoreOpen(false)} aria-label="More organiser links" className="flex flex-col justify-end">
                        <div className="rounded-t-3xl bg-background p-4 pb-8 text-foreground shadow-2xl">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="font-heading text-xl font-bold">More</h2>
                                <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full"><X size={20} aria-hidden="true" /></button>
                            </div>
                            <ul className="m-0 grid list-none gap-1 p-0">
                                {moreItems.map((item) => (
                                    <li key={item.path}><Link to={item.path} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-muted"><item.icon size={18} aria-hidden="true" />{item.label}</Link></li>
                                ))}
                                <li><Link to="/dashboard" onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-muted"><LayoutDashboard size={18} aria-hidden="true" />Participant view</Link></li>
                            </ul>
                            <div className="mt-3 border-t border-border pt-3 text-sm"><UserButton /></div>
                        </div>
                    </ModalSurface>
                )}
            </div>
        </div>
    );
}

export default function AdminLayout() {
    return <AdminEventProvider><Shell /></AdminEventProvider>;
}
