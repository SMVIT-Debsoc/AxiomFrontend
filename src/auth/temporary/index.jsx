/* eslint-disable react-refresh/only-export-components */
/**
 * TEMPORARY stand-in for @clerk/clerk-react, backed by the Auth.js endpoints in api/auth.
 * vite.config.js aliases "@clerk/clerk-react" to this file while Clerk is not configured,
 * so no application code changes are needed to switch back: set VITE_CLERK_PUBLISHABLE_KEY.
 *
 * Limits: the AXIOM backend verifies Clerk tokens, so getToken() returns a placeholder and
 * authenticated API calls will be rejected by it. This gates the UI only.
 */
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {avatarDataUri} from "../../lib/avatar";

const AUTH_BASE = "/api/auth";
const PLACEHOLDER_TOKEN = "temporary-session";
const PROFILE_KEY = "axiom-temporary-profile";

const AuthContext = createContext(null);

function readProfile(id) {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")[id] || {};
  } catch {
    return {};
  }
}

function writeProfile(id, patch) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    /* ignore corrupt profile */
  }
  all[id] = {...all[id], ...patch};
  localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
  return all[id];
}

function buildUser(sessionUser, profileOverride, onUpdate) {
  const email = sessionUser.email;
  const profile = {...readProfile(sessionUser.id), ...profileOverride};
  const firstName = profile.firstName ?? sessionUser.name ?? "";
  const lastName = profile.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const role = sessionUser.role;
  return {
    id: sessionUser.id,
    firstName,
    lastName,
    fullName,
    imageUrl: avatarDataUri(email),
    primaryEmailAddress: {emailAddress: email},
    emailAddresses: [{emailAddress: email}],
    primaryPhoneNumber: null,
    phoneNumbers: [],
    externalAccounts: [],
    createdAt: null,
    publicMetadata: {role},
    unsafeMetadata: {role: role === "ADMIN" ? "admin" : "user"},
    update: async (patch) => {
      writeProfile(sessionUser.id, patch);
      onUpdate();
    },
  };
}

async function csrfToken() {
  const response = await fetch(`${AUTH_BASE}/csrf`, {credentials: "same-origin"});
  const body = response.ok ? await response.json().catch(() => null) : null;
  if (!body?.csrfToken) throw new Error("Temporary sign-in is unavailable. Check AUTH_SECRET on the server.");
  return body.csrfToken;
}

export function ClerkProvider({children, afterSignOutUrl = "/"}) {
  const [state, setState] = useState({loaded: false, session: null, revision: 0});

  const refresh = useCallback(async () => {
    let session = null;
    try {
      const response = await fetch(`${AUTH_BASE}/session`, {credentials: "same-origin"});
      const body = response.ok ? await response.json() : null;
      session = body?.user ? body : null;
    } catch {
      session = null;
    }
    setState((prev) => ({loaded: true, session, revision: prev.revision + 1}));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email, passcode) => {
      const token = await csrfToken();
      const response = await fetch(`${AUTH_BASE}/callback/credentials`, {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1"},
        body: new URLSearchParams({csrfToken: token, email, passcode, callbackUrl: "/auth-redirect"}),
      });
      const {url} = await response.json().catch(() => ({}));
      await refresh();
      if (!response.ok || !url || new URL(url, window.location.origin).searchParams.has("error")) {
        throw new Error("That email and passcode were not accepted.");
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    const token = await csrfToken();
    await fetch(`${AUTH_BASE}/signout`, {
      method: "POST",
      credentials: "same-origin",
      headers: {"Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1"},
      body: new URLSearchParams({csrfToken: token, callbackUrl: afterSignOutUrl}),
    });
    await refresh();
    window.location.replace(afterSignOutUrl);
  }, [afterSignOutUrl, refresh]);

  const value = useMemo(() => {
    const sessionUser = state.session?.user;
    return {
      loaded: state.loaded,
      user: sessionUser ? buildUser(sessionUser, null, () => setState((prev) => ({...prev, revision: prev.revision + 1}))) : null,
      signIn,
      signOut,
    };
    // revision forces a rebuilt user object after profile edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded, state.session, state.revision, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Temporary auth hooks must be used inside <ClerkProvider>.");
  return value;
}

export function useAuth() {
  const {loaded, user, signOut} = useAuthContext();
  const getToken = useCallback(async () => (user ? PLACEHOLDER_TOKEN : null), [user]);
  return useMemo(() => ({isLoaded: loaded, isSignedIn: Boolean(user), userId: user?.id ?? null, getToken, signOut}), [loaded, user, getToken, signOut]);
}

export function useUser() {
  const {loaded, user} = useAuthContext();
  return useMemo(() => ({isLoaded: loaded, isSignedIn: Boolean(user), user}), [loaded, user]);
}

export function useClerk() {
  const {user, signOut} = useAuthContext();
  return useMemo(() => ({user, signOut, openSignIn: () => window.location.assign("/sign-in")}), [user, signOut]);
}

export function SignedIn({children}) {
  return useAuth().isSignedIn ? children : null;
}

export function SignedOut({children}) {
  const {isLoaded, isSignedIn} = useAuth();
  return isLoaded && !isSignedIn ? children : null;
}

export function RedirectToSignIn() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/sign-in", {replace: true});
  }, [navigate]);
  return null;
}

export function SignInButton({children}) {
  const navigate = useNavigate();
  return <span onClick={() => navigate("/sign-in")}>{children}</span>;
}

export function UserButton() {
  const {user, signOut} = useAuthContext();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        className="h-9 w-9 overflow-hidden rounded-full border border-border"
      >
        <img src={user.imageUrl} alt="" className="h-full w-full" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 border border-border bg-card p-3 text-sm shadow-lg">
          <p className="truncate font-semibold text-foreground">{user.primaryEmailAddress.emailAddress}</p>
          <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Temporary session / {user.publicMetadata.role === "ADMIN" ? "Admin" : "Participant"}</p>
          <button role="menuitem" type="button" onClick={signOut} className="w-full border border-border px-3 py-2 text-left hover:bg-muted">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SignIn() {
  const {signIn} = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, passcode);
      navigate("/auth-redirect", {replace: true});
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-6 text-card-foreground">
      <p className="axiom-eyebrow mb-2 text-xs uppercase tracking-widest text-muted-foreground">Temporary sign-in</p>
      <h2 className="mb-1 font-heading text-2xl font-bold">Enter your passcode</h2>
      <p className="mb-5 text-sm text-muted-foreground">Preview access while account sign-in is being set up. Backend data is not available in this mode.</p>
      <label htmlFor="temp-email" className="mb-1 block text-xs font-semibold">Email</label>
      <input id="temp-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 w-full border border-border bg-background px-3 py-2" />
      <label htmlFor="temp-passcode" className="mb-1 block text-xs font-semibold">Passcode</label>
      <input id="temp-passcode" type="password" required autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} className="mb-4 w-full border border-border bg-background px-3 py-2" />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="w-full bg-primary px-4 py-2.5 font-heading font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export function SignUp() {
  return <SignIn />;
}
