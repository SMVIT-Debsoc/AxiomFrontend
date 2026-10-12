import {Link} from "react-router-dom";
import {GoogleAuthButton} from "../../auth/client.jsx";

export default function RoleAccess() {
    return (
        <div className="axiom-participant-access">
            <p className="axiom-eyebrow">Participant access</p>
            <h2>Enter the arena.</h2>
            <p className="axiom-participant-access-copy">Create your participant profile once. We’ll take you straight to the active AXIOM event.</p>
            <GoogleAuthButton landing />
            <div className="axiom-entry-email-actions">
                <Link className="axiom-button axiom-button--green" to="/sign-in">Sign in</Link>
                <Link className="axiom-button axiom-button--outline" to="/sign-up">Create account</Link>
            </div>
            <p className="axiom-participant-access-note">New here? Complete your profile and we’ll enroll you in the event.</p>
        </div>
    );
}
