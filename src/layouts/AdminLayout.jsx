import {useState} from "react";
import {Outlet, Link, useLocation} from "react-router-dom";
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
} from "lucide-react";
import {cn} from "../lib/utils";
import {motion} from "framer-motion";
import {UserButton, useUser} from "@clerk/clerk-react";

const sidebarItems = [
    {icon: LayoutDashboard, label: "Dashboard", path: "/admin"},
    {icon: Calendar, label: "Events", path: "/admin/events"},
    {icon: ClipboardList, label: "Rounds", path: "/admin/rounds"},
    {icon: Users, label: "Participants", path: "/admin/participants"},
    {icon: MapPin, label: "Rooms", path: "/admin/rooms"},
    {icon: Trophy, label: "Results", path: "/admin/results"},
    {icon: Settings, label: "Settings", path: "/admin/settings"},
];

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();
    const {user} = useUser();

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Sidebar */}
            <motion.aside
                initial={{x: 0}}
                animate={{width: sidebarOpen ? 260 : 80}}
                className="fixed md:relative z-30 h-screen border-r border-border bg-card/50 backdrop-blur-xl hidden md:flex flex-col"
            >
                <div className="h-16 flex items-center px-6 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-purple-500" />
                        </div>
                        {sidebarOpen && (
                            <div>
                                <span className="font-bold text-lg">Axiom</span>
                                <span className="text-xs text-purple-500 ml-1">
                                    Admin
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 py-6 flex flex-col gap-2 px-3">
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
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative",
                                    isActive
                                        ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-5 h-5",
                                        !sidebarOpen && "mx-auto"
                                    )}
                                />
                                {sidebarOpen && (
                                    <span className="font-medium">
                                        {item.label}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-border/50">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        {sidebarOpen ? (
                            "Collapse"
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
                    <div className="flex items-center gap-3">
                        <div className="md:hidden">
                            <Menu
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="cursor-pointer"
                            />
                        </div>
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <Shield className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-medium text-purple-500">
                                Admin Mode
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link
                            to="/dashboard"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Switch to User View
                        </Link>
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">
                                {user?.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Administrator
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
