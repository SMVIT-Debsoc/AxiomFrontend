import {Link, useLocation} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import Sculpture from "../brand/Sculpture";
import {figureFor} from "../brand/figures";

const FIGURES = ["vidyadevi", "yakshi", "ganga", "lotus-goddess", "siddhalakshmi", "durga"];

/**
 * Bottom-anchored banner for workspace pages. The page stack is at least viewport tall, so on short
 * pages this sits at the bottom and closes the layout instead of leaving an empty void; on long pages
 * it simply follows the content. Hidden on the two overview pages, which compose their own space.
 */
export default function WorkspaceFooter({links, line}) {
  const {pathname} = useLocation();
  if (pathname === "/dashboard" || pathname === "/admin") return null;
  const figure = figureFor(pathname.split("/").slice(0, 3).join("/"), FIGURES);
  return (
    <aside className="axiom-ws-footer" aria-label="Shortcuts">
      <div className="axiom-ws-footer-copy">
        <p className="axiom-eyebrow">Between rounds</p>
        <p className="axiom-ws-footer-line">{line}</p>
        <div className="axiom-ws-footer-links">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="axiom-ws-chip">
              {link.label}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
      <Sculpture figure={figure} variant="detail" className="axiom-ws-footer-art" />
    </aside>
  );
}
