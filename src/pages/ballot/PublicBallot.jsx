import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {CheckCircle2, Lock, WifiOff} from "lucide-react";
import {OpsApi} from "../../services/api";
import {resolveWinnerId} from "../../lib/scoring";
import {cn} from "../../lib/utils";

// /ballot/:token — the judge's private e-ballot link (no account). Mobile-first,
// one screen. The ballot counts as soon as it is submitted; unusual scores are
// flagged for the Results desk, never blocked. The draft lives on this phone
// (localStorage, keyed by token) so a dropped connection loses nothing.

const JUDGE_NAME_KEY = "axiom.judgeName";
const draftKey = (token) => `axiom.ballotDraft.${token}`;

const readStorage = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key, value) => {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
};
const readDraft = (token) => {
  try { return JSON.parse(readStorage(draftKey(token)) || "null"); } catch { return null; }
};

const parseScore = (value) => {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
};

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function Shell({children}) {
  return (
    <main className="axiom-workspace min-h-dvh bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">{children}</div>
    </main>
  );
}

export default function PublicBallot() {
  const {token} = useParams();
  const [ballot, setBallot] = useState(null);
  const [loadState, setLoadState] = useState({loading: true, error: null});
  const [form, setForm] = useState(() => {
    const draft = readDraft(token);
    return {
      s1: draft?.s1 ?? "",
      s2: draft?.s2 ?? "",
      winnerId: draft?.winnerId ?? "",
      judgeName: draft?.judgeName ?? readStorage(JUDGE_NAME_KEY) ?? "",
      dirty: Boolean(draft),
    };
  });
  const [view, setView] = useState("form"); // form | done
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const online = useOnline();
  const govInput = useRef(null);

  const load = useCallback(async () => {
    setLoadState({loading: true, error: null});
    try {
      const response = await OpsApi.getPublicBallot(token);
      const data = response?.data || null;
      setBallot(data);
      setLoadState({loading: false, error: null});
      if (data?.submitted) {
        const hasDraft = Boolean(readDraft(token));
        setForm((prev) => (prev.dirty && hasDraft ? prev : {
          s1: String(data.submitted.debater1Score ?? ""),
          s2: String(data.submitted.debater2Score ?? ""),
          winnerId: data.submitted.winnerId || "",
          judgeName: data.submitted.judgeName || prev.judgeName,
          dirty: false,
        }));
        if (!hasDraft) setView("done");
      }
    } catch (failure) {
      setLoadState({loading: false, error: failure});
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const govId = ballot?.gov?.id || "";
  const oppId = ballot?.opp?.id || "";
  const s1 = parseScore(form.s1);
  const s2 = parseScore(form.s2);
  const bothScored = Number.isFinite(s1) && Number.isFinite(s2);
  const tie = bothScored && s1 === s2;
  const winnerId = resolveWinnerId(form.s1, form.s2, form.winnerId, govId, oppId);
  const ready = bothScored && Boolean(winnerId) && form.judgeName.trim().length > 0;

  const update = (patch) => {
    setSubmitError(null);
    setForm((prev) => {
      const next = {...prev, ...patch, dirty: true};
      writeStorage(draftKey(token), JSON.stringify({s1: next.s1, s2: next.s2, winnerId: next.winnerId, judgeName: next.judgeName}));
      return next;
    });
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (!ready || submitting || !ballot) return;
    setSubmitting(true);
    setSubmitError(null);
    const judgeName = form.judgeName.trim();
    writeStorage(JUDGE_NAME_KEY, judgeName);
    try {
      const response = await OpsApi.submitPublicBallot(token, {debater1Score: s1, debater2Score: s2, winnerId, judgeName});
      writeStorage(draftKey(token), null);
      setLastResult({debater1Score: s1, debater2Score: s2, winnerId, judgeName, updatedAt: response?.data?.updatedAt});
      setBallot((prev) => (prev ? {...prev, submitted: {debater1Score: s1, debater2Score: s2, winnerId, judgeName, at: response?.data?.updatedAt || new Date().toISOString()}} : prev));
      setForm((prev) => ({...prev, dirty: false}));
      setView("done");
    } catch (failure) {
      setSubmitError(failure);
      if (failure?.code === "BALLOT_LOCKED" || failure?.status === 423) void load();
    } finally {
      setSubmitting(false);
    }
  };

  const header = useMemo(() => ballot && (
    <header className="flex flex-col gap-1.5">
      <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {[ballot.eventName, ballot.roundName || (ballot.roundNumber ? `Round ${ballot.roundNumber}` : null)].filter(Boolean).join(" · ")}
      </p>
      <h1 className="font-display text-[56px] font-normal leading-[0.9] text-primary">{ballot.roomName || "Ballot"}</h1>
      {ballot.motion && <p className="m-0 rounded-2xl bg-muted px-4 py-3 text-[15px] font-medium leading-snug">{ballot.motion}</p>}
    </header>
  ), [ballot]);

  if (loadState.loading && !ballot) {
    return (
      <Shell>
        <div role="status" aria-label="Loading ballot" className="flex flex-col gap-3">
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-14 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Shell>
    );
  }

  if (!ballot) {
    const notFound = loadState.error?.status === 404;
    return (
      <Shell>
        <div role="alert" className="ax-card mt-10 flex flex-col gap-3 p-6 text-center">
          <h1 className="font-display text-5xl leading-none text-primary">{notFound ? "Link not valid" : "Couldn't open ballot"}</h1>
          <p className="m-0 text-muted-foreground">{notFound ? "This ballot link doesn't exist. Ask the Results desk for a new one." : loadState.error?.message || "Check your connection."}</p>
          {!notFound && <button type="button" onClick={load} className="ax-primary-btn w-full">Try again</button>}
        </div>
      </Shell>
    );
  }

  const sides = [
    {key: "gov", label: "GOV", person: ballot.gov, id: govId, field: "s1", chip: "ax-chip--gov"},
    {key: "opp", label: "OPP", person: ballot.opp, id: oppId, field: "s2", chip: "ax-chip--opp"},
  ];

  if (ballot.locked && !ballot.submitted) {
    return (
      <Shell>
        {header}
        <LockedNotice reason={ballot.lockedReason} />
      </Shell>
    );
  }

  if (view === "done" || ballot.locked) {
    const shown = lastResult || ballot.submitted;
    const winner = sides.find((side) => side.id && side.id === shown?.winnerId);
    return (
      <Shell>
        {header}
        {!ballot.locked && (
          <div role="status" className="ax-state-done flex items-center gap-3 rounded-2xl border p-4">
            <CheckCircle2 className="h-8 w-8 shrink-0" style={{color: "var(--ax-state)"}} aria-hidden="true" />
            <div>
              <p className="m-0 font-heading text-xl font-bold">Ballot received</p>
              <p className="m-0 text-sm text-muted-foreground">It counts now — nothing else to do.</p>
            </div>
          </div>
        )}
        {ballot.locked && <LockedNotice reason={ballot.lockedReason} />}
        <section aria-label="Submitted scores" className="ax-card flex flex-col divide-y divide-border">
          {sides.map((side) => (
            <div key={side.key} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <span className={cn("ax-chip", side.chip)}>{side.label}</span>
                <p className="m-0 mt-1 truncate text-lg font-semibold">{side.person?.name || "TBD"}</p>
              </div>
              <p className="m-0 font-display text-5xl leading-none tabular-nums">{side.key === "gov" ? shown?.debater1Score : shown?.debater2Score}</p>
            </div>
          ))}
          <p className="m-0 p-4 text-[15px]">
            Winner: <strong>{winner ? `${winner.person?.name || winner.label} (${winner.label})` : "—"}</strong>
            {shown?.judgeName && <span className="block text-sm text-muted-foreground">Judge: {shown.judgeName}</span>}
          </p>
        </section>
        {!ballot.locked && (
          <button type="button" onClick={() => setView("form")} className="ax-ghost-btn w-full !min-h-12">Edit ballot</button>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      {!online && (
        <p role="status" className="ax-state-flag m-0 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold">
          <WifiOff size={18} aria-hidden="true" /> You're offline. Your scores are saved on this phone.
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        {sides.map((side) => {
          const isWinner = Boolean(winnerId) && winnerId === side.id;
          return (
            <section
              key={side.key}
              aria-label={`${side.label} ${side.person?.name || ""}`}
              className={cn("ax-card flex flex-col gap-3 p-4 transition-colors", isWinner && "ax-state-done border-2")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={cn("ax-chip", side.chip)}>{side.label}</span>
                  <p className="m-0 mt-1.5 text-xl font-bold leading-tight">{side.person?.name || "TBD"}</p>
                </div>
                {isWinner && <span className="ax-chip ax-chip--win shrink-0">Winner</span>}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-muted-foreground">{side.label} score</span>
                <input
                  ref={side.key === "gov" ? govInput : undefined}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint={side.key === "gov" ? "next" : "done"}
                  value={form[side.field]}
                  onChange={(e) => update({[side.field]: e.target.value.replace(/[^\d.,]/g, "")})}
                  aria-label={`${side.label} score for ${side.person?.name || side.label}`}
                  aria-invalid={form[side.field] !== "" && !Number.isFinite(parseScore(form[side.field]))}
                  // Inline size: the global mobile input rule pins inputs to 1rem.
                  style={{fontSize: "3rem"}}
                  className="h-16 w-full rounded-2xl border-[1.5px] border-input bg-card px-4 text-center font-display tabular-nums leading-none"
                  placeholder="—"
                />
              </label>
              {tie && (
                <button
                  type="button"
                  onClick={() => update({winnerId: side.id})}
                  aria-pressed={form.winnerId === side.id}
                  className={cn(form.winnerId === side.id ? "ax-primary-btn" : "ax-ghost-btn !min-h-12", "w-full")}
                >
                  {form.winnerId === side.id ? `${side.label} wins the tie` : `Tap if ${side.label} wins`}
                </button>
              )}
            </section>
          );
        })}

        {tie && !winnerId && <p role="status" className="m-0 text-center text-sm font-semibold">Scores are tied — tap the winner.</p>}

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-muted-foreground">Your name (judge)</span>
          <input
            type="text"
            autoComplete="name"
            aria-label="Your name (judge)"
            value={form.judgeName}
            onChange={(e) => update({judgeName: e.target.value})}
            className="h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-base"
            placeholder="First and last name"
          />
        </label>

        {submitError && (
          <div role="alert" className="ax-state-flag rounded-2xl border px-4 py-3 text-sm">
            <p className="m-0 font-semibold">{submitError.message || "Could not send the ballot."}</p>
            <p className="m-0 mt-0.5 text-muted-foreground">Your scores are kept on this phone. Tap Submit to retry.</p>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 bg-background/95 px-4 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
          <button type="submit" disabled={!ready || submitting} className="ax-primary-btn w-full !min-h-14 !text-lg">
            {submitting ? "Sending…" : submitError ? "Retry submit" : ballot.submitted ? "Submit changes" : "Submit ballot"}
          </button>
          {!ready && (
            <p className="m-0 py-2 text-center text-xs text-muted-foreground">
              {!bothScored ? "Enter both scores." : !winnerId ? "Choose the winner." : "Add your name."}
            </p>
          )}
        </div>
      </form>
    </Shell>
  );
}

function LockedNotice({reason}) {
  return (
    <div role="status" className="ax-card flex items-start gap-3 p-4">
      <Lock className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="m-0 font-heading text-lg font-bold">This ballot is locked</p>
        <p className="m-0 text-sm text-muted-foreground">{reason || "Results for this round are final. Ask the Results desk if something is wrong."}</p>
      </div>
    </div>
  );
}
