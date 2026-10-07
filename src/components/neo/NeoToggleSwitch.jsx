import {cn} from "../../lib/utils";

/** Switch with a hard-edged track and a sliding knob (ToggleSwitch of the Neo-Brutalism UI library, MIT). */
export default function NeoToggleSwitch({checked, onChange, label, className}) {
  return (
    <label className={cn("neo-switch", className)}>
      <input type="checkbox" role="switch" className="sr-only peer" checked={checked} onChange={onChange} aria-label={label} />
      <span className="neo-switch-track" aria-hidden="true" />
    </label>
  );
}
