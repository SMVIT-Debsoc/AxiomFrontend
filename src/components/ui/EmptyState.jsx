import {cn} from "../../lib/utils";

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
          <img src="/brand/mother-goddess-480.webp" width="480" height="1337" alt="" loading="lazy" decoding="async" />
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
