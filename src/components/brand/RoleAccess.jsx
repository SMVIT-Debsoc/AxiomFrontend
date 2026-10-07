import {ArrowRight, ArrowLeft, Loader2} from "lucide-react";
import {Link} from "react-router-dom";
import PasswordInput from "../ui/PasswordInput";

export default function RoleAccess({registration = false, showSecretKeyInput, secretKey, setSecretKey, error, loading = false, onRoleSelect, onAdminContinue, onBack}) {
    return (
        <div>
            <p className="axiom-eyebrow">{showSecretKeyInput ? "Restricted access / Organizers" : "Your next argument starts here"}</p>
            <h2>{showSecretKeyInput ? "Admin access" : registration ? "Choose your role." : "Enter the arena."}</h2>
            {showSecretKeyInput ? (
                <form onSubmit={(event) => { event.preventDefault(); onAdminContinue(); }}>
                    <label htmlFor="admin-key" className="axiom-eyebrow">Admin secret key</label>
                    <PasswordInput id="admin-key" autoComplete="off" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} className="axiom-access-input" aria-invalid={!!error} aria-describedby={error ? "admin-key-error" : "admin-key-help"} autoFocus />
                    <p id="admin-key-help" className="text-xs mb-3">Use the access key provided by your organizers.</p>
                    {error && <p id="admin-key-error" className="axiom-access-error" role="alert">{error}</p>}
                    <button className="axiom-button w-full" disabled={loading || (!registration && !secretKey.trim())} type="submit">
                        {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Validating…</> : <>{registration ? "Continue to registration" : "Continue to sign in"}<ArrowRight size={18} aria-hidden="true" /></>}
                    </button>
                    <button type="button" className="axiom-access-back mt-3" onClick={onBack}><ArrowLeft className="inline mr-2" size={14} aria-hidden="true" />Back to role selection</button>
                </form>
            ) : (
                <div>
                    <button className="axiom-role-button" onClick={() => onRoleSelect("user")}><span className="axiom-eyebrow" aria-hidden="true">01</span><div><strong>{registration ? "I’m a debater" : "Sign in as Debater"}</strong><small>{registration ? "Participate in debates and tournaments" : "Your debates, rounds and results"}</small></div><ArrowRight size={20} aria-hidden="true" /></button>
                    <button className="axiom-role-button" onClick={() => onRoleSelect("admin")}><span className="axiom-eyebrow" aria-hidden="true">02</span><div><strong>{registration ? "I’m an admin" : "Sign in as Admin"}</strong><small>Manage events, rounds and participants</small></div><ArrowRight size={20} aria-hidden="true" /></button>
                </div>
            )}
            <p className="axiom-access-footer mt-4">{registration ? "Already have an account? " : "New to AXIOM? "}<Link to={registration ? "/login-select" : "/get-started"}>{registration ? "Sign in" : "Get started"}</Link></p>
        </div>
    );
}
