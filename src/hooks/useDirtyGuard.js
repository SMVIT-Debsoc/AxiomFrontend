import {useCallback, useEffect, useRef} from "react";

const DEFAULT_MESSAGE = "You have unsaved changes. Discard them?";

/**
 * Protects unsaved admin edits (ballots, round forms, promotion drafts).
 *
 * The app uses <BrowserRouter>, so react-router's useBlocker is unavailable.
 * This guards tab close / reload via beforeunload, and gives callers a
 * confirmDiscard() to call before Cancel, closing a modal, or switching
 * round/event in-page.
 *
 *   const confirmDiscard = useDirtyGuard(isDirty);
 *   const onCancel = () => { if (confirmDiscard()) close(); };
 */
export function useDirtyGuard(isDirty, message = DEFAULT_MESSAGE) {
  const dirty = useRef(isDirty);
  useEffect(() => {
    dirty.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, message]);

  return useCallback(
    (overrideMessage) => !dirty.current || window.confirm(overrideMessage || message),
    [message],
  );
}
