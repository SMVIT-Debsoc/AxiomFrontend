import Axiom40Logo from "../components/brand/Axiom40Logo";
import DiscourseSections from "../components/brand/DiscourseSections";
import Sculpture from "../components/brand/Sculpture";
import {EVENT_CONFIG as E} from "../config/event";

export default function Home() {
    return (
        <div className="axiom-entry">
            <section className="bg-axiom py-12 md:py-20">
                <div className="axiom-container grid md:grid-cols-2 gap-8 items-start">
                    <div><p className="axiom-eyebrow mb-8">SMVIT Debsoc / About the arena</p><Axiom40Logo variant="hero" className="text-axiom-ink" /><Sculpture figure="ganesha" variant="aside" className="axiom-about-art" eager /></div>
                    <div>
                        <h1 className="text-[clamp(2.75rem,11vw,3.75rem)] lg:text-8xl">About {E.name}</h1>
                        <p className="mt-6 max-w-lg">{E.name} is {E.organiser}'s collegiate parliamentary debate tournament at {E.venue}. Debaters use this site to register, check in for their rounds, find their pairings and rooms, and see published results.</p>
                    </div>
                </div>
            </section>
            <DiscourseSections />
        </div>
    );
}
