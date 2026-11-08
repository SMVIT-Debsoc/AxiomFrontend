/* eslint-disable react-refresh/only-export-components */
import {useCallback, useMemo, useState} from "react";
import {createAuthClient} from "better-auth/react";
import {cloneElement, isValidElement} from "react";
import {Navigate} from "react-router-dom";

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

export const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

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

export function SignedIn({children}) { return useAuth().isSignedIn ? children : null; }
export function SignedOut({children}) { const {isLoaded,isSignedIn}=useAuth(); return isLoaded && !isSignedIn ? children : null; }
export function RedirectToSignIn() { return <Navigate to="/" replace />; }

const GOOGLE_VARIANTS = {
  // Large hero button on the dark-green panel, moss ring
  hero: {
    wrap: "w-full",
    button: "flex h-[68px] w-full items-center justify-center gap-3.5 rounded-[18px] bg-[#EAFBF5] px-5 text-[19px] font-extrabold text-[#1D1E18] shadow-[0_0_0_5px_#B9F5D8,0_16px_30px_rgba(0,0,0,.33)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9FE3C2] disabled:opacity-70 md:h-[72px] md:text-[21px]",
    icon: "h-[42px] w-[42px] border border-[#B8D5C5]",
    svg: 26,
  },
  // Compact pill in the header
  header: {
    wrap: "",
    button: "inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-[#1D1E18] py-0 pl-1.5 pr-4 text-sm font-bold text-[#EAFBF5] transition hover:shadow-[0_0_0_3px_#B9F5D8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9F5D8] disabled:opacity-70",
    icon: "h-8 w-8",
    svg: 18,
  },
  // Sticky bottom bar on phones
  bar: {
    wrap: "w-full",
    button: "flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-[#1D1E18] text-lg font-extrabold text-[#EAFBF5] shadow-[0_0_0_4px_#B9F5D8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9FE3C2] disabled:opacity-70",
    icon: "h-[38px] w-[38px]",
    svg: 22,
  },
  // On a dark jungle panel
  onDark: {
    wrap: "",
    button: "inline-flex min-h-[60px] items-center gap-3.5 rounded-[14px] bg-[#EAFBF5] px-6 text-lg font-bold text-[#1D1E18] transition hover:bg-white hover:shadow-[0_0_0_3px_#B9F5D8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9F5D8] disabled:opacity-70",
    icon: "h-9 w-9 border border-[#B8D5C5]",
    svg: 22,
  },
  // Default, used anywhere else
  default: {
    wrap: "w-full",
    button: "flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-[#1D1E18] px-5 text-base font-bold text-[#EAFBF5] shadow-[0_0_0_3px_#B9F5D8] transition hover:bg-[#4A5646] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9FE3C2] disabled:opacity-70",
    icon: "h-9 w-9",
    svg: 22,
  },
};

export function GoogleAuthButton({variant = "default", label = "Register with Google", busyLabel = "Connecting to Google…"}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const v = GOOGLE_VARIANTS[variant] || GOOGLE_VARIANTS.default;

  // Google is the only sign-in path, so the button is always rendered. When the
  // deployment has not enabled it (VITE_GOOGLE_AUTH_ENABLED !== "true") say so plainly.
  if (!googleAuthEnabled) {
    return <p role="alert" className="rounded-xl border border-[#AAD2BA] bg-[#E6F8F1] px-4 py-3 text-sm font-medium text-[#3F5E45]">Sign-in is unavailable right now. Please try again later or ask an organiser for help.</p>;
  }

  const signInWithGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/auth-redirect", window.location.origin).toString(),
      });
      if (result.error) throw new Error(result.error.message || "Google sign-in could not start.");
    } catch (failure) {
      setError(failure.message || "Google sign-in could not start. Please try again.");
      setBusy(false);
    }
  };

  return <div className={v.wrap}>
    <button type="button" className={v.button} onClick={signInWithGoogle} disabled={busy} aria-busy={busy} data-google-cta={variant}>
      <span className={`grid shrink-0 place-items-center rounded-full bg-white ${v.icon}`}>
        <svg aria-hidden="true" viewBox="0 0 48 48" width={v.svg} height={v.svg} focusable="false"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.7-3.6-11.3-8.5H6v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.7a12 12 0 0 1 0-7.4v-5.2H6a20 20 0 0 0 0 17.8l6.7-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 6 15.1l6.7 5.2c1.6-4.9 6-8.5 11.3-8.5Z"/></svg>
      </span>
      <span>{busy ? busyLabel : label}</span>
    </button>
    {error && <p className="mt-2 text-sm font-medium text-[#a51818]" role="alert">{error}</p>}
  </div>;
}

export function SignInButton({children}) {
  const click = () => window.location.assign("/");
  if (isValidElement(children)) return cloneElement(children, {onClick: (event) => { children.props.onClick?.(event); if (!event.defaultPrevented) click(); }});
  return <button type="button" onClick={click}>{children}</button>;
}
