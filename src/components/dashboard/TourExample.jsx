const examples = {
  events: {title: "Example tournament", action: "View Details"},
  enrollment: {title: "Tournament sign-up", action: "Enroll Now"},
  rounds: {title: "Round 1", action: "Open Round"},
  "check-in": {
    title: "Check-in Window",
    details: [["Opens", "10:00 am IST"], ["Closes", "10:15 am IST"]],
    action: "Check In Now",
  },
  side: {title: "Your Position", details: [["Side", "Opposition (OPP)"], ["Your Opponent", "Example debater"]]},
  room: {title: "Room and Time Slot", details: [["Room", "Example Room"], ["Time Slot", "10:30–10:50 am IST"]]},
  motion: {title: "Motion", text: "This House would make public transport free."},
  results: {title: "Results", details: [["Status", "Qualified"]]},
};

export default function TourExample({stepId}) {
  const example = examples[stepId];
  if (!example) return null;
  return (
    <section data-tour-example={stepId} aria-label={`Site Tour example: ${example.title}`}
      className="rounded-xl border border-dashed border-primary/60 bg-card p-4 text-card-foreground space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Site Tour example · Sample only</p>
      <h3 className="text-base font-heading font-bold">{example.title}</h3>
      {example.text && <p className="text-sm">{example.text}</p>}
      {example.details && (
        <dl className="flex flex-wrap gap-x-5 gap-y-2">
          {example.details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {example.action && <span className="inline-flex rounded-lg border border-border bg-muted px-3 py-2 text-xs font-bold">{example.action}</span>}
    </section>
  );
}
