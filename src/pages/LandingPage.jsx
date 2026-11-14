import {lazy, Suspense, useEffect, useRef, useState} from "react";
import {Link} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import Axiom40Logo from "../components/brand/Axiom40Logo";
import Sculpture from "../components/brand/Sculpture";
import DebSocPromoCard from "../components/brand/DebSocPromoCard";
import ThemeToggle from "../components/ui/ThemeToggle";
import {GoogleAuthButton} from "../auth/client.jsx";
import {EVENT_CONFIG as E} from "../config/event";

const AdminAccessModal = lazy(() => import("../components/brand/AdminAccessModal"));

const STEPS = [
    {n: "01", title: "Continue with Google", body: "One tap. Your name, email and photo come across automatically.", short: "Name and email come across automatically."},
    {n: "02", title: "Add college, mobile & USN", body: "Three fields on one screen. About 30 seconds.", short: "Three fields on one screen. That's it."},
    {n: "03", title: "You're registered", body: "We enrol you in AXIOM 4.0 automatically. On the day, check in from your phone to get your room.", short: "Auto-enrolled. Check in from your phone on the day."},
];

const FAQ = [
    {q: "Do I need a Google account?", a: "Yes. Google is the sign-in for AXIOM 4.0. Any Gmail or college Google Workspace account works."},
    {q: "Can I register at the venue?", a: "Yes. Scan the QR at the desk, sign in, add three details, done. Organisers see you appear instantly."},
];

