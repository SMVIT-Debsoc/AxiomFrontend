/** "temporary" = Auth.js passcode sign-in (see api/auth), "clerk" = Clerk. Chosen in vite.config.js. */
export const isTemporaryAuth = import.meta.env.VITE_AUTH_MODE === "temporary";
