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
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#93B1A7]">Event</span>
            <select
                value={event?.id || ""}
                onChange={(e) => setEventId(e.target.value)}
                disabled={loading || events.length === 0}
                aria-label="Switch event"
                className="h-11 w-full rounded-xl border border-[#47695F] bg-[#2A4640] px-3 text-[15px] font-semibold text-[#EEF8E4] disabled:opacity-70"
            >
                {events.length === 0 && <option value="">{loading ? "Loading events…" : "No events yet"}</option>}
                {events.map((e) => <option key={e.id} value={e.id} className="text-[#172923]">{e.name}</option>)}
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
            <nav aria-label="Organiser" className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[#243D38] px-3.5 py-5 text-[#EEF8E4] md:flex dark:bg-[#101E1B]">
                <div className="flex items-center gap-2.5 px-2 pb-4">
                    <Link to="/admin" aria-label="AXIOM 4.0 organiser home"><Axiom40Logo variant="nav" className="!w-24 text-[#EEF8E4]" /></Link>
                    <span className="rounded-md bg-[#C5EDAC] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#172923]">Organiser</span>
                </div>
                <EventSwitcher className="mb-3" />
                {GROUPS.map((group) => (
                    <div key={group.title} className="flex flex-col gap-1">
                        <p className="mx-2 mb-0.5 mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#93B1A7]">{group.title}</p>
                        {group.items.map((item) => {
                            const active = isActive(item, location.pathname);
                            return (
                                <NavLink key={item.path} to={item.path} aria-current={active ? "page" : undefined} className={cn(linkBase, active ? "bg-[#EEF8E4] font-bold text-[#243D38]" : "text-[#EEF8E4] hover:bg-[#47695F]")}>
                                    <span className="flex items-center gap-2.5"><item.icon size={18} aria-hidden="true" />{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
                <div className="mt-auto flex flex-col gap-3 border-t border-[#47695F] pt-4">
                    <div className="flex items-center gap-2.5 px-1">
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-sm font-semibold">{user?.fullName || "Organiser"}</p>
                            <p className="m-0 text-xs text-[#93B1A7]">Organiser</p>
                        </div>
                        <ThemeToggle />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1 text-sm">
                        <Link to="/dashboard" className="font-semibold text-[#EEF8E4] underline underline-offset-4">Participant view</Link>
                        <div className="text-[#EEF8E4] [&_button]:text-[#EEF8E4] [&_span]:text-[#EEF8E4]"><UserButton /></div>
                    </div>
                </div>
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* Phone top bar */}
                <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background px-3 py-2 md:hidden">
                    <div className="min-w-0 flex-1 [&_span]:hidden [&_select]:h-10 [&_select]:border-border [&_select]:bg-card [&_select]:text-foreground"><EventSwitcher /></div>
                    <div role="status" aria-label={socketConnected ? "Live sync on" : "Connecting"} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", socketConnected ? "bg-[#DBEACF] text-[#243D38] dark:bg-[#345650] dark:text-[#DBEACF]" : "bg-destructive/10 text-destructive")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#243D38] dark:bg-[#C5EDAC] axiom-live-dot" : "bg-destructive animate-pulse")} />
                        {socketConnected ? "Live" : "…"}
                    </div>
                    <ThemeToggle />
                </header>

                <div className="hidden items-center justify-end px-8 pt-4 md:flex">
                    <div role="status" className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", socketConnected ? "bg-[#DBEACF] text-[#243D38] dark:bg-[#345650] dark:text-[#DBEACF]" : "bg-destructive/10 text-destructive")}>
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", socketConnected ? "bg-[#243D38] dark:bg-[#C5EDAC] axiom-live-dot" : "bg-destructive animate-pulse")} />
                        {socketConnected ? "Live sync on" : "Connecting…"}
                    </div>
                </div>

                <main id="admin-main" className="min-w-0 flex-1 px-4 pb-44 pt-4 md:px-8 md:pb-10">
                    <div key={location.pathname} className="axiom-page-body"><Outlet /></div>
                </main>

                {/* Phone bottom tab bar */}
                <nav aria-label="Organiser" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-[#47695F] bg-[#243D38] pb-[env(safe-area-inset-bottom)] text-[#EEF8E4] md:hidden dark:bg-[#101E1B]">
                    {tabs.map((t) => (
                        <Link key={t.path} to={t.path} aria-current={t.active ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-0.5 text-xs font-semibold", t.active ? "text-[#EEF8E4]" : "text-[#C9DEC1]")}>
                            <span className={cn("grid h-7 w-12 place-items-center rounded-full", t.active && "bg-[#47695F]")}><t.icon size={18} aria-hidden="true" /></span>{t.label}
                        </Link>
                    ))}
                    <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-current={moreActive ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-0.5 text-xs font-semibold", moreActive ? "text-[#EEF8E4]" : "text-[#C9DEC1]")}>
                        <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-[#47695F]")}><Ellipsis size={18} aria-hidden="true" /></span>More
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
