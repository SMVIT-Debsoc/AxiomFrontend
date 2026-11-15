import {ExternalLink, Flag, Instagram, Trophy, Swords} from "lucide-react";
import {cn} from "../../lib/utils";

const INSTAGRAM_URL = "https://www.instagram.com/smvit_debsoc/";

export default function GameOverCard({
  eventName = "AXIOM 4.0",
  roundsDebated = 0,
  wins = 0,
  roundLabel = null,
  compact = false,
  className = "",
}) {
  return (
    <section
      aria-labelledby="game-over-heading"
      className={cn(
        "relative overflow-hidden rounded-2xl border-[1.5px] border-[#EF4444]/75 bg-[#1D1E18] text-[#EAFBF5] shadow-[0_0_26px_-6px_rgba(239,68,68,0.45)]",
        compact ? "p-4 sm:p-5 space-y-4" : "p-5 sm:p-6 space-y-5",
        className
      )}
    >
      {/* Top crimson/amber tactical bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 pb-3"
        style={{borderBottom: "1px solid rgb(74 86 70 / 0.65)"}}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[#EF4444]/65 bg-[#EF4444]/15 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-[#FCA5A5]">
          <span className="h-2 w-2 rounded-full bg-[#EF4444]" aria-hidden="true" />
          <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>GAME OVER // TOURNAMENT RUN ENDED</span>
        </div>

        {roundLabel && (
          <span className="inline-flex items-center rounded-full border border-[#F59E0B]/60 bg-[#F59E0B]/15 px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#FCD34D]">
            {roundLabel}
          </span>
        )}
      </div>

      {/* Headline & Encouraging Copy */}
      <div className="space-y-1.5">
        <h2
          id="game-over-heading"
          className={cn(
            "font-display uppercase tracking-wide leading-none text-[#EAFBF5]",
            compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
          )}
        >
          Thank You for Debating
        </h2>
        <p className="text-xs sm:text-sm font-sans leading-relaxed text-[#D4EDE1] max-w-2xl">
          You stepped up to the podium and argued with conviction. Elimination concludes your bracket run—your voice stays part of the circuit.
        </p>
      </div>

      {/* Participant Event Summary */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-[#4A5646] bg-[#141510] px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#BDD9CA]">
            <Swords className="w-3 h-3 text-[#FCA5A5] shrink-0" aria-hidden="true" />
            <span className="truncate">Rounds Debated</span>
          </div>
          <p className="mt-1 font-display text-2xl sm:text-3xl leading-none tabular-nums text-[#EAFBF5]">
            {roundsDebated}
          </p>
        </div>

        <div className="rounded-xl border border-[#F59E0B]/45 bg-[#141510] px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#FCD34D]">
            <Trophy className="w-3 h-3 text-[#FBBF24] shrink-0" aria-hidden="true" />
            <span className="truncate">Wins</span>
          </div>
          <p className="mt-1 font-display text-2xl sm:text-3xl leading-none tabular-nums text-[#FDE68A]">
            {wins}
          </p>
        </div>

        <div className="rounded-xl border border-[#4A5646] bg-[#141510] px-3 py-2.5 min-w-0">
          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#BDD9CA] truncate">
            Event Name
          </p>
          <p
            title={eventName}
            className="mt-1.5 font-heading text-xs sm:text-sm font-bold leading-snug text-[#B9F5D8] truncate"
          >
            {eventName}
          </p>
        </div>
      </div>

      {/* Instagram Redirect CTA */}
      <div className="rounded-xl border border-[#F59E0B]/50 bg-[#141510] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-sans font-medium text-[#EAFBF5] leading-relaxed">
          Follow <span className="font-bold text-[#FCD34D]">@smvit_debsoc</span> on Instagram for break updates, finals highlights &amp; upcoming tournaments!
        </p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-4 py-2.5 text-xs sm:text-sm font-heading font-bold text-[#141510] shadow-[0_0_18px_-4px_rgba(245,158,11,0.55)] transition-colors hover:bg-[#FBBF24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBBF24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141510]"
        >
          <Instagram className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Follow @smvit_debsoc</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
