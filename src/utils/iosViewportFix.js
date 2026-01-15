/**
 * iOS Safari Viewport Height Fix
 *
 * This script fixes the viewport height issue on iOS Safari where the URL bar
 * affects the vh unit. It also ensures the page is scrollable to trigger the
 * URL bar minimization to pill shape.
 */

// Set CSS variable for actual viewport height
function setViewportHeight() {
  // Get the actual viewport height
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);

  // Force minimum scrollable height to trigger iOS URL bar minimization
  const root = document.getElementById("root");
  if (root) {
    // Make content slightly taller than viewport to enable scroll
    root.style.minHeight = `${window.innerHeight + 1}px`;
  }
}

// Run on load
setViewportHeight();

// Run on resize (when URL bar shows/hides)
window.addEventListener("resize", setViewportHeight);

// Run on orientation change
window.addEventListener("orientationchange", () => {
  setTimeout(setViewportHeight, 100);
});

// Run when page becomes visible (iOS Safari specific)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setTimeout(setViewportHeight, 100);
  }
});

// Detect iOS Safari
const isIOSSafari =
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);

if (isIOSSafari) {
  console.log("[iOS] Safari detected - viewport height fix applied");

  // Additional iOS-specific optimizations
  document.body.style.webkitOverflowScrolling = "touch";

  // Prevent zoom on double-tap
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}

export {setViewportHeight, isIOSSafari};
