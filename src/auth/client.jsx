/* eslint-disable react-refresh/only-export-components */
import {createContext, useContext, useState, useEffect, useMemo} from "react";
import {Navigate} from "react-router-dom";
import {
  ClerkProvider,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  UserButton as ClerkUserButton,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
  useSignIn as useClerkSignIn,
  RedirectToSignIn as ClerkRedirectToSignIn,
  AuthenticateWithRedirectCallback as ClerkAuthenticateWithRedirectCallback
} from "@clerk/clerk-react";

export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const isMockAuth = import.meta.env.VITE_AUTH_MOCK === "true";
export const googleAuthEnabled = Boolean(clerkPublishableKey) || isMockAuth;

const MockAuthContext = createContext(null);

function getFixtureState() {
  if (typeof window === "undefined") return { signedIn: false, user: null };
  try {
    const stored = sessionStorage.getItem("__fixture_auth__");
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore sessionStorage read errors in restricted environments
  }
  if (window.__FIXTURE_AUTH__) return window.__FIXTURE_AUTH__;
  return { signedIn: false, user: null };
}

function MockAuthProvider({ children }) {
  const [state, setState] = useState(getFixtureState);

  useEffect(() => {
    const handleUpdate = () => {
      setState(getFixtureState());
    };
    window.addEventListener("__fixture_auth_update__", handleUpdate);
    return () => window.removeEventListener("__fixture_auth_update__", handleUpdate);
  }, []);

  const value = useMemo(() => {
    const signedIn = Boolean(state.signedIn);
    const defaultUser = {
      id: "fixture-user",
      fullName: "Audit Participant",
      firstName: "Audit",
      lastName: "Participant",
      primaryEmailAddress: { emailAddress: "audit@example.invalid" },
      imageUrl: null,
    };
    const baseUser = state.user || defaultUser;
    const user = signedIn
      ? {
          ...baseUser,
          update: typeof baseUser.update === "function" ? baseUser.update : async () => baseUser,
        }
      : null;

    const signOut = async () => {
      const next = { signedIn: false, user: null };
      if (typeof window !== "undefined") {
        window.__FIXTURE_AUTH__ = next;
        try {
          sessionStorage.setItem("__fixture_auth__", JSON.stringify(next));
        } catch {
          // Ignore sessionStorage write errors in restricted environments
        }
      }
      setState(next);
      window.location.href = "/";
    };

    const signIn = {
      authenticateWithRedirect: async ({ redirectUrlComplete }) => {
        if (signedIn) {
          const err = new Error("Session already exists");
          err.errors = [{ code: "session_exists", message: "You're already signed in." }];
          throw err;
        }
        const nextUser = state.user || defaultUser;
        const next = { signedIn: true, user: nextUser };
        if (typeof window !== "undefined") {
          window.__FIXTURE_AUTH__ = next;
          try {
            sessionStorage.setItem("__fixture_auth__", JSON.stringify(next));
          } catch {
            // Ignore sessionStorage write errors in restricted environments
          }
          window.location.href = redirectUrlComplete || "/auth-redirect";
        }
      },
    };

    return {
      isLoaded: true,
      isSignedIn: signedIn,
      userId: user?.id || null,
      sessionId: signedIn ? "fixture-session" : null,
      user,
      getToken: async () => (signedIn ? "fixture-auth-token" : null),
      signOut,
      signIn,
    };
  }, [state]);

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}

function useMockAuth() {
  const ctx = useContext(MockAuthContext);
  return {
    isLoaded: ctx?.isLoaded ?? true,
    isSignedIn: ctx?.isSignedIn ?? false,
    userId: ctx?.userId ?? null,
    sessionId: ctx?.sessionId ?? null,
    getToken: ctx?.getToken ?? (async () => null),
    signOut: ctx?.signOut ?? (async () => {}),
  };
}

function useMockUser() {
  const ctx = useContext(MockAuthContext);
  return {
    isLoaded: ctx?.isLoaded ?? true,
    isSignedIn: ctx?.isSignedIn ?? false,
    user: ctx?.user ?? null,
  };
}

function useMockSignIn() {
  const ctx = useContext(MockAuthContext);
  return {
    isLoaded: ctx?.isLoaded ?? true,
    signIn: ctx?.signIn,
  };
}

function MockSignedIn({ children }) {
  const { isSignedIn } = useMockAuth();
  return isSignedIn ? children : null;
}

function MockSignedOut({ children }) {
  const { isSignedIn } = useMockAuth();
  return !isSignedIn ? children : null;
}

function MockUserButton() {
  const { signOut } = useMockAuth();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={signOut}
        className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

function MockSignInButton({ children, ...props }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.__FIXTURE_AUTH__ = { signedIn: true };
        window.location.href = "/auth-redirect";
      }}
      {...props}
    >
      {children || "Sign in"}
    </button>
  );
}

function MockRedirectToSignIn() {
  return <Navigate to="/" replace />;
}

function MockAuthenticateWithRedirectCallback(props) {
  return <Navigate to={props.signInForceRedirectUrl || "/auth-redirect"} replace />;
}

