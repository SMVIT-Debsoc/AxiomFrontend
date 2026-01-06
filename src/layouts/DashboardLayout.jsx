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
    Menu,
    Trophy,
    ShieldCheck,
    Sun,
    Moon,
} from "lucide-react";

import {cn} from "../lib/utils";
import {motion} from "framer-motion";
import {AdminApi} from "../services/api";
import {useTheme} from "../contexts/ThemeContext";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const sidebarItems = [
    {icon: LayoutDashboard, label: "Overview", path: "/dashboard"},
    {icon: Calendar, label: "Events", path: "/dashboard/events"},
    {icon: Users, label: "My Profile", path: "/dashboard/profile"},
    {icon: Trophy, label: "Leaderboard", path: "/dashboard/leaderboard"},
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
                    <div className="md:hidden flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                            A
                        </div>
                        <span className="font-bold text-lg">Axiom</span>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {/* Theme Toggle Button */}
                        <motion.button
                            onClick={toggleTheme}
                            className="relative p-2 rounded-xl bg-muted/50 hover:bg-muted border border-border"
                            whileTap={{scale: 0.95}}
                            whileHover={{scale: 1.05}}
                        >
                            <motion.div
                                initial={false}
                                animate={{
                                    rotate: theme === "dark" ? 0 : 180,
                                }}
                                transition={{
                                    duration: 0.5,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            >
                                {theme === "dark" ? (
                                    <Moon className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <Sun className="w-5 h-5 text-amber-500" />
                                )}
                            </motion.div>
                        </motion.button>

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
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 pb-24 md:pb-10 scroll-smooth">
                    <Outlet />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50 safe-area-inset-bottom">
                    <div className="flex items-center justify-around py-2">
                        {currentSidebarItems.slice(0, 5).map((item) => {
                            const isActive = location.pathname === item.path;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        "flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all",
                                        isActive
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "w-5 h-5",
                                            isActive && "scale-110"
                                        )}
                                    />
                                    <span className="text-[10px] font-medium">
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
