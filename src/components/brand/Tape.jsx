const WORDS = ["Articulation", "Reason", "Composure", "SMVIT Debsoc", "Edition 04", "Ancient thought", "New arguments"];

/** Scrolling caution-tape style ticker. Decorative, so hidden from assistive tech. */
export default function Tape({className = ""}) {
  return (
    <div className={`axiom-tape ${className}`} aria-hidden="true">
      <div className="axiom-tape-track">
        {[0, 1].map((copy) => (
          <span key={copy}>
            {WORDS.map((word) => (
              <b key={word}>{word}</b>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
