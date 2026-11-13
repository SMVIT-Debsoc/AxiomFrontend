import {Outlet, Link, useLocation} from "react-router-dom";
import {
    useUser,
    RedirectToSignIn,
} from "../auth/client.jsx";
import {SidebarRail, MobileTabs} from "../components/layout/SidebarRail";
import ThemeToggle from "../components/ui/ThemeToggle";
import AccountMenu from "../components/ui/AccountMenu";
import WorkspaceFooter from "../components/layout/WorkspaceFooter";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import LoadingIndicator from "../components/ui/LoadingIndicator";

const sidebarItems = [
    {icon: "LayoutIcon", label: "Overview", path: "/dashboard"},
    {icon: "EventsIcon", label: "Events", path: "/dashboard/events"},
    {icon: "PortraitIcon", label: "Profile", path: "/dashboard/profile"},
];

export default function DashboardLayout() {
    const location = useLocation();
    const {isLoaded, isSignedIn} = useUser();
    const isAdmin = typeof window !== "undefined" && sessionStorage.getItem("isAdminSession") === "true";

    if (!isLoaded) {
        return <LoadingIndicator fullScreen label="Opening your debate workspace" />;
    }

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
                <header className="h-16 bg-transparent flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
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

                        <AccountMenu />
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-24 md:pb-8 scroll-smooth min-w-0">
                    <div key={location.pathname} className="axiom-page-stack axiom-rise">
                        <div className="axiom-page-body"><Outlet /></div>
                        <WorkspaceFooter
                            line="Clarity under pressure."
                            links={[{to: "/dashboard", label: "Overview"}, {to: "/dashboard/events", label: "Tournaments"}, {to: "/dashboard/profile", label: "Profile"}]}
                        />
                    </div>
                </main>

                <MobileTabs items={navItems.slice(0, 5).map((item) => ({...item, label: item.label === "Admin Panel" ? "Admin" : item.label}))} />
            </div>
        </div>
    );
}
