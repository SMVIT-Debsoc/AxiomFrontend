import {useState, useEffect} from "react";
import {Outlet, Link, useLocation} from "react-router-dom";
import {
    UserButton,
    useUser,
    RedirectToSignIn,
    useAuth,
} from "@clerk/clerk-react";
import {SidebarRail, MobileTabs} from "../components/layout/SidebarRail";
import ThemeToggle from "../components/ui/ThemeToggle";
import Axiom40Logo from "../components/brand/Axiom40Logo";

const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
);
const API_BASE_URL = isLocalhost
    ? import.meta.env.VITE_API_URL || "http://localhost:3000/api"
    : "/api";

const sidebarItems = [
    {icon: "LayoutIcon", label: "Overview", path: "/dashboard"},
    {icon: "EventsIcon", label: "Events", path: "/dashboard/events"},
    {icon: "PortraitIcon", label: "Profile", path: "/dashboard/profile"},
];

export default function DashboardLayout() {
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
            icon: "AppsIcon",
            label: "Admin Panel",
            path: "/admin",
        });
    }
    const navItems = currentSidebarItems.map((item) => ({
        ...item,
        active: location.pathname === item.path,
    }));

    return (
        <div className="min-h-screen bg-background text-foreground flex axiom-workspace">
            <SidebarRail items={navItems} />

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 axiom-with-dock">
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
                        <ThemeToggle />

                        <div className="axiom-userchip">
                            <div className="hidden sm:block min-w-0 text-right">
                                <p className="truncate text-sm font-heading font-semibold leading-tight">
                                    {user.fullName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground font-sans">
                                    {user.primaryEmailAddress?.emailAddress}
                                </p>
                            </div>
                            <UserButton />
                        </div>
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-24 md:pb-8 scroll-smooth min-w-0">
                    <div key={location.pathname} className="axiom-rise"><Outlet /></div>
                </main>

                <MobileTabs items={navItems.slice(0, 5).map((item) => ({...item, label: item.label === "Admin Panel" ? "Admin" : item.label}))} />
            </div>
        </div>
    );
}
