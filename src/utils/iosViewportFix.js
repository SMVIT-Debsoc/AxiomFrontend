/**
 * Mobile & iOS Safari Dynamic Viewport Fix
 *
 * Synchronizes CSS custom properties (--vh and --app-dvh) with the live
 * visual/inner viewport height across URL bar transitions and virtual keyboard
 * resize events without forcing artificial +1px body overflow or swallowing
 * rapid touch taps (CSS `touch-action: manipulation` handles double-tap zoom).
 */

function setViewportHeight() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const activeHeight = window.visualViewport?.height || window.innerHeight;
  const vh = activeHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
  document.documentElement.style.setProperty("--app-dvh", `${ Math.round(activeHeight) }px`);
}

// Run on load
setViewportHeight();

if (typeof window !== "undefined") {
  // Run on resize (when URL bar shows/hides)
  window.addEventListener("resize", setViewportHeight, { passive: true });

  // Track visualViewport for mobile virtual keyboard & dynamic browser chrome
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setViewportHeight, { passive: true });
  }

  // Run on orientation change
  window.addEventListener(
    "orientationchange",
    () => {
      setTimeout(setViewportHeight, 100);
    },
    { passive: true }
  );
}

if (typeof document !== "undefined") {
  // Run when page becomes visible (iOS Safari specific)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      setTimeout(setViewportHeight, 100);
    }
  });
}

// Detect iOS Safari
const isIOSSafari =
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);

if (isIOSSafari && typeof document !== "undefined" && document.body) {
  document.body.style.webkitOverflowScrolling = "touch";
}

export { setViewportHeight, isIOSSafari };
