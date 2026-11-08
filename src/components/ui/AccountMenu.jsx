import {useCallback, useEffect, useId, useRef, useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {ChevronDown, LogOut, UserRound} from "lucide-react";
import {useAuth, useUser} from "../../auth/client.jsx";
import {UserAvatar} from "./UserAvatar";

/**
 * Account control for the workspace headers: avatar and first name in one pill; opens a small
 * menu with the full name, email, a profile link and Sign out. Replaces the old "name, email,
 * email, Sign out" strip, which truncated everything and wrapped the sign-out link.
 */
export default function AccountMenu({profilePath = "/dashboard/profile", profileLabel = "My profile", className = ""}) {
  const {user} = useUser();
  const {signOut} = useAuth();
  const location = useLocation();
  // Remembering the route the menu was opened on closes it automatically when the route changes.
  const [openPath, setOpenPath] = useState(null);
  const open = openPath === location.pathname;
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpenPath(null);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (root.current && !root.current.contains(event.target)) setOpenPath(null); };
    const onKey = (event) => { if (event.key === "Escape") close(true); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  if (!user) return null;
  const fullName = user.fullName || user.email || "Account";
  const firstName = user.firstName || fullName.split(" ")[0];

  const handleSignOut = async () => {
    setBusy(true);
    try { await signOut(); } catch { window.location.assign("/"); }
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpenPath(open ? null : location.pathname)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${fullName}`}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
      >
        <UserAvatar user={user} name={fullName} imageUrl={user.imageUrl} size="md" className="!bg-transparent" />
        <span className="hidden max-w-[7.5rem] truncate text-sm font-semibold sm:block">{firstName}</span>
        <ChevronDown size={16} aria-hidden="true" className={`hidden text-muted-foreground transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Account" className="axiom-rise absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <UserAvatar user={user} name={fullName} imageUrl={user.imageUrl} size="lg" />
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-bold" title={fullName}>{fullName}</p>
              <p className="m-0 truncate text-xs text-muted-foreground" title={user.email}>{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" role="separator" />
          <Link role="menuitem" to={profilePath} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-[hsl(var(--muted))] focus-visible:bg-[hsl(var(--muted))] focus-visible:outline-none">
            <UserRound size={16} aria-hidden="true" />{profileLabel}
          </Link>
          <button role="menuitem" type="button" onClick={handleSignOut} disabled={busy} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/.1)] focus-visible:bg-[hsl(var(--destructive)/.1)] focus-visible:outline-none disabled:opacity-60">
            <LogOut size={16} aria-hidden="true" />{busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
