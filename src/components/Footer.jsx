import {Link} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import Axiom40Logo from "./brand/Axiom40Logo";

export default function Footer() {
    return (
        <footer className="axiom-footer">
            <div className="axiom-container">
                <div className="axiom-footer-top">
                    <div><Link to="/" aria-label="AXIOM 4.0 home"><Axiom40Logo variant="footer" className="text-axiom-light" /></Link><p className="axiom-eyebrow mt-5">SMVIT Debsoc / Debate</p><p className="mt-4 max-w-sm text-sm">The art of articulation.<br />A considered arena for competitive debate.</p></div>
                    <div><h2 className="axiom-eyebrow mb-4">The arena</h2><ul><li><Link to="/about">About AXIOM</Link></li><li><Link to="/dashboard/events">Tournaments</Link></li><li><Link to="/">Register with Google</Link></li></ul></div>
                    <div><h2 className="axiom-eyebrow mb-4">Colophon</h2><p className="text-sm">Indian deity sculptures: Shiva Mahadeva, Shiva as Lord of Music, Nataraja, Vishnu, Surya, Ganesha and Hanuman.<br />The Cleveland Museum of Art.<br />CC0 Open Access.</p><a className="text-sm gap-2" href="https://www.clevelandart.org/art/1971.117" target="_blank" rel="noreferrer">View the museum records<ArrowUpRight size={14} aria-hidden="true" /></a><a className="text-sm gap-2" href="https://github.com/SMVIT-Debsoc/AxiomFrontend" target="_blank" rel="noreferrer">Source repository<ArrowUpRight size={14} aria-hidden="true" /></a></div>
                </div>
                <div className="axiom-footer-bottom"><p>© {new Date().getFullYear()} AXIOM 4.0. All rights reserved.</p><p>Powered by KlaerAI · Articulation / Reason / Composure</p></div>
            </div>
        </footer>
    );
}
