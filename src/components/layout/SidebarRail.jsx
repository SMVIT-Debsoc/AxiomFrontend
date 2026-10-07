import {Link} from "react-router-dom";
import Axiom40Mark from "../brand/Axiom40Mark";
import NeoIconButton from "../neo/NeoIconButton";
import NeoIcon from "../icons/NeoIcons";

/**
 * Icon rail used by the participant and admin workspaces: mark on top, one tile per destination,
 * optional footer. Items: {label, path, icon, active}. Hidden below md, where MobileTabs takes over.
 */
export function SidebarRail({items, homePath, homeLabel, footer}) {
  return (
    <aside className="neo-rail" aria-label="Workspace">
      <Link to={homePath} className="neo-rail-mark" aria-label={homeLabel}>
        <Axiom40Mark className="h-11 w-auto" />
      </Link>
      <nav className="neo-rail-nav" aria-label="Primary">
        {items.map((item) => (
          <NeoIconButton key={item.path} to={item.path} icon={item.icon} label={item.label} active={item.active} />
        ))}
      </nav>
      {footer && <div className="neo-rail-foot">{footer}</div>}
    </aside>
  );
}

/** Bottom tab bar for narrow screens, same tiles as the rail with visible labels. */
export function MobileTabs({items}) {
  return (
    <nav className="neo-tabs" aria-label="Mobile navigation">
      {items.map((item) => (
        <Link key={item.path} to={item.path} className="neo-tab" aria-current={item.active ? "page" : undefined}>
          <span className="neo-tile neo-tile--sm" aria-hidden="true">
            <NeoIcon name={item.icon} className="neo-tile-glyph" />
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
