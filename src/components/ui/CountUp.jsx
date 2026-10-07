import {useEffect, useState} from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts a number up on mount/change. Accepts 12, "12" or "75%" (suffix kept). */
export default function CountUp({value, duration = 700}) {
  const text = String(value ?? "");
  const match = text.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  const target = match ? Number(match[1]) : null;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  // progress is 0..1 and only ever set from an animation-frame callback.
  const [progress, setProgress] = useState(0);
  const animate = target !== null && target !== 0 && !prefersReducedMotion();

  useEffect(() => {
    if (!animate) return undefined;
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  if (target === null) return <>{text}</>;
  const shown = animate ? target * progress : target;
  return (
    <span style={{fontVariantNumeric: "tabular-nums"}}>
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}
