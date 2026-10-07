import {ArrowUpRight} from "lucide-react";
import {Link} from "react-router-dom";
import Sculpture from "./Sculpture";

export default function DiscourseSections() {
    return (
        <>
            <section className="axiom-principles axiom-container" aria-labelledby="discourse-title">
                <div className="axiom-section-top"><p className="axiom-eyebrow">01 / The discipline</p><p className="axiom-eyebrow">Classical eloquence.<br />Contemporary competition.</p></div>
                <div className="axiom-principles-grid">
                    <div><h2 id="discourse-title">Not louder.<br />More considered.</h2><p className="mt-6 max-w-sm">Debate is the art of making thought precise. Articulation, reasoning and composure—not simply disagreement.</p></div>
                    <div>
                        <article className="axiom-argument"><span aria-hidden="true">01</span><div><h3>Articulate.</h3><p>Build an argument that holds together. Give every idea a structure, and every word a purpose.</p></div></article>
                        <article className="axiom-argument"><span aria-hidden="true">02</span><div><h3>Reason.</h3><p>Meet a proposition with clarity. Listen carefully, examine the evidence and respond with precision.</p></div></article>
                        <article className="axiom-argument"><span aria-hidden="true">03</span><div><h3>Compose.</h3><p>Stay measured under pressure. Let the strength of your reasoning carry the room.</p></div></article>
                    </div>
                </div>
            </section>
            <section className="axiom-editorial" aria-labelledby="editorial-title">
                <div className="axiom-editorial-grid axiom-container">
                    <div className="axiom-editorial-art"><Sculpture variant="detail" /></div>
                    <div><p className="axiom-eyebrow mb-6">02 / Heritage × experimentation</p><h2 id="editorial-title">Thought has depth.<br />Give it a voice.</h2><p>Carved stone meets a digital arena. AXIOM 4.0 brings a considered visual language to the energy of competitive debate.</p><Link className="axiom-button axiom-button--green" to="/get-started">Join the discourse<ArrowUpRight size={20} aria-hidden="true" /></Link><div className="axiom-colophon">Sculpture: <a href="https://www.clevelandart.org/art/1970.12" target="_blank" rel="noreferrer">Mother Goddess</a>, c. 600.<br />Northwestern India, Rajasthan, Udaipur District.<br />The Cleveland Museum of Art · CC0 Open Access.</div></div>
                </div>
            </section>
            <section className="axiom-principles axiom-container" aria-labelledby="platform-title">
                <div className="axiom-section-top"><p className="axiom-eyebrow">03 / Built for the round</p><p className="axiom-eyebrow">A quieter interface.<br />A sharper focus.</p></div>
                <div className="axiom-principles-grid">
                    <div><h2 id="platform-title">The argument.<br />Not the admin.</h2><p className="mt-6 max-w-sm">A tournament workspace for participants and organizers. Your next round, in one place.</p><Link to="/login-select" className="axiom-button mt-8">Open your workspace<ArrowUpRight size={20} aria-hidden="true" /></Link></div>
                    <div><article className="axiom-argument"><span aria-hidden="true">[1]</span><div><h3>Pairings & rooms</h3><p>Find your opponent, check your room allocation and follow the progression of your rounds.</p></div></article><article className="axiom-argument"><span aria-hidden="true">[2]</span><div><h3>Published results</h3><p>Participants can follow their published results. Organizers can review tournament standings.</p></div></article><article className="axiom-argument"><span aria-hidden="true">[3]</span><div><h3>One organized arena</h3><p>Manage events, participants, check-ins and tabulation without losing sight of the debate.</p></div></article></div>
                </div>
            </section>
            <section className="bg-axiom text-axiom-ink py-16 md:py-24"><div className="axiom-container flex flex-col md:flex-row md:items-end justify-between gap-8"><div><p className="axiom-eyebrow mb-4">04 / The floor is yours</p><h2 className="text-6xl md:text-8xl">Make your case.</h2></div><Link className="axiom-button" to="/get-started">Get started<ArrowUpRight size={20} aria-hidden="true" /></Link></div></section>
        </>
    );
}
