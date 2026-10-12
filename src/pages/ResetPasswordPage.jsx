import {useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import PasswordInput from "../components/ui/PasswordInput";
import AuthFrame from "../components/brand/AuthFrame";
import {authClient} from "../auth/client.jsx";

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get("token");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = async (event) => {
        event.preventDefault(); setError("");
        if (!token) return setError("This reset link is missing or expired. Request a new one.");
        if (password !== confirmation) return setError("Passwords do not match.");
        setBusy(true);
        try {
            const result = await authClient.resetPassword({newPassword: password, token});
            if (result.error) throw new Error(result.error.message || "Password could not be reset.");
            setDone(true);
        } catch (failure) { setError(failure.message || "Password could not be reset."); }
        finally { setBusy(false); }
    };
    return <AuthFrame>
        <form onSubmit={submit} className="w-full max-w-md p-2 text-card-foreground">
            <h1 className="mb-2 font-heading text-2xl font-bold">Choose a new password</h1>
            <label htmlFor="reset-new-password" className="mb-1 block text-xs font-semibold">New password</label>
            <PasswordInput id="reset-new-password" required minLength={10} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" />
            <label htmlFor="reset-confirm-password" className="mb-1 block text-xs font-semibold">Confirm password</label>
            <PasswordInput id="reset-confirm-password" required minLength={10} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" />
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            {done ? <p role="status" className="mb-4 text-sm">Password updated. <Link className="underline" to="/sign-in">Sign in</Link></p> : <button type="submit" disabled={busy} className="w-full bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Update password"}</button>}
        </form>
    </AuthFrame>;
}
