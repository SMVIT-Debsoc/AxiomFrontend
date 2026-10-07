import {useState} from "react";
import {Eye, EyeOff} from "lucide-react";
import {cn} from "../../lib/utils";

/** Password field with a show/hide button. Forwards every input prop; `className` styles the input. */
export default function PasswordInput({className, ...props}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="axiom-password">
      <input {...props} type={visible ? "text" : "password"} className={cn("axiom-password-input", className)} />
      <button
        type="button"
        className="axiom-password-toggle"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}
