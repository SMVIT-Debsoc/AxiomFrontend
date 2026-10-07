import {cn} from "../../lib/utils";
import Sculpture from "../brand/Sculpture";
import {figureFor} from "../brand/figures";

// Upright, single figures that read well inside the round halo.
const EMPTY_FIGURES = ["mother-goddess", "lotus-goddess", "yakshi", "vidyadevi"];

/**
 * Themed empty state: a green halo with slowly turning rays behind the Mother Goddess sculpture
 * (full) or an icon (`compact`, `row`). `row` lays the halo beside the copy for small panels.
 */
export default function EmptyState({title, description, icon: Icon, action, compact = false, row = false, className}) {
  const small = compact || row;
  return (
    <div className={cn("axiom-empty", compact && "axiom-empty--compact", row && "axiom-empty--row", className)}>
      <div className="axiom-empty-art" aria-hidden="true">
        {small && Icon ? (
          <Icon />
        ) : (
          <Sculpture figure={figureFor(String(title), EMPTY_FIGURES)} variant="empty" />
        )}
      </div>
      <div className="axiom-empty-copy">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {action && <div className="axiom-empty-action">{action}</div>}
      </div>
    </div>
  );
}
