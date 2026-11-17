import {Medal} from "lucide-react";
import {cn} from "../../lib/utils";

export default function StandingRank({rank, medal}) {
  return (
    <span className={cn(
      "inline-flex min-w-10 shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono font-bold",
      medal ? `ax-podium--${medal}` : "border border-border bg-muted text-muted-foreground",
    )}>
      {medal && <Medal className="h-3 w-3 shrink-0" aria-hidden="true" />}
      #{rank}
      {medal && <span className="capitalize">{medal}</span>}
    </span>
  );
}
