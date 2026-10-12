/* eslint-disable react-refresh/only-export-components */
import {useCallback, useMemo, useState} from "react";
import {createAuthClient} from "better-auth/react";
import {cloneElement, isValidElement} from "react";
import {Link, Navigate, useNavigate, useSearchParams} from "react-router-dom";
import PasswordInput from "../components/ui/PasswordInput";
import {UserApi} from "../services/api";

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
  const [searchParams] = useSearchParams();
  const [email,setEmail] = useState(() => searchParams.get("email") || "");
  const [password,setPassword] = useState("");
  const [name,setName] = useState("");
  const [error,setError] = useState("");
  const [possibleTypo,setPossibleTypo] = useState(false);
  const [checkedEmail,setCheckedEmail] = useState("");
  const [busy,setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (registration && checkedEmail !== normalizedEmail) {
        const preflight = await UserApi.checkEmail(normalizedEmail);
        setCheckedEmail(normalizedEmail);
        if (preflight.possibleTypo) {
          setPossibleTypo(true);
          return;
        }
      }
      setPossibleTypo(false);
      const result = registration
        ? await authClient.signUp.email({name:name.trim(),email:normalizedEmail,password,callbackURL:"/auth-redirect"})
        : await authClient.signIn.email({email:normalizedEmail,password,callbackURL:"/auth-redirect"});
      if (result.error) {
        const details = `${result.error.code || ""} ${result.error.message || ""}`;
        if (registration && /already.?exists|already.?registered|email.*taken|user.*exists/i.test(details)) {
          navigate(`/sign-in?email=${encodeURIComponent(normalizedEmail)}&notice=account-exists`,{replace:true});
          return;
        }
        throw new Error(result.error.message || "Authentication failed");
      }
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
    <form onSubmit={submit} className="axiom-auth-form w-full max-w-md text-card-foreground" aria-labelledby="auth-form-title">
      <header className="axiom-auth-form-heading">
        <p className="axiom-eyebrow">Participant access</p>
        <h2 id="auth-form-title">{registration ? "Create your account" : "Sign in"}</h2>
        <p>{registration ? "Start with your email. We’ll guide you through the next steps." : "Pick up where you left off in the AXIOM arena."}</p>
      </header>
      {registration && <><label htmlFor="auth-name">Full name</label><input id="auth-name" autoComplete="name" required value={name} onChange={event=>setName(event.target.value)} /></>}
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);setPossibleTypo(false);setCheckedEmail("");setError("");}} />
      <label htmlFor="auth-password">Password</label>
      <PasswordInput id="auth-password" required minLength={10} autoComplete={registration ? "new-password" : "current-password"} value={password} onChange={event=>setPassword(event.target.value)} aria-describedby={registration ? "auth-password-hint" : undefined} />
      {registration && <p id="auth-password-hint" className="axiom-auth-hint">Use at least 10 characters.</p>}
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {possibleTypo && <p role="alert" className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">A registered email has a very similar spelling. Please check for a typo. If this address is correct, continue to create your account.</p>}
      <button type="submit" disabled={busy} className="axiom-auth-submit w-full bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? (registration ? "Checking email…" : "Signing in…") : (registration ? (possibleTypo ? "Continue with this email" : "Create account") : "Sign in")}
      </button>
      {registration
        ? <p className="axiom-auth-footnote">Already registered? <Link to="/sign-in">Sign in</Link></p>
        : <p className="axiom-auth-create-callout"><span>New to AXIOM?</span><Link to="/get-started">Create account <span aria-hidden="true">↗</span></Link></p>}
      {!registration && searchParams.get("notice") === "account-exists" && <p role="status" className="mt-3 text-center text-sm">An account may already use this email. Sign in or reset your password.</p>}
      {!registration && <p className="axiom-auth-footnote"><Link to="/forgot-password">Forgot password?</Link></p>}
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
