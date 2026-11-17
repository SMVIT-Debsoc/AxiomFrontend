import {useCallback, useEffect, useRef, useState} from "react";
import {useToast} from "./useToast";

/**
 * Shared pattern for admin mutations so every page behaves the same when
 * several admins are working at once:
 *  - one in-flight request per key (blocks double clicks / double submits)
 *  - optional confirm() before destructive actions
 *  - the server's own error message in the toast (never a generic string)
 *  - 409 conflicts surfaced distinctly so the page can refresh instead of retrying
 *
 * Usage:
 *   const {run, isBusy} = useAdminMutation();
 *   <button disabled={isBusy("publish")} onClick={() => run("publish", () => RoundApi.publish(...), {
 *     confirm: "Unpublish the draw? Debaters will stop seeing their rooms.",
 *     success: "Draw unpublished",
 *     onConflict: () => refetch(),
 *   })}>
 *
 * run() resolves to the action's result, or `undefined` when it was skipped,
 * cancelled, or failed. It never throws.
 */
export function useAdminMutation() {
  const toast = useToast();
  const inFlight = useRef(new Set());
  const mounted = useRef(true);
  const [busyKeys, setBusyKeys] = useState(() => new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setBusy = useCallback((key, busy) => {
    if (busy) inFlight.current.add(key);
    else inFlight.current.delete(key);
    if (mounted.current) setBusyKeys(new Set(inFlight.current));
  }, []);

  const run = useCallback(
    async (key, action, options = {}) => {
      const {confirm: confirmText, success, error: errorText, onSuccess, onError, onConflict, silent} = options;
      if (inFlight.current.has(key)) return undefined;
      if (confirmText && typeof window !== "undefined" && !window.confirm(confirmText)) return undefined;
      setBusy(key, true);
      try {
        const result = await action();
        if (success && !silent) toast.success(typeof success === "function" ? success(result) : success);
        await onSuccess?.(result);
        return result;
      } catch (err) {
        if (isConflictError(err)) {
          toast.error(err.message || "Another admin changed this just now. Showing the latest version.");
          await onConflict?.(err);
        } else if (!silent) {
          toast.error(err?.message || errorText || "Something went wrong. Please try again.");
        }
        await onError?.(err);
        return undefined;
      } finally {
        setBusy(key, false);
      }
    },
    [setBusy, toast],
  );

  const isBusy = useCallback((key) => (key == null ? busyKeys.size > 0 : busyKeys.has(key)), [busyKeys]);

  return {run, isBusy};
}

export function isConflictError(err) {
  return err?.status === 409;
}
