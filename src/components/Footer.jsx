import {Link} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import Axiom40Logo from "./brand/Axiom40Logo";

export default function Footer() {
    return (
        <footer className="axiom-footer">
            <div className="axiom-container">
                <div className="axiom-footer-top">
                    <div><Link to="/" aria-label="AXIOM 4.0 home"><Axiom40Logo variant="footer" className="text-axiom-light" /></Link><p className="axiom-eyebrow mt-5">SMVIT Debsoc / Edition 04</p><p className="mt-4 max-w-sm text-sm">The art of articulation.<br />A considered arena for competitive debate.</p></div>
                    <div><h2 className="axiom-eyebrow mb-4">The arena</h2><ul><li><Link to="/about">About AXIOM</Link></li><li><Link to="/dashboard/events">Tournaments</Link></li><li><Link to="/get-started">Get started</Link></li><li><Link to="/login-select">Sign in</Link></li></ul></div>
                    <div><h2 className="axiom-eyebrow mb-4">Colophon</h2><p className="text-sm">Indian goddess sculptures: Mother Goddess, Vidyadevi, Yakshi, Ganga, Durga, Siddhalakshmi and the Chola goddess with a lotus.<br />The Cleveland Museum of Art.<br />CC0 Open Access.</p><a className="text-sm gap-2" href="https://www.clevelandart.org/art/1970.12" target="_blank" rel="noreferrer">View the museum records<ArrowUpRight size={14} aria-hidden="true" /></a><a className="text-sm gap-2" href="https://github.com/SMVIT-Debsoc/AxiomFrontend" target="_blank" rel="noreferrer">Source repository<ArrowUpRight size={14} aria-hidden="true" /></a></div>
                </div>
                <div className="axiom-footer-bottom"><p>© {new Date().getFullYear()} AXIOM 4.0. All rights reserved.</p><p>Powered by KlaerAI · Articulation / Reason / Composure</p></div>
            </div>
        </footer>
    );
}
