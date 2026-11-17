import {useCallback, useEffect, useRef} from "react";
import {useAuth} from "../auth/client.jsx";
import {createRequestSignal} from "../lib/requestSignal.js";

// Each section can load independently. Repeated live events for a section
// collapse into one follow-up read if that section already has a request open.
export function usePageRequests(initialFields, load, previewField, requestKey) {
  const {getToken, sessionId, userId} = useAuth();
  const sessionScope = sessionId && userId ? sessionId + "/" + userId : null;
  const loader = useRef(null);
  useEffect(() => { loader.current = {getToken, load}; }, [getToken, load]);

  const enqueue = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted;
    const running = new Set();
    const pending = new Set();
    let timer;

    const getRequestToken = () => Promise.resolve().then(() => loader.current.getToken()).catch(() => null);

    async function run(field, skipCache, tokenRequest) {
      running.add(field);
      const {signal, dispose} = createRequestSignal(15000, controller.signal);
      try {
        const token = await tokenRequest;
        if (isCurrent()) {
          const onNavigationPreview = field === previewField ? () => pending.add(field) : undefined;
          await loader.current.load(field, token, {skipCache, signal, sessionScope, onNavigationPreview}, isCurrent);
        }
      } finally {
        dispose?.();
        running.delete(field);
        if (pending.has(field)) schedule();
      }
    }

    function schedule() {
      if (!isCurrent() || timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        let tokenRequest;
        for (const field of pending) {
          if (running.has(field)) continue;
          pending.delete(field);
          tokenRequest ??= getRequestToken();
          void run(field, true, tokenRequest).catch(() => {});
        }
      }, 150);
    }

    enqueue.current = (fields) => {
      fields.forEach((field) => pending.add(field));
      schedule();
    };
    const tokenRequest = getRequestToken();
    initialFields.forEach((field) => { void run(field, false, tokenRequest).catch(() => {}); });

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      enqueue.current = null;
    };
  }, [initialFields, previewField, sessionScope, requestKey]);

  return useCallback((...fields) => enqueue.current?.(fields), []);
}
