import {useState, useEffect, useRef} from "react";
import {Link, useLocation} from "react-router-dom";
import {Menu, X, ArrowUpRight} from "lucide-react";
import {useAuth, UserButton} from "@clerk/clerk-react";
import Axiom40Logo from "./brand/Axiom40Logo";

const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE_URL = isLocalhost ? import.meta.env.VITE_API_URL || "http://localhost:3000/api" : "/api";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const location = useLocation();
    const {isSignedIn, getToken} = useAuth();
    const toggleRef = useRef(null);

    useEffect(() => {
        let active = true;
        const checkAdminStatus = async () => {
            if (!isSignedIn) return;
            try {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/admin/me`, {headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"}});
                const data = response.ok ? await response.json() : null;
                if (active) setIsAdmin(!!(data?.success && data.admin));
            } catch { if (active) setIsAdmin(false); }
        };
        checkAdminStatus();
        return () => { active = false; };
    }, [isSignedIn, getToken]);

    useEffect(() => {
        if (!isOpen) return;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") { setIsOpen(false); toggleRef.current?.focus(); }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [isOpen]);

    const links = [{name: "Home", path: "/"}, {name: "Tournaments", path: "/dashboard/events"}, {name: "About", path: "/about"}];
    if (isSignedIn) links.push({name: "Workspace", path: isAdmin ? "/admin" : "/dashboard"});
    const renderLink = (link) => <Link key={link.path} to={link.path} className="axiom-nav-link" aria-current={location.pathname === link.path ? "page" : undefined} onClick={() => setIsOpen(false)}>{link.name}</Link>;

    return (
        <nav className="axiom-navbar" aria-label="Main navigation">
            <div className="axiom-container axiom-navbar-inner">
                <Link to="/" onClick={() => setIsOpen(false)} aria-label="AXIOM 4.0 home"><Axiom40Logo /></Link>
                <div className="hidden md:flex items-center gap-5">{links.map(renderLink)}</div>
                <div className="hidden md:flex items-center gap-4">{isSignedIn ? <UserButton afterSignOutUrl="/" /> : <><Link className="axiom-nav-link" to="/login-select">Sign in</Link><Link className="axiom-button axiom-button--green" to="/get-started">Get started<ArrowUpRight size={16} aria-hidden="true" /></Link></>}</div>
                <div className="md:hidden flex items-center gap-3">{isSignedIn && <UserButton afterSignOutUrl="/" />}<button ref={toggleRef} className="p-3" onClick={() => setIsOpen(!isOpen)} aria-label={isOpen ? "Close menu" : "Open menu"} aria-expanded={isOpen} aria-controls="mobile-navigation">{isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div>
            </div>
            {isOpen && <div id="mobile-navigation" className="axiom-container axiom-mobile-menu md:hidden">{links.map(renderLink)}{!isSignedIn && <><Link className="axiom-nav-link" to="/login-select" onClick={() => setIsOpen(false)}>Sign in</Link><Link className="axiom-button axiom-button--green" to="/get-started" onClick={() => setIsOpen(false)}>Get started<ArrowUpRight size={16} aria-hidden="true" /></Link></>}</div>}
        </nav>
    );
}
