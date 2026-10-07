import {useEffect, useRef} from "react";
import {useUser} from "@clerk/clerk-react";
import {avatarPngBlob, avatarSeed} from "../lib/avatar";
import {isTemporaryAuth} from "../auth/mode";

/**
 * Gives every Clerk account that has no photo a generated sculptural portrait, once.
 * The portrait is uploaded as the Clerk profile image, so Clerk's account menu, the API and
 * every other user see the themed picture instead of Clerk's generic placeholder.
 * Accounts that already have a photo are left alone. No-op for the temporary sign-in, which
 * generates the portrait locally.
 */
export default function AvatarSync() {
  const {user, isLoaded, isSignedIn} = useUser();
  const inFlight = useRef(false);

  useEffect(() => {
    if (isTemporaryAuth || !isLoaded || !isSignedIn || !user || user.hasImage !== false) return;
    const flag = `axiom-avatar-synced-${user.id}`;
    if (inFlight.current || localStorage.getItem(flag)) return;
    inFlight.current = true;
    avatarPngBlob(avatarSeed(user))
      .then((file) => user.setProfileImage({file}))
      .then(() => localStorage.setItem(flag, "1"))
      .catch((error) => console.warn("Profile portrait upload skipped:", error?.message || error))
      .finally(() => {
        inFlight.current = false;
      });
  }, [isLoaded, isSignedIn, user]);

  return null;
}
