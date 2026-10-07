import {Link} from "react-router-dom";
import {cn} from "../../lib/utils";

/**
 * Hard-border button with an offset shadow that collapses on press (Button of the MIT-licensed
 * Neo-Brutalism UI library, restyled with AXIOM colours). Pass `to` to render a router link.
 */
export default function NeoButton({to, color = "green", className, children, ...rest}) {
  const classes = cn("neo-button", `neo-button--${color}`, className);
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
