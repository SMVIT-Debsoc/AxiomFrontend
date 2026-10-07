import {cn} from "../../lib/utils";

/** Bordered card with an offset shadow that grows on hover (Card of the Neo-Brutalism UI library, MIT). */
export default function NeoCard({className, children, ...rest}) {
  return (
    <div className={cn("neo-card", className)} {...rest}>
      {children}
    </div>
  );
}
