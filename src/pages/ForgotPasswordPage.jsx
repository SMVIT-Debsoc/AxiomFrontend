import {useState} from "react";
import {Link} from "react-router-dom";
import {authClient} from "../auth/client.jsx";
import AuthFrame from "../components/brand/AuthFrame";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true); setError("");
        try {
            const result = await authClient.requestPasswordReset({email: email.trim(), redirectTo: `${window.location.origin}/reset-password`});
            if (result.error) throw new Error(result.error.message || "Password reset could not be requested.");
            setSent(true);
        } catch (failure) {
            setError(failure.message || "Password reset could not be requested.");
        } finally { setBusy(false); }
    };
    return <AuthFrame>
        <form onSubmit={submit} className="w-full max-w-md p-2 text-card-foreground">
            <h1 className="mb-2 font-heading text-2xl font-bold">Reset your password</h1>
            <p className="mb-5 text-sm text-muted-foreground">Enter your account email and we’ll send a password reset link if the account exists.</p>
            <label htmlFor="reset-email" className="mb-1 block text-xs font-semibold">Email</label>
            <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" />
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            {sent && <p role="status" className="mb-4 text-sm">If an account exists for that email, a reset link has been sent.</p>}
            <button type="submit" disabled={busy} className="w-full bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
            <p className="mt-4 text-center text-sm"><Link className="underline underline-offset-4" to="/sign-in">Back to sign in</Link></p>
        </form>
    </AuthFrame>;
}
