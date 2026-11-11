/* eslint-disable react-refresh/only-export-components */
import {useState} from "react";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useUser,
  useSignIn,
  RedirectToSignIn
} from "@clerk/clerk-react";

export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
export const googleAuthEnabled = Boolean(clerkPublishableKey);

/**
 * AuthProvider wraps the application with ClerkProvider.
 * If VITE_CLERK_PUBLISHABLE_KEY is not set, it renders a friendly setup guide.
 */
export function AuthProvider({children}) {
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

export {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useUser,
  RedirectToSignIn
};

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {signIn, isLoaded} = useSignIn();
  const v = GOOGLE_VARIANTS[variant] || GOOGLE_VARIANTS.default;

  if (!clerkPublishableKey) {
    return (
      <p role="alert" className="rounded-xl border border-[#AAD2BA] bg-[#E6F8F1] px-4 py-3 text-sm font-medium text-[#3F5E45]">
        Sign-in is unavailable right now. Please set VITE_CLERK_PUBLISHABLE_KEY in .env.
      </p>
    );
  }

  const signInWithGoogle = async () => {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setError("");

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/auth-redirect",
        redirectUrlComplete: "/auth-redirect",
      });
    } catch (failure) {
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
        disabled={busy || !isLoaded}
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

export function AppleAuthButton({variant = "default", label = "Continue with Apple", busyLabel = "Connecting to Apple…"}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {signIn, isLoaded} = useSignIn();
  const v = GOOGLE_VARIANTS[variant] || GOOGLE_VARIANTS.default;

  if (!clerkPublishableKey) {
    return null;
  }

  const signInWithApple = async () => {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setError("");

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_apple",
        redirectUrl: "/auth-redirect",
        redirectUrlComplete: "/auth-redirect",
      });
    } catch (failure) {
      console.error("Clerk Apple OAuth initiation failed:", failure);
      setError(failure.errors?.[0]?.message || failure.message || "Apple sign-in could not start.");
      setBusy(false);
    }
  };

  return (
    <div className={v.wrap}>
      <button
        type="button"
        className={v.button}
        onClick={signInWithApple}
        disabled={busy || !isLoaded}
        aria-busy={busy}
        data-apple-cta={variant}
      >
        <span className={`grid shrink-0 place-items-center rounded-full bg-black text-white ${v.icon}`}>
          <svg aria-hidden="true" viewBox="0 0 170 170" width={v.svg} height={v.svg} fill="currentColor" focusable="false">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.77-11.64-14.19-5.55-8.8-9.84-18.7-12.87-29.72-3.03-11.01-4.55-21.73-4.55-32.16 0-14.12 3.5-25.79 10.51-34.99 7.01-9.2 15.93-13.92 26.76-14.15 4.8 0 10.15 1.33 16.06 3.98 5.91 2.65 9.77 4.04 11.58 4.18 1.45-.14 5.48-1.57 12.09-4.3 6.61-2.73 12.26-3.95 16.94-3.66 12.63.63 22.84 5.34 30.64 14.13-10.98 6.64-16.32 15.77-16.03 27.4.29 9.3 3.91 17.06 10.86 23.29 4.1 3.73 8.78 6.46 14.05 8.19-2.22 6.63-4.87 13.3-7.94 20.02zM119.22 31.98c0-7.25 2.59-13.91 7.76-19.98 5.17-6.07 11.65-9.85 19.44-11.35.15 1.25.22 2.37.22 3.37 0 7.37-2.75 14.28-8.26 20.73-5.51 6.45-12.23 10.13-20.16 11.04-.2-.93-.3-1.87-.3-2.81z" />
          </svg>
        </span>
        <span>{busy ? busyLabel : label}</span>
      </button>
      {error && <p className="mt-2 text-sm font-medium text-[#a51818]" role="alert">{error}</p>}
    </div>
  );
}
