import {useCallback, useEffect, useMemo, useRef} from "react";
import socketService from "../services/socket";

/**
 * Debounced trigger: many calls inside `delay` ms collapse into one call of the
 * latest `fn`. Pending calls are dropped on unmount.
 */
export function useDebouncedCallback(fn, delay = 500) {
  const fnRef = useRef(fn);
  const timer = useRef(null);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return useCallback((...args) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      fnRef.current?.(...args);
    }, delay);
  }, [delay]);
}

/**
 * Subscribe to one or more socket events and call `onEvent` (debounced by
 * default, so bursts from several admins collapse into one refetch).
 *
 *   useSocketRefresh([SocketEvents.ROOMS_UPDATED], () => load({skipCache: true}));
 *
 * Options:
 *  - delay: debounce in ms (0 = call immediately)
 *  - enabled: subscribe only when true
 *  - filter(data, eventName): return false to ignore a payload
 */
export function useSocketRefresh(events, onEvent, {delay = 500, enabled = true, filter} = {}) {
  const filterRef = useRef(filter);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    filterRef.current = filter;
    onEventRef.current = onEvent;
  }, [filter, onEvent]);

  const debounced = useDebouncedCallback((data, name) => onEventRef.current?.(data, name), delay);
  const eventKey = (events || []).filter(Boolean).join("|");

  useEffect(() => {
    if (!enabled || !eventKey) return undefined;
    const unsubscribers = eventKey.split("|").map((name) =>
      socketService.on(name, (data) => {
        if (filterRef.current && filterRef.current(data, name) === false) return;
        if (delay > 0) debounced(data, name);
        else onEventRef.current?.(data, name);
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub?.());
  }, [enabled, eventKey, delay, debounced]);
}

/**
 * Stale-response guard. Call `begin()` before a request and check
 * `isCurrent(id)` before applying its result; only the newest request wins.
 * `begin()` also aborts the previous request's signal.
 */
export function useLatestRequest() {
  const counter = useRef(0);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  return useMemo(() => ({
    begin() {
      controller.current?.abort();
      controller.current = typeof AbortController !== "undefined" ? new AbortController() : null;
      counter.current += 1;
      return {id: counter.current, signal: controller.current?.signal};
    },
    isCurrent(id) {
      return id === counter.current;
    },
  }), []);
}
