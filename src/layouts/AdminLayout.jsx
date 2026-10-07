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
import { cn } from "../lib/utils";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useSocketStatus } from "../hooks/useSocket";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import Sculpture from "../components/brand/Sculpture";
import ModalSurface from "../components/ui/ModalSurface";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Calendar, label: "Events", path: "/admin/events" },
    { icon: ClipboardList, label: "Rounds", path: "/admin/rounds" },
    { icon: Users, label: "Participants", path: "/admin/participants" },
    { icon: MapPin, label: "Rooms", path: "/admin/rooms" },
    { icon: Trophy, label: "Results", path: "/admin/results" },
    { icon: Shield, label: "Leaderboard", path: "/admin/leaderboard" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
    { icon: Users, label: "User View", path: "/dashboard" },
];

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const { user } = useUser();
    const socketConnected = useSocketStatus();

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
                                    const Icon = item.icon;

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                isActive
                                                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium"
                                            )}
                                        >
                                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
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

            {/* Desktop Sidebar */}
            <Motion.aside
                initial={{ x: 0 }}
                animate={{ width: sidebarOpen ? 250 : 76 }}
                className="fixed md:relative z-30 h-screen border-r border-border bg-card/60 backdrop-blur-xl hidden md:flex flex-col"
            >
                <div className={cn("h-20 flex items-center border-b border-border/60", sidebarOpen ? "px-5" : "px-3")}>
                    <Link
                        to="/admin"
                        className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 group"
                        aria-label="AXIOM 4.0 Admin Home"
                    >
                        <Axiom40Logo
                            variant="nav"
                            className={cn(
                                "text-primary transition-colors",
                                sidebarOpen ? "w-28" : "w-11 mx-auto"
                            )}
                        />
                        {sidebarOpen && (
                            <span className="axiom-eyebrow text-[10px] tracking-wider uppercase font-heading font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Admin
                            </span>
                        )}
                    </Link>
                </div>

                <div className="flex-1 py-4 flex flex-col gap-1.5 px-3 overflow-y-auto no-scrollbar">
                    {sidebarItems.map((item) => {
                        const isActive =
                            location.pathname === item.path ||
                            (item.path !== "/admin" &&
                                location.pathname.startsWith(item.path));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={item.label}
                                aria-label={item.label}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    isActive
                                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                                        !sidebarOpen && "mx-auto"
                                    )}
                                    aria-hidden="true"
                                />
                                {sidebarOpen && (
                                    <span className="truncate">{item.label}</span>
                                )}
                                {isActive && !sidebarOpen && (
                                    <Motion.div
                                        layoutId="activeAdminStrip"
                                        className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Editorial accent in sidebar */}
                {sidebarOpen && (
                    <div className="mx-3 my-2 p-3 rounded-lg border border-border/60 bg-muted/20 relative overflow-hidden select-none">
                        <div className="relative z-10">
                            <span className="axiom-eyebrow text-[10px] tracking-wider uppercase text-primary font-heading font-semibold block mb-0.5">
                                AXIOM 4.0
                            </span>
                            <p className="text-xs text-muted-foreground font-sans leading-tight">
                                The art of articulation
                            </p>
                        </div>
                        <div className="absolute -right-2 -bottom-3 w-16 h-20 opacity-20 pointer-events-none overflow-hidden">
                            <Sculpture variant="detail" className="w-full h-full object-cover grayscale contrast-125" />
                        </div>
                    </div>
                )}

                <div className="p-3 border-t border-border/60">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label={sidebarOpen ? "Collapse View" : "Expand navigation sidebar"}
                        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {sidebarOpen ? (
                            <>
                                <Menu className="w-4 h-4" aria-hidden="true" />
                                <span>Collapse View</span>
                            </>
                        ) : (
                            <Menu className="w-4 h-4" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </Motion.aside>

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
                                socketConnected ? "bg-emerald-500" : "bg-destructive animate-pulse"
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
                    <Outlet />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav
                    className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50 pb-[env(safe-area-inset-bottom)]"
                    aria-label="Mobile Navigation"
                >
                    <div className="flex items-center justify-around py-1.5 px-2">
                        {sidebarItems
                            .filter((item) =>
                                [
                                    "/admin",
                                    "/admin/events",
                                    "/admin/rounds",
                                    "/admin/results",
                                    "/admin/participants",
                                ].includes(item.path)
                            )
                            .map((item) => {
                                const isActive =
                                    location.pathname === item.path ||
                                    (item.path !== "/admin" &&
                                        location.pathname.startsWith(item.path));
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        aria-label={item.label}
                                        className={cn(
                                            "flex flex-col items-center gap-1 py-1.5 px-3 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            isActive
                                                ? "text-primary font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon
                                            className={cn(
                                                "w-4 h-4",
                                                isActive && "scale-110"
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[10px] font-sans font-medium">
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                    </div>
                </nav>
            </div>
        </div>
    );
}
