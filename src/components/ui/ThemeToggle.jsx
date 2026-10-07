import {Lightbulb} from "@theme-toggles/react";
import "@theme-toggles/react/styles/lightbulb.css";
import {ThemeAnimationType, useModeAnimation} from "react-theme-switch-animation";
import {useTheme} from "../../hooks/useTheme";
import {cn} from "../../lib/utils";

/**
 * Light-bulb toggle (theme-toggles, MIT) that reveals the new theme as a blurred circle growing out
 * of the button (react-theme-switch-animation, MIT, View Transitions API). Browsers without View
 * Transitions, and reduced-motion users, switch instantly. ThemeProvider stays the single source of truth.
 */
export default function ThemeToggle({className}) {
  const {theme, setTheme} = useTheme();
  const dark = theme === "dark";
  const {ref, toggleSwitchTheme} = useModeAnimation({
    animationType: ThemeAnimationType.BLUR_CIRCLE,
    blurAmount: 2,
    duration: 900,
    isDarkMode: dark,
    onDarkModeChange: (next) => setTheme(next ? "dark" : "light"),
  });

  return (
    <Lightbulb
      ref={ref}
      toggled={dark}
      onClick={toggleSwitchTheme}
      duration={400}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={undefined}
      className={cn("neo-tile neo-tile--sm theme-bulb", className)}
    />
  );
}
