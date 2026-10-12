import Sculpture from "./Sculpture";
import {Link} from "react-router-dom";

export default function AuthFrame({registration = false, showModeSwitcher = false, children}) {
    return (
        <section className="axiom-auth-grid axiom-container">
            <div className="axiom-auth-title">
                <p className="axiom-eyebrow">AXIOM 4.0 / {registration ? "Join the discourse" : "Welcome back"}</p>
                <h1>{registration ? <>Take your place.<br />Make your case.</> : <>Your voice.<br />Your arena.</>}</h1>
                <p className="text-muted-foreground max-w-sm">{registration ? "Create your account, complete your profile, and step into the tournament." : "Sign in to continue to your debates, rounds and results."}</p>
                {registration && <ol className="axiom-auth-steps" aria-label="Registration steps">
                    <li aria-current="step"><span>1</span><div><strong>Account</strong><small>Email or Google</small></div></li>
                    <li><span>2</span><div><strong>Profile</strong><small>Your participant details</small></div></li>
                    <li><span>3</span><div><strong>Event</strong><small>Join the tournament</small></div></li>
                </ol>}
                <div className="axiom-registration-art"><Sculpture figure={registration ? "yakshi" : "ganga"} /><span>Clarity<br />under pressure.</span></div>
            </div>
            <div className="axiom-auth-card">
                {showModeSwitcher && <nav className="axiom-auth-mode-switch" aria-label="Account access">
                    {registration
                        ? <><Link to="/sign-in">Sign in</Link><span aria-current="page">Create account</span></>
                        : <><span aria-current="page">Sign in</span><Link to="/sign-up">Create account</Link></>}
                </nav>}
                {children}
            </div>
        </section>
    );
}
