import {cn} from "../../lib/utils";

/** Labelled progress bar (ProgressBar of the Neo-Brutalism UI library, MIT) that fills in on mount. */
export default function NeoProgressBar({value = 0, min = 0, max = 100, label, showPercentage = true, className}) {
  const clamped = Math.min(max, Math.max(min, Number(value) || 0));
  const percent = max === min ? 0 : ((clamped - min) / (max - min)) * 100;
  return (
    <div
      className={cn("neo-progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
    >
      <div className="neo-progress-fill axiom-bar" style={{width: `${percent}%`}} />
      {showPercentage && <span className="neo-progress-text">{Math.round(percent)}%</span>}
    </div>
  );
}
