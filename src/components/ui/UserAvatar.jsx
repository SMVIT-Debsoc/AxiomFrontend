import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

export const UserAvatar = ({ user, name, imageUrl, className, size = "md" }) => {
    const [imgError, setImgError] = useState(false);

    // Determine relevant data
    const userData = user || {};
    const displayName = name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "";
    // Check both user.imageUrl and direct imageUrl prop
    const avatarUrl = imageUrl || userData.imageUrl;

    // Reset error state when avatarUrl changes
    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    // Size map
    const sizeClasses = {
        xs: "w-6 h-6",
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12",
        xl: "w-16 h-16",
        "2xl": "w-24 h-24",
        "3xl": "w-32 h-32"
    };

    const containerClasses = cn(
        "relative rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0",
        sizeClasses[size] || sizeClasses.md,
        className
    );

    // Calculate fallback avatar
    // If no name, use "Anonymous" to avoid undefined/empty string issues in hash
    const safeName = displayName || "Anonymous";
    const hash = safeName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // We have 21 avatars now
    const avatarIndex = (hash % 21) + 1;
    const localAvatarUrl = `/avatars/astronaut-${avatarIndex}.png`;

    if (avatarUrl && avatarUrl.trim() !== "" && !imgError) {
        return (
            <div className={containerClasses}>
                <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    return (
        <div className={cn(containerClasses, "bg-muted/20")}>
            <img
                src={localAvatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
            />
        </div>
    );
};
