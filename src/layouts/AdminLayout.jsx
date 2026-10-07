import {useEffect, useState} from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    Menu,
    Trophy,
    Shield,
    ClipboardList,
    MapPin,
    X,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useSocketStatus } from "../hooks/useSocket";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import { cn } from "../lib/utils";
import { SidebarRail, MobileTabs } from "../components/layout/SidebarRail";
import NeoIcon from "../components/icons/NeoIcons";
import ModalSurface from "../components/ui/ModalSurface";

const sidebarItems = [
  { icon: "LayoutIcon", label: "Dashboard", path: "/admin" },
  { icon: "EventsIcon", label: "Events", path: "/admin/events" },
  { icon: "RoundsIcon", label: "Rounds", path: "/admin/rounds" },
  { icon: "IdCardIcon", label: "Participants", path: "/admin/participants" },
  { icon: "RoomsIcon", label: "Rooms", path: "/admin/rooms" },
  { icon: "ResultsIcon", label: "Results", path: "/admin/results" },
  { icon: "LeaderboardIcon", label: "Leaderboard", path: "/admin/leaderboard" },
  { icon: "SettingsIcon", label: "Settings", path: "/admin/settings" },
  { icon: "ExitIcon", label: "User View", path: "/dashboard" },
];

export default function AdminLayout() {
      const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const { user } = useUser();
    const socketConnected = useSocketStatus();
    const navItems = sidebarItems.map((item) => ({
        ...item,
        active:
            location.pathname === item.path ||
            (item.path !== "/admin" && item.path !== "/dashboard" && location.pathname.startsWith(item.path)),
    }));

    useEffect(() => {
        const mobile = window.matchMedia("(max-width: 767px)");
        const dismissOnDesktop = (event) => {
            if (!event.matches) setMobileMenuOpen(false);
        };
        mobile.addEventListener("change", dismissOnDesktop);
        return () => mobile.removeEventListener("change", dismissOnDesktop);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex axiom-workspace">
            {/* Mobile Sidebar Overlay & Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <ModalSurface drawer onDismiss={() => setMobileMenuOpen(false)} initialFocus='button[aria-label="Close navigation menu"]' id="admin-mobile-navigation"
                            aria-label="Admin Navigation Menu"
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{
                                type: "tween",
                                duration: .24,
                                ease: "easeOut",
                            }}
                            className="fixed left-0 top-0 z-50 h-screen w-[280px] border-r border-border bg-card/95 backdrop-blur-xl flex flex-col"
                        >
                            <div className="h-20 flex items-center justify-between px-5 border-b border-border/60">
                                <Link
                                    to="/admin"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                                    aria-label="AXIOM 4.0 Admin Home"
                                >
                                    <Axiom40Logo variant="nav" className="w-28 text-primary" />
                                    <span className="axiom-eyebrow text-[10px] tracking-wider uppercase font-heading font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        Admin
                                    </span>
                                </Link>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label="Close navigation menu"
                                >
                                    <X className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </div>
                            <div className="flex-1 py-4 flex flex-col gap-1.5 px-3 overflow-y-auto no-scrollbar">
                                {sidebarItems.map((item) => {
                                    const isActive =
                                        location.pathname === item.path ||
                                        (item.path !== "/admin" &&
                                            location.pathname.startsWith(item.path));

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            aria-current={isActive ? "page" : undefined}
                                            className="neo-drawer-link"
                                        >
                                            <span className="neo-tile neo-tile--sm" aria-hidden="true">
                                                <NeoIcon name={item.icon} className="neo-tile-glyph" />
                                            </span>
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t border-border/60">
                                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 relative overflow-hidden select-none">
                                    <span className="axiom-eyebrow text-[10px] tracking-wider uppercase text-primary font-heading font-semibold block mb-0.5">
                                        AXIOM 4.0
                                    </span>
                                    <p className="text-xs text-muted-foreground font-sans leading-tight">
                                        Admin Workspace
                                    </p>
                                </div>
                            </div>
                        </ModalSurface>
                    </>
                )}
            </AnimatePresence>

            <SidebarRail items={navItems} homePath="/admin" homeLabel="AXIOM 4.0 Admin Home" />

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                {/* Top Header */}
                <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors border border-border/60 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Open navigation menu"
                            aria-expanded={mobileMenuOpen}
                            aria-controls="admin-mobile-navigation"
                        >
                            <Menu className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <Link to="/admin" className="md:hidden" aria-label="AXIOM 4.0 Admin Home">
                            <Axiom40Logo variant="nav" className="w-24 text-primary" />
                        </Link>
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60">
                            <Shield className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                            <span className="text-xs font-heading font-medium tracking-wide">
                                Admin Mode
                            </span>
                        </div>

                        <div role="status" aria-label={socketConnected ? "Real-time Ready" : "Connecting..."} className={cn(
                            "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-sans",
                            socketConnected
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                socketConnected ? "bg-emerald-500 axiom-live-dot" : "bg-destructive animate-pulse"
                            )} />
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">
                                {socketConnected ? "Real-time Ready" : "Connecting..."}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-heading font-medium leading-tight">
                                {user?.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground font-sans">
                                Administrator
                            </p>
                        </div>
                        <UserButton />
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-24 md:pb-8 scroll-smooth min-w-0">
                    <div key={location.pathname} className="axiom-rise"><Outlet /></div>
                </main>

                <MobileTabs
                    items={navItems.filter((item) =>
                        ["/admin", "/admin/events", "/admin/rounds", "/admin/results", "/admin/participants"].includes(item.path)
                    )}
                />
            </div>
        </div>
    );
}