export const useAuth = isMockAuth ? useMockAuth : useClerkAuth;
export const useUser = isMockAuth ? useMockUser : useClerkUser;
export const useSignIn = isMockAuth ? useMockSignIn : useClerkSignIn;
export const SignedIn = isMockAuth ? MockSignedIn : ClerkSignedIn;
export const SignedOut = isMockAuth ? MockSignedOut : ClerkSignedOut;
export const SignInButton = isMockAuth ? MockSignInButton : ClerkSignInButton;
export const UserButton = isMockAuth ? MockUserButton : ClerkUserButton;
export const RedirectToSignIn = isMockAuth ? MockRedirectToSignIn : ClerkRedirectToSignIn;
export const AuthenticateWithRedirectCallback = isMockAuth ? MockAuthenticateWithRedirectCallback : ClerkAuthenticateWithRedirectCallback;

/**
 * AuthProvider wraps the application with ClerkProvider.
 * If VITE_CLERK_PUBLISHABLE_KEY is not set, it renders a friendly setup guide.
 */
export function AuthProvider({children}) {
  if (isMockAuth) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }

  if (!clerkPublishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1D1E18] text-[#EAFBF5] p-6">
        <div className="max-w-md w-full bg-[#272922] border-2 border-[#B9F5D8] rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-[#B9F5D8] text-[#1D1E18] flex items-center justify-center font-bold text-xl mx-auto mb-4">
            !
          </div>
          <h2 className="text-xl font-extrabold mb-2 text-[#B9F5D8]">Clerk Setup Required</h2>
          <p className="text-sm text-[#A8B2A6] mb-5 leading-relaxed">
            Please add your free Clerk publishable key to your environment to activate authentication:
          </p>
          <div className="bg-[#1D1E18] p-3 rounded-xl border border-[#4A5646] font-mono text-xs text-[#EAFBF5] text-left overflow-x-auto mb-5 select-all">
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </div>
          <p className="text-xs text-[#A8B2A6]">
            Get your key from <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="underline text-[#B9F5D8]">dashboard.clerk.com</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}

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

export function isSessionExistsError(failure) {
  const errors = Array.isArray(failure?.errors) ? failure.errors : [];
  if (
    errors.some((err) => {
      const code = String(err?.code || "").toLowerCase();
      const msg = `${err?.message || ""} ${err?.longMessage || ""}`;
      return (
        code === "session_exists" ||
        code === "already_signed_in" ||
        code === "identifier_already_signed_in" ||
        /session.*already.*exists|already.*signed.*in|single.*session/i.test(msg)
      );
    })
  ) {
    return true;
  }
  return /session.*already.*exists|already.*signed.*in/i.test(String(failure?.message || ""));
}

export function GoogleAuthButton({variant = "default", label = "Register with Google", busyLabel = "Connecting to Google…"}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {isSignedIn, isLoaded: authLoaded} = useAuth();
  const {signIn, isLoaded} = useSignIn();
  const v = GOOGLE_VARIANTS[variant] || GOOGLE_VARIANTS.default;

  if (!clerkPublishableKey && !isMockAuth) {
    return (
      <p role="alert" className="rounded-xl border border-[#AAD2BA] bg-[#E6F8F1] px-4 py-3 text-sm font-medium text-[#3F5E45]">
        Sign-in is unavailable right now. Please set VITE_CLERK_PUBLISHABLE_KEY in .env.
      </p>
    );
  }

  const signInWithGoogle = async () => {
    try {
      sessionStorage.removeItem("adminAuthFlow");
      sessionStorage.removeItem("adminSecretKey");
    } catch {
      // Ignore sessionStorage errors in restricted environments
    }

    if (isSignedIn) {
      window.location.assign("/auth-redirect");
      return;
    }

    if (!isLoaded || !authLoaded || !signIn) return;
    setBusy(true);
    setError("");

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/auth-redirect",
      });
    } catch (failure) {
      if (isSessionExistsError(failure)) {
        window.location.assign("/auth-redirect");
        return;
      }
      console.error("Clerk Google OAuth initiation failed:", failure);
      setError(failure.errors?.[0]?.message || failure.message || "Google sign-in could not start.");
      setBusy(false);
    }
  };

  return (
    <div className={v.wrap}>
      <button
        type="button"
        className={v.button}
        onClick={signInWithGoogle}
        disabled={busy || (!isLoaded && !isSignedIn)}
        aria-busy={busy}
        data-google-cta={variant}
      >
        <span className={`grid shrink-0 place-items-center rounded-full bg-white ${v.icon}`}>
          <svg aria-hidden="true" viewBox="0 0 48 48" width={v.svg} height={v.svg} focusable="false">
            <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.8Z" />
            <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.7-3.6-11.3-8.5H6v5.2A20 20 0 0 0 24 44Z" />
            <path fill="#FBBC05" d="M12.7 27.7a12 12 0 0 1 0-7.4v-5.2H6a20 20 0 0 0 0 17.8l6.7-5.2Z" />
            <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 6 15.1l6.7 5.2c1.6-4.9 6-8.5 11.3-8.5Z" />
          </svg>
        </span>
        <span>{busy ? busyLabel : label}</span>
      </button>
      {error && <p className="mt-2 text-sm font-medium text-[#a51818]" role="alert">{error}</p>}
    </div>
  );
}
