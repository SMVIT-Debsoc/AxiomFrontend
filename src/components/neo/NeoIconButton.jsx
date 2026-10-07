import {Link} from "react-router-dom";
import {cn} from "../../lib/utils";
import NeoIcon from "../icons/NeoIcons";

/**
 * Square icon tile. Behaviour and hard-shadow press feel follow the IconButton of the MIT-licensed
 * Neo-Brutalism UI library (github.com/marieooq/neo-brutalism-ui-library); colours and glyphs are AXIOM's.
 * Pass `to` for a router link, otherwise it renders a <button>. The label is shown as a tooltip and is the
 * accessible name.
 */
export default function NeoIconButton({icon, label, to, active = false, size = "md", onClick, className, ...rest}) {
  const classes = cn("neo-tile", size === "sm" && "neo-tile--sm", className);
  const content = (
    <>
      <NeoIcon name={icon} className="neo-tile-glyph" />
      <span className="neo-tip" aria-hidden="true">
        {label}
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label} aria-current={active ? "page" : undefined} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={label} aria-pressed={active || undefined} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}
