import NeoIcon from "../icons/NeoIcons";

const STEPS = [
  {icon: "EventsIcon", title: "Register", text: "Pick a tournament and enrol. Your college and mobile number unlock registration."},
  {icon: "AppsIcon", title: "Check in", text: "When a round opens, check in before the window closes so you are included in the draw."},
  {icon: "RoomsIcon", title: "Find your room", text: "Once the draw is released, your opponent, room and motion appear here and on your overview."},
  {icon: "ResultsIcon", title: "Follow results", text: "Published scores and progression appear after each round. Qualify to move on."},
];

/** Short how-it-works strip. Fills pages that have little data yet and answers the first-time questions. */
export default function TournamentGuide() {
  return (
    <section aria-labelledby="guide-title" className="axiom-rise" style={{"--i": 3}}>
      <h2 id="guide-title" className="font-heading font-bold text-base text-foreground mb-3">How a tournament runs</h2>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="axiom-guide-card">
            <span className="axiom-guide-num" aria-hidden="true">0{index + 1}</span>
            <span className="neo-tile neo-tile--sm" aria-hidden="true"><NeoIcon name={step.icon} className="neo-tile-glyph" /></span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