export default function LandingPage() {
    const heroCta = useRef(null);
    const phoneCta = useRef(null);
    const [showBar, setShowBar] = useState(false);
    const [adminModalOpen, setAdminModalOpen] = useState(false);

    // Sticky Google bar on phones: appears once the hero button has scrolled out above the viewport.
    useEffect(() => {
        const targets = [heroCta.current, phoneCta.current].filter(Boolean);
        if (!targets.length || typeof IntersectionObserver === "undefined") return undefined;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.target.offsetParent) return; // the hidden (other breakpoint) copy
                setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
            });
        }, {threshold: 0});
        targets.forEach((t) => observer.observe(t));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-svh bg-background font-sans text-foreground">
            <a className="axiom-skip" href="#hero-cta">Skip to registration</a>

            <header className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5">
                <Link to="/" aria-label="AXIOM 4.0 home" className="flex items-center gap-3 text-primary no-underline">
                    <Axiom40Logo variant="nav" className="!w-[84px] md:!w-[104px]" />
                    <span className="hidden font-heading text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:inline">{E.organiser}</span>
                </Link>
                <nav aria-label="Primary" className="flex items-center gap-1 md:gap-2">
                    <a href="#how" className="hidden px-3.5 py-3 text-[15px] font-medium md:inline">How it works</a>
                    <a href="#faq" className="hidden px-3.5 py-3 text-[15px] font-medium md:inline">FAQ</a>
                    <a
                        href="https://www.smvitdebsoc.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-[#B9F5D8] hover:text-primary"
                    >
                        <span>smvitdebsoc.com</span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                    <ThemeToggle />
                    <GoogleAuthButton variant="header" label="Sign in" />
                </nav>
            </header>

            {/* SCROLL 1: hero */}
            <section id="top" aria-label={`${E.name} registration`} className="mx-auto grid max-w-[1280px] items-stretch gap-4 px-4 pb-6 md:grid-cols-2 md:gap-6 md:px-6 md:pb-10">
                <div className="order-2 flex flex-col justify-center gap-6 md:order-1 md:py-8">
                    <p className="hidden items-center gap-2 self-start rounded-full bg-[#B9F5D8] px-3.5 py-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#141510] md:inline-flex">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#1D1E18]" />
                        Registrations open
                    </p>
                    <h1 id="hero-title" className="hidden font-display text-[clamp(64px,9vw,128px)] font-normal leading-[0.88] tracking-[0.01em] text-primary md:block">
                        Ancient thought.<br /><span className="text-[#4A5646] dark:text-[#9FE3C2]">New arguments.</span>
                    </h1>
                    <p className="hidden max-w-[520px] text-[19px] leading-relaxed text-muted-foreground md:block">
                        {E.name} is {E.organiser}'s competitive debate tournament. Register in under a minute: sign in with Google, add your details, and you're in.
                    </p>
                    <div id="hero-cta" ref={heroCta} className="hidden max-w-[520px] flex-col gap-2.5 md:flex">
                        <GoogleAuthButton variant="hero" />
                    </div>
                </div>

                {/* Panel: on phones this holds headline + CTA; on desktop it is the sculpture + facts */}
                <div className="relative order-1 flex min-h-[560px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#1D1E18] p-5 text-[#EAFBF5] md:order-2 md:min-h-[520px] md:justify-end md:p-0">
                    <div aria-hidden="true" className="absolute inset-0 opacity-50 md:opacity-[0.55]" style={{backgroundImage: "linear-gradient(#4A5646 1px, transparent 1px), linear-gradient(90deg, #4A5646 1px, transparent 1px)", backgroundSize: "40px 40px"}} />
                    <Sculpture figure="shiva-music" eager className="!absolute -right-10 top-2.5 !h-[420px] !w-auto opacity-55 mix-blend-luminosity md:right-[6%] md:top-auto md:bottom-0 md:!h-full md:max-w-[70%] md:opacity-90 md:object-bottom" />

                    <div className="relative flex flex-col gap-3.5 md:hidden">
                        <p className="inline-flex items-center gap-2 self-start rounded-full bg-[#B9F5D8] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#141510]"><span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#1D1E18]" />Registrations open</p>
                        <h1 className="font-display text-[72px] font-normal leading-[0.86] text-[#EAFBF5]">Ancient<br />thought.<br /><span className="text-[#B9F5D8]">New<br />arguments.</span></h1>
                        <p className="m-0 max-w-[250px] text-base leading-normal text-[#BDD9CA]">{E.organiser}'s debate tournament. Register in about a minute.</p>
                    </div>

                    <div className="relative mt-6 flex flex-col gap-2.5 md:hidden">
                        <div ref={phoneCta} className="flex flex-col gap-2">
                            <GoogleAuthButton variant="hero" />
                        </div>
                    </div>

                </div>
            </section>

            {/* SCROLL 2: how + why */}
            <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-14">
                <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground md:hidden">How it works</p>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4 md:mb-8">
                    <h2 id="how-title" className="font-display text-[52px] font-normal leading-[0.9] text-primary md:text-[clamp(48px,6vw,80px)]">Three steps.<br />About sixty seconds.</h2>
                    <p className="hidden max-w-[380px] text-base leading-relaxed text-muted-foreground md:block">No passwords to make, no long forms. Google fills in your name and email for you.</p>
                </div>
                <ol className="m-0 grid list-none gap-2.5 p-0 md:grid-cols-3 md:gap-4">
                    {STEPS.map((s, i) => {
                        const dark = i === 2;
                        return (
                            <li key={s.n} className={`flex gap-3.5 rounded-[18px] p-4 md:flex-col md:gap-3 md:rounded-[22px] md:p-7 ${dark ? "bg-[#4A5646] text-[#EAFBF5]" : "border border-border bg-card"}`}>
                                <span className="w-[34px] shrink-0 font-display text-[40px] leading-[0.9] text-[#B9F5D8] md:w-auto md:text-[56px] md:leading-none">{s.n}</span>
                                <div>
                                    <h3 className={`m-0 font-heading text-[19px] font-bold md:text-2xl ${dark ? "text-[#EAFBF5]" : "text-primary"}`}>{s.title}</h3>
                                    <p className={`m-0 mt-1 text-[15px] leading-snug md:mt-3 md:text-base md:leading-relaxed ${dark ? "text-[#BDD9CA]" : "text-muted-foreground"}`}><span className="md:hidden">{s.short}</span><span className="hidden md:inline">{s.body}</span></p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </section>

            {/* Society Promotion Snippet */}
            <section aria-label="About the host society" className="mx-auto max-w-[1280px] px-4 pb-6 pt-2 md:px-6 md:pb-10">
                <DebSocPromoCard />
            </section>

            {/* SCROLL 3: FAQ + CTA */}
            <section id="faq" aria-labelledby="faq-title" className="mx-auto grid max-w-[1280px] gap-4 px-4 pb-6 pt-2 md:grid-cols-2 md:gap-10 md:px-6 md:pb-14 md:pt-6">
                <h2 id="faq-title" className="font-display text-[44px] font-normal leading-[0.95] text-primary md:text-[clamp(44px,5vw,64px)]">Quick answers</h2>
                <dl className="m-0 flex flex-col">
                    {FAQ.map((f, i) => (
                        <div key={f.q} className={`border-t border-border py-3.5 md:py-[18px] ${i === FAQ.length - 1 ? "border-b" : ""}`}>
                            <dt className="font-heading text-[17px] font-bold text-primary md:text-[19px]">{f.q}</dt>
                            <dd className="m-0 mt-1 text-[15px] leading-normal text-muted-foreground md:mt-1.5 md:text-base">{f.a}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section aria-labelledby="cta-title" className="px-4 pb-6 md:px-6">
                <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-8 overflow-hidden rounded-3xl bg-[#1D1E18] p-5 py-6 text-[#EAFBF5] md:rounded-[32px] md:p-[clamp(32px,6vw,72px)]">
                    <Sculpture figure="vishnu" className="!absolute -right-5 -top-2.5 !h-[260px] !w-auto opacity-20 mix-blend-luminosity md:right-[26%] md:top-auto md:bottom-0 md:!h-full md:opacity-[0.18]" />
                    <div className="relative flex flex-col gap-2 md:gap-3">
                        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9FE3C2] md:text-[13px]">The floor is yours</p>
                        <h2 id="cta-title" className="font-display text-[64px] font-normal leading-[0.88] text-[#EAFBF5] md:text-[clamp(64px,9vw,120px)]">Make your<br className="md:hidden" /> case.</h2>
                    </div>
                    <div className="relative flex w-full md:w-auto"><GoogleAuthButton variant="onDark" /></div>
                </div>
            </section>

            <footer className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-4 pb-32 pt-4 text-sm leading-normal text-muted-foreground md:px-6 md:pb-10">
                <p className="m-0">
                    {E.name} · {E.organiserLong} · {E.city}
                    <button
                        type="button"
                        onClick={() => setAdminModalOpen(true)}
                        aria-label="Admin Portal"
                        className="ml-1 inline-flex h-4 w-4 cursor-default items-center justify-center rounded text-[10px] leading-none text-muted-foreground/20 transition-opacity hover:text-muted-foreground/50 focus-visible:text-primary focus-visible:outline-none"
                    >
                        ·
                    </button>
                </p>
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a className="underline font-medium text-foreground hover:text-[#9FE3C2]" href="https://www.smvitdebsoc.com" target="_blank" rel="noopener noreferrer">SMVIT DebSoc ↗</a> · Sculpture: <a className="underline" href="https://www.clevelandart.org/art/1971.117" target="_blank" rel="noreferrer">Cleveland Museum of Art, CC0</a> · <Link className="underline" to="/about">About</Link> · <a className="underline" href="#top">Back to top</a>
                </p>
            </footer>

            {adminModalOpen && (
                <Suspense fallback={null}>
                    <AdminAccessModal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
                </Suspense>
            )}

            {/* Sticky Google bar, phones only, once the hero button has scrolled away */}
            <div
                aria-hidden={!showBar}
                className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pb-6 pt-3 shadow-[0_-10px_24px_rgba(30,59,47,.16)] transition-transform duration-200 md:hidden ${showBar ? "translate-y-0" : "translate-y-full"}`}
            >
                <div className={showBar ? "flex" : "pointer-events-none invisible"}>
                    <GoogleAuthButton variant="bar" label="Continue with Google" />
                </div>
            </div>
        </div>
    );
}
