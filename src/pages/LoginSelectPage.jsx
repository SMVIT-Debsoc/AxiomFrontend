import Sculpture from "../components/brand/Sculpture";
import RoleAccess from "../components/brand/RoleAccess";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function LoginSelectPage() {
    return (
        <div className="axiom-entry">
            <a className="axiom-skip" href="#access">Skip to sign in</a>
            <header className="axiom-entry-header axiom-container">
                <p className="axiom-eyebrow">SMVIT Debsoc<br />Competitive debate</p>
                <ThemeToggle />
            </header>
            <main id="main-content">
                <section className="axiom-poster" aria-labelledby="entry-title">
                    <div className="axiom-poster-grid axiom-container">
                        <div className="axiom-poster-brand">
                            <p className="axiom-eyebrow">The art of articulation.</p>
                            <h1 id="entry-title" className="axiom-poster-heading">Your voice.<span>Your next <br className="sm:hidden" />round.</span></h1>
                            <p className="axiom-poster-note">Join the AXIOM event with one quick participant account.</p>
                        </div>
                        <p className="axiom-poster-index axiom-eyebrow">Articulation / Reason / Composure</p>
                        <div id="access" className="axiom-poster-access">
                            <RoleAccess />
                        </div>
                    </div>
                    <Sculpture eager className="axiom-poster-art" />
                </section>
            </main>
        </div>
    );
}
