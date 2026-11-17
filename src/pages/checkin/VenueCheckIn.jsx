import {useEffect, useRef, useState} from "react";
import {Link, useLocation, useParams, useSearchParams} from "react-router-dom";
import {CheckCircle2, Loader2, XCircle} from "lucide-react";
import {GoogleAuthButton, useAuth} from "../../auth/client.jsx";
import {OpsApi} from "../../services/api";
import {OnboardingGuard} from "../../components/OnboardingGuard";
import {ProfileCompletionGuard} from "../../components/ProfileCompletionGuard";
import {encodeReturnTo, RETURN_TO_KEY} from "../../lib/opsLinks";
import Axiom40Logo from "../../components/brand/Axiom40Logo";
import LoadingIndicator from "../../components/ui/LoadingIndicator";

// /checkin/:roundId?c=CODE — opened by scanning the venue QR on the Display or Desk.
// Signed out: remember this URL, sign in with Google, come back (ResumePendingReturn).
// Signed in: submits the code once and shows a big success / failure state.

const FAILURES = {
  INVALID_VENUE_CODE: {title: "This code expired", body: "Scan the screen again — the code changes every few seconds."},
  CHECKIN_CLOSED: {title: "Check-in is closed", body: "The check-in window for this round has ended. Go to the desk if you think this is wrong."},
  PARTICIPANT_ELIMINATED: {title: "You're not in this round", body: "You were not advanced into this round. Go to the desk if you think this is wrong."},
  CHECKIN_NOT_STARTED: {title: "Check-in hasn't opened", body: "Check-in for this round opens soon. Scan the screen again when it does."},
  NOT_ENROLLED: {title: "You're not registered", body: "This account isn't registered for this event. Sign in with the account you registered with, or go to the desk."},
  CHECKIN_NOT_CONFIGURED: {title: "Check-in isn't ready", body: "Check-in isn't set up for this round yet. Go to the desk."},
  RATE_LIMITED: {title: "Too many tries", body: "Wait a moment, then scan the screen again."},
};

function Frame({children}) {
  return (
    <main className="axiom-workspace flex min-h-dvh flex-col bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-foreground">
      <Link to="/dashboard" aria-label="AXIOM 4.0 home" className="mb-6 w-24"><Axiom40Logo variant="nav" className="!w-24" /></Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 text-center">{children}</div>
    </main>
  );
}

export default function VenueCheckIn() {
  const {isLoaded, isSignedIn} = useAuth();
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  const hasCode = Boolean(new URLSearchParams(location.search).get("c"));

  // Remember where to return after Google sign-in / profile completion.
  // CheckInSubmit clears it once the attempt has an answer.
  useEffect(() => {
    if (!isLoaded || !hasCode) return;
    const record = encodeReturnTo(path);
    try {
      if (record) window.localStorage.setItem(RETURN_TO_KEY, record);
    } catch { /* storage unavailable: the debater can scan again */ }
  }, [isLoaded, hasCode, path]);

  if (!isLoaded) return <LoadingIndicator fullScreen label="Opening check-in" />;

  if (!isSignedIn) {
    return (
      <Frame>
        <h1 className="font-display text-6xl leading-none text-primary">Check in</h1>
        <p className="m-0 text-lg text-muted-foreground">Sign in with the Google account you registered with. We'll bring you straight back here.</p>
        <div className="flex justify-center"><GoogleAuthButton label="Sign in with Google" /></div>
      </Frame>
    );
  }

  return (
    <ProfileCompletionGuard>
      <OnboardingGuard>
        <CheckInSubmit />
      </OnboardingGuard>
    </ProfileCompletionGuard>
  );
}

