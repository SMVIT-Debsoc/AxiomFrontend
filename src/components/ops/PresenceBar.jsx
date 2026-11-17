import {describePresence, STATION_NAMES} from "../../hooks/usePresence";
import {initialsOf} from "../../lib/relativeTime";
import {cn} from "../../lib/utils";

const MAX_AVATARS = 5;

// <PresenceBar admins={admins} me={me} /> : compact avatars + station chips of admins on this round.
// Shows up to five others (initials), "+N" for the rest; each avatar's title reads
// "Riya · Desk · scoring Room 12". Renders a quiet "Only you" when nobody else is here.
export default function PresenceBar({admins = [], me = null, className}) {
  const others = Array.isArray(admins) ? admins : [];
  const shown = others.slice(0, MAX_AVATARS);
  const hidden = others.length - shown.length;
  const summary = others.length === 0
    ? "Only you on this round"
    : `${others.length} other admin${others.length === 1 ? "" : "s"} on this round`;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} aria-label={summary} role="group">
      {me?.station && (
        <span className="ax-chip ax-chip--idle shrink-0" title={`You · ${STATION_NAMES[me.station] || me.station}`}>
          You · {STATION_NAMES[me.station] || me.station}
        </span>
      )}
      {others.length === 0 ? (
        <span className="text-xs text-muted-foreground">Only you</span>
      ) : (
        <ul className="m-0 flex list-none items-center p-0">
          {shown.map((admin, index) => {
            const line = describePresence(admin);
            return (
              <li
                key={admin.clientId || `${admin.name}-${index}`}
                title={line}
                className={cn("relative flex items-center", index > 0 && "-ml-1.5")}
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-[#4A5646] font-heading text-[11px] font-bold text-[#EAFBF5]"
                >
                  {initialsOf(admin.name)}
                </span>
                <span className="sr-only">{line}</span>
                {admin.station && (
                  <span aria-hidden="true" className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-background px-1 text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
                    {(STATION_NAMES[admin.station] || admin.station).slice(0, 3)}
                  </span>
                )}
              </li>
            );
          })}
          {hidden > 0 && (
            <li
              className="-ml-1.5 grid h-8 min-w-8 place-items-center rounded-full border-2 border-background bg-muted px-1.5 text-[11px] font-bold tabular-nums text-foreground"
              title={others.slice(MAX_AVATARS).map((a) => describePresence(a)).join("\n")}
            >
              +{hidden}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
