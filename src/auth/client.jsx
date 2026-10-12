/* eslint-disable react-refresh/only-export-components */
import {useCallback, useMemo, useState} from "react";
import {createAuthClient} from "better-auth/react";
import {cloneElement, isValidElement} from "react";
import {Link, Navigate, useNavigate} from "react-router-dom";
import PasswordInput from "../components/ui/PasswordInput";

const defaultApiUrl = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? `http://${window.location.hostname}:3000/api`
  : "/api";
const apiUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const clientOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
const authBaseURL = `${new URL(apiUrl, clientOrigin).origin}/api/auth`;

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  basePath: "/api/auth",
});

function useSessionUser() {
  const state = authClient.useSession();
  const raw = state.data?.user;
  const user = useMemo(() => {
    if (!raw) return null;
    const [firstName = "", ...rest] = (raw.name || "").trim().split(/\s+/);
    return {
      ...raw,
      id: raw.id,
      firstName,
      lastName: rest.join(" "),
      fullName: raw.name || "",
      imageUrl: raw.image || null,
      primaryEmailAddress: {emailAddress: raw.email},
      emailAddresses: [{emailAddress: raw.email}],
      primaryPhoneNumber: null,
      phoneNumbers: [],
      publicMetadata: {},
      update: async (patch) => {
        const name = [patch.firstName, patch.lastName].filter(Boolean).join(" ");
        const result = await authClient.updateUser({name});
        if (result.error) throw new Error(result.error.message || "Profile update failed");
      },
    };
  }, [raw]);
  return {state,user};
}

export function useAuth() {
  const {state,user} = useSessionUser();
  const signOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message || "Sign out failed");
    window.location.assign("/");
  }, []);
  return useMemo(() => ({
    isLoaded: !state.isPending,
    isSignedIn: Boolean(user),
    userId: user?.id || null,
    // Better Auth uses its HTTP-only session cookie. No client bearer token is issued.
    getToken: async () => null,
    signOut,
  }), [state.isPending,user,signOut]);
}

export function useUser() {
  const {state,user} = useSessionUser();
  return useMemo(() => ({isLoaded: !state.isPending, isSignedIn: Boolean(user), user}), [state.isPending,user]);
}

export function UserButton() {
  const {user} = useSessionUser();
  const {signOut} = useAuth();
  if (!user) return null;
  return <div className="flex items-center gap-3"><span className="max-w-48 truncate text-sm">{user.email}</span><button type="button" onClick={signOut} className="text-sm underline underline-offset-4">Sign out</button></div>;
}

export function AuthProvider({children}) {
  authClient.useSession();
  return children;
}

function AuthForm({registration = false}) {
  const navigate = useNavigate();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [name,setName] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = registration
        ? await authClient.signUp.email({name:name.trim(),email:email.trim(),password,callbackURL:"/auth-redirect"})
        : await authClient.signIn.email({email:email.trim(),password,callbackURL:"/auth-redirect"});
      if (result.error) throw new Error(result.error.message || "Authentication failed");
      if (registration && result.data?.user && !result.data?.token) {
        setError("Check your email to verify your new account before signing in.");
        return;
      }
      navigate("/auth-redirect",{replace:true});
    } catch (failure) {
      setError(failure.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md p-2 text-card-foreground">
      {registration && <><label htmlFor="auth-name" className="mb-1 block text-xs font-semibold">Full name</label><input id="auth-name" autoComplete="name" required value={name} onChange={event=>setName(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" /></>}
      <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold">Email</label>
      <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" />
      <label htmlFor="auth-password" className="mb-1 block text-xs font-semibold">Password</label>
      <PasswordInput id="auth-password" required minLength={10} autoComplete={registration ? "new-password" : "current-password"} value={password} onChange={event=>setPassword(event.target.value)} className="mb-4 w-full rounded-lg border-2 border-[var(--nb-line)] bg-background px-3 py-2" />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="w-full bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? (registration ? "Creating account…" : "Signing in…") : (registration ? "Create account" : "Sign in")}
      </button>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {registration ? <>Already registered? <Link className="underline underline-offset-4" to="/sign-in">Sign in</Link></> : <><Link className="underline underline-offset-4" to="/forgot-password">Forgot password?</Link><span className="mx-2" aria-hidden="true">·</span>New to AXIOM? <Link className="underline underline-offset-4" to="/get-started">Create an account</Link></>}
      </p>
    </form>
  );
}

export function SignIn() { return <AuthForm />; }
export function SignUp() { return <AuthForm registration />; }
export function SignedIn({children}) { return useAuth().isSignedIn ? children : null; }
export function SignedOut({children}) { const {isLoaded,isSignedIn}=useAuth(); return isLoaded && !isSignedIn ? children : null; }
export function RedirectToSignIn() { return <Navigate to="/login-select" replace />; }
export function SignInButton({children}) {
  const click = () => window.location.assign("/sign-in");
  if (isValidElement(children)) return cloneElement(children, {onClick: (event) => { children.props.onClick?.(event); if (!event.defaultPrevented) click(); }});
  return <button type="button" onClick={click}>{children}</button>;
}