function CheckInSubmit() {
  const {roundId} = useParams();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("c") || "").trim();
  const {getToken} = useAuth();
  const [state, setState] = useState(() => (code ? {phase: "submitting"} : {phase: "input"}));
  const [typedCode, setTypedCode] = useState("");
  const attempted = useRef(null);

  const submit = async (overrideCode) => {
    const raw = overrideCode !== undefined ? overrideCode : code;
    const targetCode = (raw || "").toUpperCase().replace(/[\s-]/g, "");
    if (!targetCode) return;
    setState({phase: "submitting"});
    try {
      const token = await getToken();
      const response = await OpsApi.venueCheckIn(roundId, targetCode, token);
      setState({phase: "done", data: response?.data || response});
    } catch (failure) {
      // The backend re-confirms an existing check-in with a normal success; this
      // branch only tolerates servers that answer with an "already" code instead.
      if (failure?.code === "ALREADY_CHECKED_IN" || failure?.code === "ALREADY_PRESENT") {
        setState({phase: "done", data: failure.data});
        return;
      }
      setState({phase: "failed", code: failure?.code, message: failure?.message});
    } finally {
      try { window.localStorage.removeItem(RETURN_TO_KEY); } catch { /* ignore */ }
    }
  };

  // Submit exactly once per round + code (StrictMode mounts effects twice).
  useEffect(() => {
    const key = `${roundId}|${code}`;
    if (!code) {
      try { window.localStorage.removeItem(RETURN_TO_KEY); } catch { /* ignore */ }
      return;
    }
    if (attempted.current === key) return;
    attempted.current = key;
    void submit();
    // submit is recreated each render; the key guard keeps this to one call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, code]);

  if (state.phase === "submitting") {
    return (
      <Frame>
        <Loader2 className="mx-auto h-16 w-16 animate-spin text-muted-foreground" aria-hidden="true" />
        <p role="status" className="m-0 font-heading text-2xl font-bold">Checking you in…</p>
      </Frame>
    );
  }

  if (state.phase === "done") {
    const roundName = state.data?.roundName || state.data?.round?.name;
    return (
      <Frame>
        <div role="status" className="ax-state-done mx-auto grid h-32 w-32 place-items-center rounded-full border-2">
          <CheckCircle2 className="h-16 w-16" style={{color: "var(--ax-state)"}} aria-hidden="true" />
        </div>
        <h1 className="font-display text-6xl leading-none text-primary">You're checked in</h1>
        <p className="m-0 text-lg text-muted-foreground">{roundName ? `${roundName}. ` : ""}Your room appears on your dashboard when the draw is published.</p>
        <Link to="/dashboard" replace className="ax-primary-btn w-full">Go to my dashboard</Link>
      </Frame>
    );
  }

  const isVenueCodePrompt = state.phase === "input" || (state.phase === "failed" && state.code === "INVALID_VENUE_CODE");

  if (isVenueCodePrompt) {
    const isExpired = state.phase === "failed" && state.code === "INVALID_VENUE_CODE";
    return (
      <Frame>
        {isExpired && (
          <div role="alert" className="ax-state-flag mx-auto grid h-24 w-24 place-items-center rounded-full border-2">
            <XCircle className="h-12 w-12" style={{color: "var(--ax-state)"}} aria-hidden="true" />
          </div>
        )}
        <h1 className="font-display text-5xl leading-none text-primary">{isExpired ? "This code expired" : "Check in"}</h1>
        <p className="m-0 text-lg text-muted-foreground">Type the code on the screen</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleaned = typedCode.toUpperCase().replace(/[\s-]/g, "");
            if (cleaned) void submit(cleaned);
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="venue-code-input" className="sr-only">Type the code on the screen</label>
          <input
            id="venue-code-input"
            aria-label="Type the code on the screen"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            maxLength={8}
            value={typedCode}
            onChange={(e) => setTypedCode(e.target.value.toUpperCase().replace(/[\s-]/g, "").slice(0, 6))}
            placeholder="6-character code"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-2xl font-bold uppercase tracking-widest min-h-[48px] focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <button
            type="submit"
            disabled={typedCode.toUpperCase().replace(/[\s-]/g, "").length !== 6}
            className="ax-primary-btn w-full !min-h-12 min-h-[48px]"
          >
            Check in
          </button>
        </form>
        <Link to="/dashboard" replace className="ax-ghost-btn w-full !min-h-12">Go to my dashboard</Link>
      </Frame>
    );
  }

  const known = FAILURES[state.code];
  return (
    <Frame>
      <div role="alert" className="ax-state-flag mx-auto grid h-32 w-32 place-items-center rounded-full border-2">
        <XCircle className="h-16 w-16" style={{color: "var(--ax-state)"}} aria-hidden="true" />
      </div>
      <h1 className="font-display text-6xl leading-none text-primary">{known?.title || "Check-in failed"}</h1>
      <p className="m-0 text-lg text-muted-foreground">{known?.body || state.message || "Something went wrong. Try again, or go to the desk."}</p>
      {!known && code && <button type="button" onClick={() => submit()} className="ax-primary-btn w-full">Try again</button>}
      <Link to="/dashboard" replace className="ax-ghost-btn w-full !min-h-12">Go to my dashboard</Link>
    </Frame>
  );
}
