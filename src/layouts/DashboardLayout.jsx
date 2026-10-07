import {useState, useEffect} from "react";
import {Outlet, Link, useLocation} from "react-router-dom";
import {
    UserButton,
    useUser,
    RedirectToSignIn,
    useAuth,
} from "@clerk/clerk-react";
import {
    LayoutDashboard,
    Calendar,
    Users,
    Menu,
    ShieldCheck,
    Sun,
    Moon,
} from "lucide-react";

import {cn} from "../lib/utils";
import {motion as Motion} from "framer-motion";
import {useTheme} from "../hooks/useTheme"
import Axiom40Logo from "../components/brand/Axiom40Logo";
import Sculpture from "../components/brand/Sculpture";

const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
);
const API_BASE_URL = isLocalhost
    ? import.meta.env.VITE_API_URL || "http://localhost:3000/api"
    : "/api";

const sidebarItems = [
    {icon: LayoutDashboard, label: "Overview", path: "/dashboard"},
    {icon: Calendar, label: "Events", path: "/dashboard/events"},
    {icon: Users, label: "Profile", path: "/dashboard/profile"},
];

export default function DashboardLayout() {
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const {user, isLoaded, isSignedIn} = useUser();
    const {getToken} = useAuth();
    const {theme, toggleTheme} = useTheme();

    // Check admin status to show admin link (silently - 403 is expected for non-admins)
    useEffect(() => {
        const checkAdmin = async () => {
            if (isSignedIn) {
                try {
                    const token = await getToken();
                    // Direct fetch to avoid logging expected 403 errors
                    const response = await fetch(`${API_BASE_URL}/admin/me`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setIsAdmin(data.success && !!data.admin);
                    } else {
                        // 403 is expected for non-admins, silently set to false
                        setIsAdmin(false);
                    }
                } catch {
                    // Network error or other issue - assume not admin
                    setIsAdmin(false);
                }
            }
        };
        checkAdmin();
    }, [isSignedIn, getToken]);

    if (!isLoaded)
        return (
            <div className="min-h-screen flex items-center justify-center font-sans text-muted-foreground">
                Loading...
            </div>
        );

    if (!isSignedIn) {
        return <RedirectToSignIn />;
    }

    const currentSidebarItems = [...sidebarItems];

    if (isAdmin) {
        currentSidebarItems.push({
            icon: ShieldCheck,
            label: "Admin Panel",
            path: "/admin",
        });
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex axiom-workspace">
            {/* Desktop Sidebar */}
            <Motion.aside
                initial={{x: 0}}
                animate={{width: desktopSidebarOpen ? 240 : 80}}
                className="fixed md:relative z-30 h-screen border-r border-border bg-card/60 backdrop-blur-xl hidden md:flex flex-col"
            >
                <div className={cn("h-20 flex items-center border-b border-border/60", desktopSidebarOpen ? "px-5" : "px-3")}>
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 group"
                        aria-label="AXIOM 4.0 Dashboard Home"
                    >
                        <Axiom40Logo
                            variant="nav"
                            className={cn(
                                "text-primary transition-colors",
                                desktopSidebarOpen ? "w-28" : "w-11 mx-auto",
                            )}
                        />
                    </Link>
                </div>

                <div className="flex-1 py-4 flex flex-col gap-1.5 px-3 overflow-y-auto no-scrollbar">
                    {currentSidebarItems.map((item) => {
                        const isActive = location.pathname === item.path;
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
                                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium",
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                                        !desktopSidebarOpen && "mx-auto",
                                    )}
                                    aria-hidden="true"
                                />
                                {desktopSidebarOpen && (
                                    <span className="truncate">
                                        {item.label}
                                    </span>
                                )}

                                {isActive && !desktopSidebarOpen && (
                                    <Motion.div
                                        layoutId="activeStrip"
                                        className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Editorial accent preview in sidebar */}
                {desktopSidebarOpen && (
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
                        onClick={() =>
                            setDesktopSidebarOpen(!desktopSidebarOpen)
                        }
                        aria-label={desktopSidebarOpen ? "Collapse View" : "Expand navigation sidebar"}
                        title={desktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {desktopSidebarOpen ? (
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
                    <div className="md:hidden flex items-center gap-2">
                        <Link
                            to="/dashboard"
                            aria-label="AXIOM 4.0 Dashboard Home"
                            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                        >
                            <Axiom40Logo variant="nav" className="w-28 text-primary" />
                        </Link>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {/* Theme Toggle Button */}
                        <Motion.button
                            onClick={toggleTheme}
                            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                            className="relative p-2 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            whileTap={{scale: 0.95}}
                            whileHover={{scale: 1.05}}
                        >
                            <Motion.div
                                initial={false}
                                animate={{
                                    rotate: theme === "dark" ? 0 : 180,
                                }}
                                transition={{
                                    duration: 0.4,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            >
                                {theme === "dark" ? (
                                    <Moon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                ) : (
                                    <Sun className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                )}
                            </Motion.div>
                        </Motion.button>

                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-heading font-medium leading-tight">
                                {user.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground font-sans">
                                {user.primaryEmailAddress?.emailAddress}
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
                        {currentSidebarItems.slice(0, 5).map((item) => {
                            const isActive = location.pathname === item.path;
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
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "w-4 h-4",
                                            isActive && "scale-110",
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="text-[10px] font-sans font-medium">
                                        {item.label === "Admin Panel" ? "Admin" : item.label}
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
