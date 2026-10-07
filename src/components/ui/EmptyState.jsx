import {cn} from "../../lib/utils";

/**
 * Themed empty state: a green halo with slowly turning rays behind the Mother Goddess
 * sculpture (full) or an icon (compact, for panels and table bodies).
 */
export default function EmptyState({title, description, icon: Icon, action, compact = false, className}) {
  return (
    <div className={cn("axiom-empty", compact && "axiom-empty--compact", className)}>
      <div className="axiom-empty-art" aria-hidden="true">
        {compact && Icon ? (
          <Icon />
        ) : (
          <img
            src="/brand/mother-goddess-480.webp"
            width="480"
            height="1337"
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="axiom-empty-action">{action}</div>}
    </div>
  );
}
