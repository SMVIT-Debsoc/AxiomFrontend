import {cn} from "../../lib/utils";

export function LoadingIndicator({
  label = "Preparing your workspace",
  fullScreen = false,
  className = "",
}) {
  return (
    <div
      className={cn("axiom-loader", fullScreen && "axiom-loader--screen", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        className="axiom-loader-mark"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className="axiom-loader-orbit"
          cx="32"
          cy="32"
          r="27"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="42 128"
          strokeLinecap="round"
        />
        <circle
          cx="32"
          cy="32"
          r="21"
          stroke="currentColor"
          strokeOpacity=".2"
        />
        <path
          className="axiom-loader-bar"
          d="M23 26v12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          className="axiom-loader-bar"
          d="M32 21v22"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          className="axiom-loader-bar"
          d="M41 26v12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span className="axiom-loader-label">{label}</span>
    </div>
  );
}

export default LoadingIndicator;
