import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { UserButton, useUser, SignedIn, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import {
    LayoutDashboard,
    Calendar,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Trophy,
    ShieldCheck
} from 'lucide-react';

import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminApi } from '../services/api';


const sidebarItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Users, label: 'My Profile', path: '/dashboard/profile' },
    { icon: Trophy, label: 'Leaderboard', path: '/dashboard/leaderboard' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken } = useAuth();

    // Check admin status to show admin link
    useEffect(() => {
        const checkAdmin = async () => {
            if (isSignedIn) {
                try {
                    const token = await getToken();
                    const response = await AdminApi.getProfile(token);
                    setIsAdmin(response.success && !!response.admin);
                } catch (e) {
                    setIsAdmin(false);
                }
            }
        };
        checkAdmin();
    }, [isSignedIn, getToken]);

    if (!isLoaded) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    if (!isSignedIn) {
        return <RedirectToSignIn />;
    }

    const currentSidebarItems = [...sidebarItems];
    if (isAdmin) {
        currentSidebarItems.push({ icon: ShieldCheck, label: 'Admin Panel', path: '/admin' });
    }


    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {!sidebarOpen && (
                    <div className="md:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setSidebarOpen(true)} />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={{ x: 0 }}
                animate={{ width: sidebarOpen ? 240 : 80 }}
                className="fixed md:relative z-30 h-screen border-r border-border bg-card/50 backdrop-blur-xl hidden md:flex flex-col"
            >
                <div className="h-16 flex items-center px-6 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                            A
                        </div>
                        {sidebarOpen && <span className="font-bold text-xl">Axiom</span>}
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
                                <Icon className={cn("w-5 h-5", !sidebarOpen && "mx-auto")} />
                                {sidebarOpen && <span className="font-medium">{item.label}</span>}

                                {/* Active Indicator Strip */}
                                {isActive && !sidebarOpen && (
                                    <motion.div layoutId="activeStrip" className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
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
                        {sidebarOpen ? "Collapse View" : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </motion.aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
                    <div className="md:hidden">
                        {/* Mobile Menu Trigger placeholder */}
                        <Menu onClick={() => setSidebarOpen(!sidebarOpen)} className="cursor-pointer" />
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
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
