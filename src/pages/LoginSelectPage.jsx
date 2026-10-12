import {ArrowUpRight} from "lucide-react";
import {Link} from "react-router-dom";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import Sculpture from "../components/brand/Sculpture";
import RoleAccess from "../components/brand/RoleAccess";
import DiscourseSections from "../components/brand/DiscourseSections";
import Footer from "../components/Footer";
import ThemeToggle from "../components/ui/ThemeToggle";
import Tape from "../components/brand/Tape";

export default function LoginSelectPage() {
    return (
        <div className="axiom-entry">
            <a className="axiom-skip" href="#access">Skip to sign in</a>
            <header className="axiom-entry-header axiom-container">
                <p className="axiom-eyebrow">SMVIT Debsoc<br />Competitive debate</p>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link to="/about" className="axiom-button axiom-button--outline">Discover AXIOM<ArrowUpRight size={16} aria-hidden="true" /></Link>
                </div>
            </header>
            <main id="main-content">
                <section className="axiom-poster" aria-labelledby="entry-title">
                    <div className="axiom-poster-grid axiom-container">
                        <div className="axiom-poster-brand">
                            <span className="axiom-sticker" aria-hidden="true">Debate</span>
                            <p className="axiom-eyebrow">The art of articulation.</p>
                            <Axiom40Logo variant="hero" className="axiom-poster-logo" />
                            <h1 id="entry-title" className="axiom-poster-heading">Ancient thought.<span>New <br className="sm:hidden" />arguments.</span></h1>
                            <p className="axiom-poster-note">A new expression of competitive debate.<br />Rooted in reason. Made for the next round.</p>
                        </div>
                        <p className="axiom-poster-index axiom-eyebrow">Articulation / Reason / Composure</p>
                        <div id="access" className="axiom-poster-access">
                            <RoleAccess />
                        </div>
                    </div>
                    <Sculpture eager className="axiom-poster-art" />
                </section>
                <Tape />
                <DiscourseSections />
            </main>
            <Footer />
        </div>
    );
}
