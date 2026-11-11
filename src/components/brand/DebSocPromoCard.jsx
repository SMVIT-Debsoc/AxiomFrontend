import {ArrowUpRight, Globe} from "lucide-react";
import Sculpture from "./Sculpture";

export default function DebSocPromoCard() {
    return (
        <aside
            aria-label="About SMVIT DebSoc"
            className="relative overflow-hidden rounded-[24px] md:rounded-[28px] bg-[#1D1E18] p-6 text-[#EAFBF5] md:p-10 border border-[#4A5646]/40 shadow-xl"
        >
            {/* Grid texture matching the hero section */}
            <div
                aria-hidden="true"
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                    backgroundImage:
                        "linear-gradient(#4A5646 1px, transparent 1px), linear-gradient(90deg, #4A5646 1px, transparent 1px)",
                    backgroundSize: "36px 36px",
                }}
            />

            {/* Classical Sculpture accent */}
            <Sculpture
                figure="surya"
                className="!absolute -right-8 -bottom-10 !h-[300px] md:!h-[360px] !w-auto opacity-20 md:opacity-30 mix-blend-luminosity pointer-events-none object-contain"
            />

            <div className="relative z-10 flex flex-col items-start gap-4 max-w-[680px]">
                {/* Society Eyebrow badge */}
                <div className="inline-flex items-center gap-2 rounded-full bg-[#272922] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#B9F5D8] border border-[#4A5646]">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#B9F5D8] animate-pulse" />
                    Host Society · Bengaluru
                </div>

                {/* Headline and Tagline */}
                <div>
                    <h2 className="font-display text-[clamp(28px,3.5vw,44px)] font-normal leading-[1.02] text-[#EAFBF5] m-0">
                        Home of Collegiate Discourse.
                    </h2>
                    <p className="mt-2 text-base md:text-lg font-medium text-[#9FE3C2]">
                        The Debating Society of Sir MVIT
                    </p>
                </div>

                {/* Society Summary */}
                <p className="text-[14px] md:text-[15px] leading-relaxed text-[#BDD9CA] m-0">
                    Founded on the principles of articulation, reason, and composure. We train competitive parliamentary debaters, host marquee circuit tournaments across South India, and convene weekly deliberative spaces.
                </p>

                {/* Quick Topic Chips */}
                <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-[#EAFBF5]/90">
                    <span className="rounded-lg bg-[#272922] px-2.5 py-1 border border-[#4A5646]/60">Parliamentary Debate</span>
                    <span className="rounded-lg bg-[#272922] px-2.5 py-1 border border-[#4A5646]/60">Circuit Adjudication</span>
                    <span className="rounded-lg bg-[#272922] px-2.5 py-1 border border-[#4A5646]/60">Campus Sessions</span>
                </div>

                {/* Call to action */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                    <a
                        href="https://www.smvitdebsoc.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#B9F5D8] px-5 py-3 text-sm md:text-base font-extrabold text-[#141510] transition hover:bg-[#EAFBF5] hover:shadow-[0_0_0_3px_#9FE3C2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9FE3C2]"
                    >
                        <Globe size={18} aria-hidden="true" />
                        Explore smvitdebsoc.com
                        <ArrowUpRight size={18} aria-hidden="true" />
                    </a>

                    <span className="text-xs text-[#A8B2A6]">
                        Official society portal & circuit archives
                    </span>
                </div>
            </div>
        </aside>
    );
}
