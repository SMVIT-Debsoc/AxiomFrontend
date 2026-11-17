import { useState } from "react";
import { cn } from "../../../lib/utils";
import { ADVANCE_PRESETS, advanceTargetChoice } from "../../../lib/advanceTarget";

/**
 * Advance target picker: Auto | 8 | 16 | 32 | 64 | 128 | Custom.
 * `value` is the form string ("" = auto); `onChange` receives the new string.
 */
export default function AdvanceTargetField({ value, onChange }) {
  const choice = advanceTargetChoice(value);
  const [customOpen, setCustomOpen] = useState(choice === "custom");
  const showCustom = customOpen || choice === "custom";
  const options = [["auto", "Auto"], ...ADVANCE_PRESETS.map((n) => [String(n), String(n)]), ["custom", "Custom"]];
  const active = showCustom ? "custom" : choice;

  const pick = (key) => {
    if (key === "custom") {
      setCustomOpen(true);
      if (choice !== "custom") onChange("");
      return;
    }
    setCustomOpen(false);
    onChange(key === "auto" ? "" : key);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-foreground">Advance target</legend>
      <p className="m-0 text-[11px] text-muted-foreground">
        How many debaters go through. Auto = the smallest power of two that holds every winner; best losers fill the rest.
      </p>
      <div role="radiogroup" aria-label="Advance target" className="flex flex-wrap gap-1.5">
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active === key}
            onClick={() => pick(key)}
            className={cn(
              "min-h-11 min-w-11 rounded-full border px-3.5 text-xs font-bold tabular-nums transition-colors",
              active === key
                ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#B9F5D8] dark:text-[#141510]"
                : "border-input bg-card text-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {showCustom && (
        <label className="block">
          <span className="sr-only">Custom advance target</span>
          <input
            type="number"
            inputMode="numeric"
            min={2}
            step={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 24"
            className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base sm:text-sm tabular-nums"
          />
        </label>
      )}
    </fieldset>
  );
}
