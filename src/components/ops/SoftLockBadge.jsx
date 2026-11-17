import {describePresence, othersFocusedOn} from "../../hooks/usePresence";
import {cn} from "../../lib/utils";

// <SoftLockBadge admins={admins} kind="debate" id={debate.id} /> : "Riya is here" pill;
// renders nothing when nobody else is focused. A warning only — never blocks editing.
export default function SoftLockBadge({admins, kind, id, className}) {
  const here = othersFocusedOn(admins, kind, id);
  if (here.length === 0) return null;
  const first = (here[0].name || "Another admin").split(/\s+/)[0];
  const text = here.length === 1 ? `${first} is here` : `${here.length} admins here`;
  return (
    <span
      className={cn("ax-chip ax-chip--warn shrink-0 whitespace-nowrap", className)}
      title={here.map((a) => describePresence(a)).join("\n")}
      role="status"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
