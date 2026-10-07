import {useMemo, useState} from "react";
import {cn} from "../../lib/utils";
import {avatarDataUri, avatarSeed, hasRealPhoto} from "../../lib/avatar";

const sizes = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
  "2xl": "w-24 h-24",
  "3xl": "w-32 h-32",
};

/**
 * Profile picture. A person's own photo is shown when they have one; everyone else gets the
 * generated sculptural portrait from `lib/avatar` (never an initial letter).
 */
export function UserAvatar({user, name, imageUrl, className = "", size = "md"}) {
  const [failedUrl, setFailedUrl] = useState(null);
  const displayName = name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Participant";
  const photo = imageUrl || user?.imageUrl;
  const usePhoto = hasRealPhoto(photo) && photo !== failedUrl;
  const seed = avatarSeed(user, displayName);
  const generated = useMemo(() => avatarDataUri(seed), [seed]);

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border",
        sizes[size] || sizes.md,
        className,
      )}
    >
      <img
        src={usePhoto ? photo : generated}
        alt={displayName}
        className="w-full h-full object-cover"
        onError={() => setFailedUrl(photo)}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
