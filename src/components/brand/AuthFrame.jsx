import Sculpture from "./Sculpture";

export default function AuthFrame({registration = false, children}) {
    return (
        <section className="axiom-auth-grid axiom-container">
            <div className="axiom-auth-title"><p className="axiom-eyebrow">AXIOM 4.0 / {registration ? "Join the discourse" : "Welcome back"}</p><h1>{registration ? <>Take your place.<br />Make your case.</> : <>Your voice.<br />Your arena.</>}</h1><p className="text-muted-foreground max-w-sm">{registration ? "Create your account to enter the tournament workspace." : "Sign in to access your debates, rounds and results."}</p><div className="axiom-registration-art"><Sculpture /><span>Clarity<br />under pressure.</span></div></div>
            <div className="axiom-auth-card">{children}</div>
        </section>
    );
}
