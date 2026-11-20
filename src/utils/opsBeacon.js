// Drop into AxiomFrontend/src/utils/opsBeacon.js and call startOpsBeacon() in src/main.jsx
const BEACON_URL = `${import.meta.env.VITE_API_URL || "/api"}/ops/beacon`;

const sessionId =
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
  `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const opsClientMetrics = (typeof window !== "undefined" && window.__opsClientMetrics) || {
  cacheHits: 0,
  cacheMisses: 0,
  lcpSec: undefined
};

if (typeof window !== "undefined") {
  window.__opsClientMetrics = opsClientMetrics;
}

export function startOpsBeacon() {
  if (typeof window === "undefined") return;

  // Capture real LCP
  if (typeof PerformanceObserver !== "undefined") {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) opsClientMetrics.lcpSec = Number((last.startTime / 1000).toFixed(2));
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Unsupported browser
    }
  }

  const send = () => {
    const payload = JSON.stringify({
      sessionId,
      route: window.location.pathname || "/",
      device: window.innerWidth < 768 ? "mobile" : "desktop",
      lcpSec: opsClientMetrics.lcpSec,
      cacheHits: opsClientMetrics.cacheHits,
      cacheMisses: opsClientMetrics.cacheMisses
    });
    opsClientMetrics.cacheHits = 0;
    opsClientMetrics.cacheMisses = 0;

    try {
      fetch(BEACON_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    } catch {
      // Ignore transient network failures
    }
  };

  send();
  setInterval(send, 15000);
}
