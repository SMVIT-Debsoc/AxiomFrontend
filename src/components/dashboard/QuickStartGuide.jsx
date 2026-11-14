import { useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Radio,
  Swords,
  Trophy,
  X,
  ArrowRight,
  Calendar,
} from "lucide-react";
import ModalSurface from "../ui/ModalSurface";
import {
  GUIDE_STEPS,
  isGuideDismissed,
  markGuideDismissed,
} from "../../lib/visualGuide";
import { cn } from "../../lib/utils";

/**
 * Pure schematic visual preview of what the debater sees for each step.
 * Marked aria-hidden so assistive tech & automation target real controls only.
 */
function StepDiagram({ stepId, compact = false }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-xl border border-[#4A5646] bg-[#141510] select-none overflow-hidden",
        compact ? "p-2.5" : "p-4 sm:p-5"
      )}
    >
      {stepId === "check-in" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 text-[10px] font-heading uppercase tracking-wider text-[#BDD9CA]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#B9F5D8]" />
              Round 1 Window
            </span>
            <span className="rounded border border-[#4A5646] px-1.5 py-0.5 text-[#9FE3C2]">
              OPEN
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#4A5646] bg-[#1D1E18] p-2">
            <span className="text-[11px] font-semibold text-[#EAFBF5] truncate">
              Confirm attendance
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#B9F5D8] px-2.5 py-1 text-[11px] font-bold text-[#141510]">
              <CheckCircle2 size={12} />
              Check In Now
            </span>
          </div>
          {!compact && (
            <div className="flex items-center justify-between text-[11px] text-[#9FE3C2]">
              <span>Next state:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#B9F5D8]">
                <CheckCircle2 size={12} /> Presence Verified
              </span>
            </div>
          )}
        </div>
      )}

      {stepId === "arena" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#B9F5D8]">
              <Swords size={12} /> Draw Live
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-[#272922] border border-[#4A5646] px-2 py-0.5 text-[10px] font-mono text-[#EAFBF5]">
              <MapPin size={10} className="text-[#B9F5D8]" /> Room 204
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-[#4A5646] bg-[#1D1E18] px-2 py-1.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-[#9FE3C2]">
                GOV
              </span>
              <span className="block text-[11px] font-semibold text-[#EAFBF5] truncate">
                You
              </span>
            </div>
            <div className="rounded-lg border border-[#4A5646] bg-[#1D1E18] px-2 py-1.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-[#BDD9CA]">
                OPP
              </span>
              <span className="block text-[11px] font-semibold text-[#EAFBF5] truncate">
                Opponent
              </span>
            </div>
          </div>
          {!compact && (
            <div className="rounded-lg border border-[#4A5646]/70 bg-[#1D1E18]/70 px-2.5 py-1.5 text-[11px] text-[#D4EDE1]">
              <span className="font-semibold text-[#B9F5D8]">Motion:</span> This House believes...
            </div>
          )}
        </div>
      )}

      {stepId === "live" && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#4A5646] bg-[#1D1E18] p-1 text-[10px] font-semibold">
            <span className="flex items-center justify-center gap-1 rounded bg-[#B9F5D8] py-1 text-[#141510] font-bold">
              <Swords size={10} /> Live
            </span>
            <span className="flex items-center justify-center gap-1 rounded py-1 text-[#BDD9CA]">
              <Calendar size={10} /> Rounds
            </span>
            <span className="flex items-center justify-center gap-1 rounded py-1 text-[#BDD9CA]">
              <Trophy size={10} /> Results
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#4A5646] bg-[#1D1E18] px-2.5 py-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#EAFBF5]">
              <Radio size={12} className="text-[#B9F5D8]" />
              Live Updates Active
            </span>
            <span className="text-[10px] font-mono text-[#9FE3C2]">Auto-Sync</span>
          </div>
        </div>
      )}

      {stepId === "results" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#4A5646] bg-[#1D1E18] px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#B9F5D8] text-[#141510]">
                <Trophy size={13} />
              </span>
              <span className="text-[11px] font-semibold text-[#EAFBF5] truncate">
                Round Decision
              </span>
            </div>
            <span className="shrink-0 rounded border border-[#B9F5D8]/40 bg-[#B9F5D8]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#B9F5D8]">
              QUALIFIED
            </span>
          </div>
          {!compact && (
            <div className="flex items-center justify-between text-[11px] text-[#BDD9CA]">
              <span>Ballots verified privately</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#B9F5D8]">
                View Standings <ArrowRight size={11} />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline navigation cheat-sheet shown on /dashboard for first-time logins.
 * Never opens a blocking dialog so WhatsAppFirstLoginModal and round check-ins remain unhindered.
 */
export function FirstLoginGuideStrip({ onOpenFullGuide }) {
  const [dismissed, setDismissed] = useState(() => isGuideDismissed());
  const [stepIndex, setStepIndex] = useState(0);

  if (dismissed) return null;

  const step = GUIDE_STEPS[stepIndex] || GUIDE_STEPS[0];
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  const handleDismiss = () => {
    markGuideDismissed();
    setDismissed(true);
  };

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
    } else {
      setStepIndex((i) => Math.min(GUIDE_STEPS.length - 1, i + 1));
    }
  };

  return (
    <section
      aria-label="First-time login visual guide"
      className="axiom-rise rounded-2xl border-2 border-[#4A5646] bg-[#1D1E18] p-4 text-[#EAFBF5] shadow-sm sm:p-5"
      style={{ "--i": 0 }}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4A5646]/70 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#B9F5D8] text-[#141510]">
            <Compass size={16} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">
              Quick Start Field Guide · Step {step.numeral} of 0{GUIDE_STEPS.length}
            </p>
            <h2 className="m-0 font-heading text-sm sm:text-base font-bold text-[#EAFBF5] truncate">
              {step.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenFullGuide && (
            <button
              type="button"
              onClick={onOpenFullGuide}
              className="inline-flex min-h-11 items-center rounded-xl border border-[#4A5646] px-3 text-xs font-semibold text-[#D4EDE1] transition-colors hover:bg-[#272922] hover:text-[#EAFBF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
            >
              See all 4 steps
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss visual guide"
            className="grid h-11 w-11 place-items-center rounded-xl text-[#BDD9CA] transition-colors hover:bg-[#272922] hover:text-[#EAFBF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Grid: Visual Schematic + Catchphrase Copy */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-center">
        <StepDiagram stepId={step.id} compact />

        <div className="flex flex-col justify-between gap-2 min-w-0">
          <div>
            <p className="m-0 font-display text-2xl sm:text-[26px] tracking-wide leading-none text-[#B9F5D8]">
              {step.catchphrase}
            </p>
            <p className="m-0 mt-1.5 text-xs sm:text-sm leading-relaxed text-[#D4EDE1]">
              {step.instruction}
            </p>
          </div>
          <p className="m-0 text-[11px] font-mono text-[#BDD9CA]">
            Where: <span className="text-[#EAFBF5]">{step.destination}</span>
          </p>
        </div>
      </div>

      {/* Footer Step Dots + Controls */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#4A5646]/60">
        <div className="flex items-center gap-1.5" role="group" aria-label="Guide steps">
          {GUIDE_STEPS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStepIndex(idx)}
              aria-label={`Step ${idx + 1}: ${item.title}`}
              aria-current={idx === stepIndex ? "step" : undefined}
              className={cn(
                "grid h-11 min-w-8 place-items-center rounded-lg px-2 text-xs font-mono font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]",
                idx === stepIndex
                  ? "bg-[#B9F5D8] text-[#141510]"
                  : "border border-[#4A5646] bg-[#141510] text-[#BDD9CA] hover:bg-[#272922]"
              )}
            >
              {item.numeral}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-11 rounded-xl border border-[#4A5646] px-3.5 text-xs font-semibold text-[#BDD9CA] transition-colors hover:bg-[#272922] hover:text-[#EAFBF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#B9F5D8] px-4 text-xs font-heading font-bold text-[#141510] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
          >
            <span>{isLast ? "Let's Debate" : "Next Tip"}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Interactive 4-Step Visual Walkthrough Modal accessible anytime via the header "? Guide" button.
 */
export function VisualGuideModal({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);

  if (!open) return null;

  const step = GUIDE_STEPS[stepIndex] || GUIDE_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  const handleFinish = () => {
    markGuideDismissed();
    onClose();
  };

  return (
    <ModalSurface
      onDismiss={onClose}
      aria-labelledby="visual-guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[#4A5646] bg-[#1D1E18] p-5 text-[#EAFBF5] shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close visual guide"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-[#BDD9CA] transition-colors hover:bg-[#272922] hover:text-[#EAFBF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-10">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#B9F5D8] text-[#141510]">
            <Compass size={20} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <div>
            <p className="m-0 text-[11px] font-heading font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">
              AXIOM 4.0 · Arena Map
            </p>
            <h2
              id="visual-guide-modal-title"
              className="m-0 font-heading text-xl sm:text-2xl font-bold text-[#EAFBF5]"
            >
              How to Navigate the Arena
            </h2>
          </div>
        </div>

        {/* Step Navigation Pills */}
        <div
          className="mt-5 grid grid-cols-4 gap-1.5"
          role="tablist"
          aria-label="Navigation guide steps"
        >
          {GUIDE_STEPS.map((item, idx) => {
            const active = idx === stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStepIndex(idx)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]",
                  active
                    ? "border-[#B9F5D8] bg-[#B9F5D8] text-[#141510]"
                    : "border-[#4A5646] bg-[#141510] text-[#BDD9CA] hover:bg-[#272922] hover:text-[#EAFBF5]"
                )}
              >
                <span className="font-display text-lg leading-none">{item.numeral}</span>
                <span className="mt-0.5 text-[10px] font-heading font-bold uppercase tracking-wider truncate max-w-full">
                  {item.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Step Card */}
        <div className="mt-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-4xl leading-none text-[#B9F5D8]">
              {step.numeral}
            </span>
            <span className="rounded-full border border-[#4A5646] bg-[#141510] px-3 py-1 text-[11px] font-mono text-[#9FE3C2]">
              {step.destination}
            </span>
          </div>

          <div>
            <h3 className="m-0 font-heading text-lg font-bold text-[#EAFBF5]">
              {step.title}
            </h3>
            <p className="m-0 mt-1 font-display text-3xl sm:text-4xl tracking-wide leading-[0.95] text-[#B9F5D8]">
              {step.catchphrase}
            </p>
            <p className="m-0 mt-2.5 text-sm leading-relaxed text-[#D4EDE1]">
              {step.instruction}
            </p>
          </div>

          <StepDiagram stepId={step.id} />
        </div>

        {/* Footer Controls */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#4A5646]/70 pt-4">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#4A5646] px-4 text-xs font-semibold text-[#D4EDE1] transition-colors hover:bg-[#272922] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            <span>Back</span>
          </button>

          <span className="text-xs font-mono text-[#BDD9CA]">
            {stepIndex + 1} / {GUIDE_STEPS.length}
          </span>

          {isLast ? (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#B9F5D8] px-5 text-sm font-heading font-bold text-[#141510] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
            >
              <span>Got It, Let&apos;s Debate</span>
              <CheckCircle2 size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(GUIDE_STEPS.length - 1, i + 1))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#B9F5D8] px-5 text-sm font-heading font-bold text-[#141510] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
            >
              <span>Next Step</span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </ModalSurface>
  );
}
