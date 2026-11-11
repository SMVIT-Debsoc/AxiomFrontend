import {Link, useLocation} from "react-router-dom";
import {ArrowUpRight} from "lucide-react";
import Sculpture from "../brand/Sculpture";
import {figureFor} from "../brand/figures";

const FIGURES = ["shiva-music", "surya", "hanuman", "ganesha", "vishnu", "nataraja"];

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
        <div className="axiom-ws-footer-credit mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Presented by SMVIT Debsoc</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.smvitdebsoc.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline hover:text-[#9FE3C2]"
          >
            smvitdebsoc.com
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
      <Sculpture figure={figure} variant="detail" className="axiom-ws-footer-art" />
    </aside>
  );
}
