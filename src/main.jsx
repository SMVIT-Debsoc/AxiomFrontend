import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {ClerkProvider} from "@clerk/clerk-react";
import {ThemeProvider} from "./contexts/ThemeContext";
import {MotionConfig} from "framer-motion";
import "./index.css";
import App from "./App.jsx";
import "./utils/iosViewportFix.js"; // iOS Safari viewport height fix
import {isTemporaryAuth} from "./auth/mode";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!isTemporaryAuth && !PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" appearance={{
      variables: {
        colorPrimary: "var(--axiom-green-primary)",
        colorText: "hsl(var(--foreground))",
        colorTextSecondary: "hsl(var(--muted-foreground))",
        colorBackground: "hsl(var(--card))",
        colorInputBackground: "hsl(var(--background))",
        colorInputText: "hsl(var(--foreground))",
        fontFamily: "var(--font-body)",
        borderRadius: "var(--radius)",
      },
      elements: {formButtonPrimary: "text-primary-foreground", card: "border border-border shadow-none"},
    }}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user" transition={{duration: 0.24, ease: [0.22, 1, 0.36, 1]}}>
          <App />
        </MotionConfig>
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>
);
