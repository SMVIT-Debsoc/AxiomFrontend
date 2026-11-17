export function createRequestSignal(timeoutMs, parent) {
  const supportsTimeout = typeof AbortSignal.timeout === "function";
  const supportsAny = typeof AbortSignal.any === "function";
  if (supportsTimeout && (!parent || supportsAny)) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return {signal: parent ? AbortSignal.any([parent, timeout]) : timeout};
  }

  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent.reason);
  if (parent?.aborted) {
    abortFromParent();
    return {signal: controller.signal};
  }

  const timer = setTimeout(() => {
    controller.abort(new DOMException("The request timed out.", "TimeoutError"));
  }, timeoutMs);
  const dispose = () => {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abortFromParent);
  };
  parent?.addEventListener("abort", abortFromParent, {once: true});
  controller.signal.addEventListener("abort", dispose, {once: true});
  return {signal: controller.signal, dispose};
}
