import {useState, useEffect} from "react";
import {Outlet, Link, useLocation} from "react-router-dom";
import {
    UserButton,
    useUser,
    SignedIn,
    RedirectToSignIn,
    useAuth,
} from "@clerk/clerk-react";
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Trophy,
    ShieldCheck,
} from "lucide-react";

import {cn} from "../lib/utils";
import {motion, AnimatePresence} from "framer-motion";
import {AdminApi} from "../services/api";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const sidebarItems = [
    {icon: LayoutDashboard, label: "Overview", path: "/dashboard"},
    {icon: Calendar, label: "Events", path: "/dashboard/events"},
    {icon: Users, label: "My Profile", path: "/dashboard/profile"},
    {icon: Trophy, label: "Leaderboard", path: "/dashboard/leaderboard"},
    {icon: Settings, label: "Settings", path: "/dashboard/settings"},
];

export default function DashboardLayout() {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const {user, isLoaded, isSignedIn} = useUser();
    const {getToken} = useAuth();

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
                } catch (e) {
                    // Network error or other issue - assume not admin
                    setIsAdmin(false);
                }
            }
        };
        checkAdmin();
    }, [isSignedIn, getToken]);

    if (!isLoaded)
        return (
            <div className="min-h-screen flex items-center justify-center">
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
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileSidebarOpen && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="md:hidden fixed inset-0 z-20 bg-black/50"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {mobileSidebarOpen && (
                    <motion.aside
                        initial={{x: -280}}
                        animate={{x: 0}}
                        exit={{x: -280}}
                        transition={{duration: 0.3, ease: "easeInOut"}}
                        className="md:hidden fixed z-30 h-screen w-[280px] border-r border-border bg-card backdrop-blur-xl flex flex-col"
                    >
                        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    A
                                </div>
                                <span className="font-bold text-xl">Axiom</span>
                            </div>
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 py-6 flex flex-col gap-2 px-3">
                            {currentSidebarItems.map((item, index) => {
                                const isActive =
                                    location.pathname === item.path;
                                const Icon = item.icon;

                                return (
                                    <motion.div
                                        key={item.path}
                                        initial={{opacity: 0, x: -20}}
                                        animate={{opacity: 1, x: 0}}
                                        transition={{
                                            delay: index * 0.05,
                                            duration: 0.3,
                                        }}
                                    >
                                        <Link
                                            to={item.path}
                                            onClick={() =>
                                                setMobileSidebarOpen(false)
                                            }
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span className="font-medium">
                                                {item.label}
                                            </span>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <motion.aside
                initial={{x: 0}}
                animate={{width: desktopSidebarOpen ? 240 : 80}}
                className="fixed md:relative z-30 h-screen border-r border-border bg-card/50 backdrop-blur-xl hidden md:flex flex-col"
            >
                <div className="h-16 flex items-center px-6 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                            A
                        </div>
                        {desktopSidebarOpen && (
                            <span className="font-bold text-xl">Axiom</span>
                        )}
                    </div>
                </div>

                <div className="flex-1 py-6 flex flex-col gap-2 px-3">
                    {currentSidebarItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-5 h-5",
                                        !desktopSidebarOpen && "mx-auto"
                                    )}
                                />
                                {desktopSidebarOpen && (
                                    <span className="font-medium">
                                        {item.label}
                                    </span>
                                )}

                                {/* Active Indicator Strip */}
                                {isActive && !desktopSidebarOpen && (
                                    <motion.div
                                        layoutId="activeStrip"
                                        className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-border/50">
                    <button
                        onClick={() =>
                            setDesktopSidebarOpen(!desktopSidebarOpen)
                        }
                        className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        {desktopSidebarOpen ? (
                            "Collapse View"
                        ) : (
                            <Menu className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </motion.aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
                    <div className="md:hidden">
                        {/* Mobile Menu Trigger */}
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="p-1"
                        >
                            <Menu className="w-6 h-6 cursor-pointer" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">
                                {user.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {user.primaryEmailAddress?.emailAddress}
                            </p>
                        </div>
                        <UserButton />
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
