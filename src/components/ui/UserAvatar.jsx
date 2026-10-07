import {useState} from "react";
import {cn} from "../../lib/utils";

const sizes = {xs: "w-6 h-6", sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12", xl: "w-16 h-16", "2xl": "w-24 h-24", "3xl": "w-32 h-32"};

export function UserAvatar({user, name, imageUrl, className, size = "md"}) {
    const [failedUrl, setFailedUrl] = useState(null);
    const displayName = name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Participant";
    const avatarUrl = imageUrl || user?.imageUrl;
    const initials = displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    return (
        <div className={cn("relative rounded-full overflow-hidden bg-primary/15 text-primary flex items-center justify-center shrink-0 font-heading font-semibold", sizes[size] || sizes.md, className)}>
            {avatarUrl?.trim() && avatarUrl !== failedUrl ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" onError={() => setFailedUrl(avatarUrl)} loading="lazy" /> : <span role="img" aria-label={displayName}>{initials}</span>}
        </div>
    );
}
