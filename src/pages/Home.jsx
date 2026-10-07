import Axiom40Logo from "../components/brand/Axiom40Logo";
import DiscourseSections from "../components/brand/DiscourseSections";

export default function Home() {
    return (
        <div className="axiom-entry">
            <section className="bg-axiom py-12 md:py-20">
                <div className="axiom-container grid md:grid-cols-2 gap-8 items-start">
                    <div><p className="axiom-eyebrow mb-8">SMVIT Debsoc / About the arena</p><Axiom40Logo variant="hero" className="text-axiom-ink" /></div>
                    <div><h1 className="text-6xl lg:text-8xl">Classical eloquence.<br />Modern competition.</h1><p className="mt-6 max-w-lg">AXIOM 4.0 brings the tournament into focus. A workspace for debate, pairings, tabulation and room allocations—so you can focus on the argument.</p></div>
                </div>
            </section>
            <DiscourseSections />
        </div>
    );
}
