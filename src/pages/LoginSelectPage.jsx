import {useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import {AdminApi} from "../services/api";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import Sculpture from "../components/brand/Sculpture";
import RoleAccess from "../components/brand/RoleAccess";
import DiscourseSections from "../components/brand/DiscourseSections";
import Footer from "../components/Footer";
import ThemeToggle from "../components/ui/ThemeToggle";
import Tape from "../components/brand/Tape";

export default function LoginSelectPage() {
    const navigate = useNavigate();
    const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);
    const [secretKey, setSecretKey] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRoleSelect = (role) => {
        setError("");

        if (role === "admin") {
            setShowSecretKeyInput(true);
        } else {
            // Navigate to user sign-in
            navigate("/sign-in?role=user");
        }
    };

    const handleAdminContinue = async () => {
        if (!secretKey.trim()) {
            setError("Please enter the admin secret key");
            return;
        }

        setLoading(true);
        setError("");

        try {
            // Validate the secret key BEFORE allowing sign-in
            const response = await AdminApi.validateKey(secretKey);

            if (response.success && response.valid) {
                // Key is valid, store and proceed to sign-in
                localStorage.setItem("adminSecretKey", secretKey);
                localStorage.setItem("pendingRole", "admin");
                navigate("/sign-in?role=admin");
            } else {
                setError("Invalid admin secret key. Access denied.");
            }
        } catch {
            setError("Invalid admin secret key. Access denied.");
        } finally {
            setLoading(false);
        }
    };

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
                            <RoleAccess
                                showSecretKeyInput={showSecretKeyInput}
                                secretKey={secretKey}
                                setSecretKey={setSecretKey}
                                error={error}
                                loading={loading}
                                onRoleSelect={handleRoleSelect}
                                onAdminContinue={handleAdminContinue}
                                onBack={() => { setShowSecretKeyInput(false); setSecretKey(""); setError(""); }}
                            />
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
