import {useState, useEffect} from "react";
import {Link, useLocation} from "react-router-dom";
import {motion, AnimatePresence} from "framer-motion";
import {Menu, X, Rocket} from "lucide-react";
import {useAuth, UserButton} from "@clerk/clerk-react";
import {cn} from "../lib/utils";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const {isSignedIn, getToken} = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Check if user is admin (silent - 403 expected for non-admins)
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!isSignedIn) {
                setIsAdmin(false);
                return;
            }
            try {
                const token = await getToken();
                // Use direct fetch to avoid console error logging for expected 403
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
                    setIsAdmin(false);
                }
            } catch (e) {
                setIsAdmin(false);
            }
        };
        checkAdminStatus();
    }, [isSignedIn, getToken]);

    const navLinks = [
        {name: "Home", path: "/"},
        {name: "Tournaments", path: "/events"},
        {name: "About", path: "/about"},
    ];

    if (isSignedIn) {
        // Admin goes to /admin, regular users go to /dashboard
        navLinks.push({
            name: "Dashboard",
            path: isAdmin ? "/admin" : "/dashboard",
        });
    }

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
                scrolled
                    ? "bg-background/80 backdrop-blur-md border-border py-4"
                    : "bg-transparent py-6"
            )}
        >
            <div className="container mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors">
                        <Rocket className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        Axiom
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-primary",
                                location.pathname === link.path
                                    ? "text-white"
                                    : "text-muted-foreground"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {/* Auth Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    {isSignedIn ? (
                        <UserButton afterSignOutUrl="/" />
                    ) : (
                        <>
                            <Link
                                to="/login-select"
                                className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                to="/get-started"
                                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.7)]"
                            >
                                Get Started
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Toggle + User Button */}
                <div className="md:hidden flex items-center gap-4">
                    {isSignedIn && <UserButton afterSignOutUrl="/" />}
                    <button
                        className="text-foreground p-1"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label={isOpen ? "Close menu" : "Open menu"}
                    >
                        {isOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: "auto"}}
                        exit={{opacity: 0, height: 0}}
                        transition={{duration: 0.3, ease: "easeInOut"}}
                        className="md:hidden border-t border-border bg-background/95 backdrop-blur-md overflow-hidden"
                    >
                        <div className="container mx-auto px-6 py-6 flex flex-col gap-2">
                            {navLinks.map((link, index) => (
                                <motion.div
                                    key={link.path}
                                    initial={{opacity: 0, x: -20}}
                                    animate={{opacity: 1, x: 0}}
                                    transition={{
                                        delay: index * 0.05,
                                        duration: 0.3,
                                    }}
                                >
                                    <Link
                                        to={link.path}
                                        onClick={() => setIsOpen(false)}
                                        className="block text-lg font-medium text-foreground py-3 px-2 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </motion.div>
                            ))}
                            {!isSignedIn && (
                                <>
                                    <hr className="border-border my-2" />
                                    <motion.div
                                        initial={{opacity: 0, x: -20}}
                                        animate={{opacity: 1, x: 0}}
                                        transition={{
                                            delay: navLinks.length * 0.05,
                                            duration: 0.3,
                                        }}
                                    >
                                        <Link
                                            to="/login-select"
                                            onClick={() => setIsOpen(false)}
                                            className="block text-lg font-medium text-muted-foreground py-3 px-2 rounded-lg hover:bg-muted transition-colors"
                                        >
                                            Sign In
                                        </Link>
                                    </motion.div>
                                    <motion.div
                                        initial={{opacity: 0, x: -20}}
                                        animate={{opacity: 1, x: 0}}
                                        transition={{
                                            delay: (navLinks.length + 1) * 0.05,
                                            duration: 0.3,
                                        }}
                                    >
                                        <Link
                                            to="/get-started"
                                            onClick={() => setIsOpen(false)}
                                            className="block text-lg font-medium text-primary py-3 px-2 rounded-lg hover:bg-primary/10 transition-colors"
                                        >
                                            Get Started
                                        </Link>
                                    </motion.div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
